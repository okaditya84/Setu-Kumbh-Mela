"""Probabilistic record-linkage scorer (Fellegi-Sunter style).

Given a MISSING case and a FOUND case, accumulate per-field evidence weights
(positive for agreement, negative for conflict), then map the total to a 0..1
probability with a calibrated logistic. Every field contributes a line to a
human-readable ``breakdown`` so an operator sees *why* a match was proposed.

Robust to missing data: a field that is blank on either side simply contributes
nothing - there is no imputation and no penalty. Identity is therefore decided
by whatever evidence is actually present, which is exactly how a good human
operator reasons.

Transient vs stable handling:
* clothing colour weight decays with the time gap between the two reports
  (temporal drift - white at 08:00 reads grey by 16:00);
* stable descriptors (walking stick, blindness, rudraksha) keep full weight.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.core.config import settings
from app.db.models import Case
from app.geo.distance import haversine_km
from app.geo.gazetteer import resolve_location
from app.matching.face import cosine as face_cosine


@dataclass
class ScoreResult:
    weight: float
    probability: float
    breakdown: List[Dict[str, object]] = field(default_factory=list)
    hard_conflict: bool = False  # e.g. confirmed gender clash => suppress


def _coords(c: Case) -> Optional[Tuple[float, float]]:
    if c.last_seen_lat is not None and c.last_seen_lng is not None:
        return (c.last_seen_lat, c.last_seen_lng)
    return resolve_location(c.last_seen_location)


def _hours_between(a: Optional[datetime], b: Optional[datetime]) -> Optional[float]:
    if not a or not b:
        return None
    # SQLite returns tz-naive datetimes; coerce both to aware UTC before diff.
    if a.tzinfo is None:
        a = a.replace(tzinfo=timezone.utc)
    if b.tzinfo is None:
        b = b.replace(tzinfo=timezone.utc)
    return abs((a - b).total_seconds()) / 3600.0


def _norm(c: Case) -> dict:
    return c.normalized or {}


def _overlap(a: List[str], b: List[str]) -> List[str]:
    return sorted(set(a) & set(b))


def to_probability(weight: float) -> float:
    z = (weight - settings.MATCH_PROB_OFFSET) / max(0.1, settings.MATCH_PROB_SCALE)
    z = max(-40.0, min(40.0, z))
    return 1.0 / (1.0 + math.exp(-z))


def score_pair(a: Case, b: Case) -> ScoreResult:
    """Score MISSING/FOUND order-independently; ``a`` and ``b`` are interchangeable."""
    s = settings
    lines: List[Dict[str, object]] = []
    total = 0.0
    hard_conflict = False

    def add(field_name: str, detail: str, w: float) -> None:
        nonlocal total
        total += w
        lines.append({"field": field_name, "detail": detail, "weight": round(w, 3)})

    # --- face similarity (dominant when both have a photo embedding) ---------
    fsim = face_cosine(a.face_embedding, b.face_embedding)
    if fsim is not None:
        if fsim >= s.FACE_STRONG_SIM:
            add("face", f"faces match ({fsim:.2f})", s.W_FACE_MATCH)
        elif fsim <= s.FACE_WEAK_SIM:
            add("face", f"faces differ ({fsim:.2f})", s.W_FACE_MISMATCH)
        else:
            # Interpolate between mismatch and match across the uncertain band.
            frac = (fsim - s.FACE_WEAK_SIM) / max(0.01, s.FACE_STRONG_SIM - s.FACE_WEAK_SIM)
            add("face", f"face similarity {fsim:.2f}", s.W_FACE_MISMATCH + frac * (s.W_FACE_MATCH - s.W_FACE_MISMATCH))

    # --- mobile (exact hashed) : near-certain identity -----------------------
    if a.reporter_mobile_hash and b.reporter_mobile_hash:
        if a.reporter_mobile_hash == b.reporter_mobile_hash:
            add("mobile", "same contact number", s.W_MOBILE_EXACT)

    # --- gender --------------------------------------------------------------
    ga, gb = (a.gender or "").lower(), (b.gender or "").lower()
    if ga and gb and ga != "unknown" and gb != "unknown":
        if ga == gb:
            add("gender", f"both {a.gender}", s.W_GENDER_AGREE)
        else:
            add("gender", f"{a.gender} vs {b.gender}", s.W_GENDER_DISAGREE)
            hard_conflict = True

    # --- age band (with adjacency + free-text inferred fallback) -------------
    na, nb = _norm(a), _norm(b)
    aba = a.age_band or na.get("inferred_age_band")
    abb = b.age_band or nb.get("inferred_age_band")
    AGE = ["0-12", "13-17", "18-40", "41-60", "61-70", "71-80", "80+"]
    if aba and abb and aba in AGE and abb in AGE:
        if aba == abb:
            add("age_band", f"both {aba}", s.W_AGEBAND_AGREE)
        elif abs(AGE.index(aba) - AGE.index(abb)) == 1:
            add("age_band", f"{aba} ~ {abb} (adjacent)", s.W_AGEBAND_ADJACENT)
        else:
            add("age_band", f"{aba} vs {abb}", s.W_AGEBAND_DISAGREE)

    # --- language ------------------------------------------------------------
    if a.language and b.language:
        if a.language.lower() == b.language.lower():
            add("language", f"both speak {a.language}", s.W_LANGUAGE_AGREE)
        else:
            add("language", f"{a.language} vs {b.language}", s.W_LANGUAGE_DISAGREE)

    # --- origin --------------------------------------------------------------
    if a.state and b.state and a.state.lower() == b.state.lower():
        add("state", f"both from {a.state}", s.W_STATE_AGREE)
        if a.district and b.district and a.district.lower() == b.district.lower():
            add("district", f"both from {a.district}", s.W_DISTRICT_AGREE)

    # --- name (phonetic + nickname keys) -------------------------------------
    ka, kb = na.get("name_keys", []), nb.get("name_keys", [])
    if ka and kb:
        shared = _overlap(ka, kb)
        # Strong if a *literal* token (not just a soundex bucket) matches.
        strong = [k for k in shared if not k.startswith(("MP:", "SX:"))]
        if strong:
            add("name", f"name match: {', '.join(strong[:3])}", s.W_NAME_STRONG)
        elif shared:
            add("name", "phonetically similar name", s.W_NAME_WEAK)
        else:
            add("name", "different names", s.W_NAME_DISAGREE)

    # --- geography (last-seen proximity) -------------------------------------
    ca, cb = _coords(a), _coords(b)
    if ca and cb:
        d = haversine_km(ca, cb)
        if d <= s.GEO_NEAR_KM:
            add("geo", f"last seen ~{d:.1f} km apart", s.W_GEO_NEAR)
        elif d >= s.GEO_FAR_KM:
            add("geo", f"last seen ~{d:.1f} km apart (far)", s.W_GEO_FAR)
        else:
            # Linear interpolation between near-bonus and far-penalty.
            frac = (d - s.GEO_NEAR_KM) / max(0.1, (s.GEO_FAR_KM - s.GEO_NEAR_KM))
            w = s.W_GEO_NEAR + frac * (s.W_GEO_FAR - s.W_GEO_NEAR)
            add("geo", f"last seen ~{d:.1f} km apart", w)

    # --- clothing colour (transient - decays with time gap) ------------------
    colors = _overlap(na.get("colors", []), nb.get("colors", []))
    if colors:
        gap = _hours_between(a.reported_at, b.reported_at)
        decay = 1.0
        if gap is not None:
            decay = 0.5 ** (gap / max(0.5, s.COLOR_DRIFT_HALFLIFE_HOURS))
        w = s.W_DESC_COLOR * len(colors) * decay
        add("clothing", f"shared colour(s): {', '.join(colors)} (drift-adj)", w)

    # --- stable descriptors (high value, don't drift) ------------------------
    stable = _overlap(na.get("stable", []), nb.get("stable", []))
    if stable:
        add("descriptor", f"stable trait(s): {', '.join(stable)}", s.W_DESC_STABLE * len(stable))

    prob = to_probability(total)
    if hard_conflict:
        prob = min(prob, 0.15)  # confirmed gender clash strongly suppresses
    return ScoreResult(weight=round(total, 3), probability=round(prob, 4),
                       breakdown=lines, hard_conflict=hard_conflict)
