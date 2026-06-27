"""Matching engine — the orchestration layer.

Pipeline for a query case:
1. exact hashed-mobile fast path (near-certain identity);
2. blocking to fetch plausible candidates;
3. score each candidate (Fellegi–Sunter, see scorer.py);
4. rank, tier (strong / possible / weak) and cap;
5. if a large cluster sits above the review threshold with little score
   separation, return *disambiguating questions* instead of a long list
   (the "old woman, white clothes matches 95 records" problem);
6. attach a plain-language explanation per candidate (deterministic; an optional
   LLM pass can rephrase and catch nicknames the lexicon missed).

The critical path is fully deterministic and offline-safe. The LLM is only ever
an enhancement and is wrapped so any failure degrades gracefully.
"""
from __future__ import annotations

from collections import Counter
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import metrics
from app.db.models import Case
from app.matching import blocking
from app.matching.scorer import ScoreResult, score_pair


def _tier(prob: float) -> str:
    if prob >= settings.MATCH_AUTO_THRESHOLD:
        return "strong"
    if prob >= settings.MATCH_REVIEW_THRESHOLD:
        return "possible"
    return "weak"


def _explain(query: Case, cand: Case, sr: ScoreResult) -> str:
    """Deterministic, operator-facing reason string built from the breakdown."""
    pos = [l for l in sr.breakdown if float(l["weight"]) > 0]
    neg = [l for l in sr.breakdown if float(l["weight"]) < 0]
    pos.sort(key=lambda l: float(l["weight"]), reverse=True)
    parts = [str(l["detail"]) for l in pos[:4]]
    txt = f"{int(round(sr.probability * 100))}% likely the same person"
    if parts:
        txt += " — " + "; ".join(parts)
    if neg:
        txt += f". Note: {neg[0]['detail']}"
    return txt


def _disambiguation_questions(query: Case, cluster: List[Case]) -> List[Dict[str, object]]:
    """Find the fields that best split an ambiguous cluster and ask about them.

    We only ask about attributes that are *missing or unknown on the query* and
    that actually vary across the cluster — those are the questions that collapse
    the candidate set fastest.
    """
    questions: List[Dict[str, object]] = []

    def diversity(values: List[str]) -> Counter:
        return Counter(v for v in values if v)

    # Language
    if not query.language:
        langs = diversity([c.language for c in cluster])
        if len(langs) > 1:
            questions.append({
                "field": "language",
                "question": "Which language does the person speak?",
                "options": [k for k, _ in langs.most_common(6)],
            })
    # State of origin
    if not query.state:
        states = diversity([c.state for c in cluster])
        if len(states) > 1:
            questions.append({
                "field": "state",
                "question": "Which state is the person from?",
                "options": [k for k, _ in states.most_common(6)],
            })
    # Stable distinguishing traits present among candidates
    traits = Counter()
    for c in cluster:
        for t in (c.normalized or {}).get("stable", []):
            traits[t] += 1
    qtraits = set((query.normalized or {}).get("stable", []))
    distinctive = [t for t, _ in traits.most_common(6) if t not in qtraits]
    if distinctive:
        questions.append({
            "field": "stable",
            "question": "Any distinguishing trait? (walking stick, blindness, hearing aid, rudraksha, tilak…)",
            "options": distinctive,
        })
    # Exact age (collapses adjacent bands)
    if not query.age_band:
        bands = diversity([c.age_band for c in cluster])
        if len(bands) > 1:
            questions.append({
                "field": "age_band",
                "question": "Roughly how old is the person?",
                "options": [k for k, _ in bands.most_common()],
            })
    return questions[:3]


def find_matches(db: Session, query: Case, limit: Optional[int] = None) -> Dict[str, object]:
    limit = limit or settings.MATCH_MAX_CANDIDATES
    with metrics_timer("match.find_matches"):
        # 1) exact-mobile fast path
        forced: Dict[str, ScoreResult] = {}
        for c in blocking.find_by_mobile(db, query):
            forced[c.id] = score_pair(query, c)

        # 2) blocking + 3) scoring
        scored: List[tuple[Case, ScoreResult]] = []
        seen = set(forced.keys())
        for cand in blocking.candidate_query(db, query):
            if cand.id in seen:
                continue
            sr = score_pair(query, cand)
            scored.append((cand, sr))
        for cid, sr in forced.items():
            cand = db.get(Case, cid)
            if cand:
                scored.append((cand, sr))

    # 4) rank + tier
    scored.sort(key=lambda t: t[1].probability, reverse=True)
    ranked = scored[: max(limit, settings.DISAMBIGUATION_TRIGGER_COUNT * 2)]

    candidates = []
    for cand, sr in ranked[:limit]:
        candidates.append({
            "case": cand,
            "score": sr.weight,
            "probability": sr.probability,
            "tier": _tier(sr.probability),
            "breakdown": sr.breakdown,
            "explanation": _explain(query, cand, sr),
        })

    # 5) disambiguation trigger: large low-margin cluster above review threshold
    above = [(c, sr) for c, sr in ranked if sr.probability >= settings.MATCH_REVIEW_THRESHOLD]
    questions: List[Dict[str, object]] = []
    needs_disambiguation = False
    if len(above) >= settings.DISAMBIGUATION_TRIGGER_COUNT:
        top_p = above[0][1].probability
        tight = [c for c, sr in above if top_p - sr.probability <= settings.DISAMBIGUATION_MARGIN]
        if len(tight) >= settings.DISAMBIGUATION_TRIGGER_COUNT:
            needs_disambiguation = True
            questions = _disambiguation_questions(query, tight)

    metrics.incr("match.queries")
    if candidates and candidates[0]["tier"] == "strong":
        metrics.incr("match.strong_hits")

    return {
        "query_case_id": query.id,
        "candidates": candidates,
        "needs_disambiguation": needs_disambiguation,
        "disambiguation_questions": questions,
        "total_considered": len(scored),
    }


# Small context-manager timer that records into the metrics registry.
class metrics_timer:
    def __init__(self, name: str):
        self.name = name

    def __enter__(self):
        import time
        self._t = time.time()
        return self

    def __exit__(self, *exc):
        import time
        metrics.observe(self.name, (time.time() - self._t) * 1000.0)
        return False
