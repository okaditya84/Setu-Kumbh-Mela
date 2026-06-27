"""Matching accuracy evaluation — the honest, reproducible proof.

The synthetic dataset has no reliable ground-truth links (the
``is_duplicate_report`` flag does not point at a twin record). So instead of
pretending, we *construct* ground truth: take real MISSING reports, synthesise a
FOUND counterpart for each with controlled, realistic noise, then measure
whether the matcher reunites the pair.

The noise deliberately exercises the hard edge cases:
* the name is dropped (15-20% of real reports have none);
* the volunteer's appearance wording differs from the family's wording
  (reporter-perspective bias — low literal overlap);
* a clothing colour is translated into another Indian language or drifts;
* the report time is hours later (temporal drift);
* the age band is occasionally mis-judged to an adjacent band.

We report recall@1, recall@5, MRR and the score separation between true pairs
and the best non-pair — the numbers that calibrate the thresholds.

Run:  python -m scripts.eval_matcher --pairs 200
"""
from __future__ import annotations

import argparse
import csv
import os
import random
import sys
from datetime import datetime, timedelta, timezone

# Allow running as a module from the backend dir.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402
from app.core.security import hash_pii, normalize_mobile  # noqa: E402
from app.db.base import Base, SessionLocal, engine, init_db  # noqa: E402
from app.db.models import Case, CaseStatus, CaseType  # noqa: E402
from app.geo.distance import geo_cell  # noqa: E402
from app.geo.gazetteer import resolve_location  # noqa: E402
from app.matching.engine import find_matches  # noqa: E402
from app.matching.normalize import COLOR_LEXICON, build_normalized  # noqa: E402

# Reverse colour map: canonical -> non-English tokens, for translation noise.
_COLOR_REVERSE: dict = {}
for tok, canon in COLOR_LEXICON.items():
    if tok != canon:
        _COLOR_REVERSE.setdefault(canon, []).append(tok)


def _seed_open_missing(db, limit: int, rng: random.Random) -> list[Case]:
    """Load missing reports from the CSV, forced to OPEN status so they match."""
    path = os.path.join(settings.DATA_DIR, "Synthetic_Missing_Persons_2500.csv")
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8")))
    rng.shuffle(rows)
    cases: list[Case] = []
    for row in rows[:limit]:
        name = (row.get("missing_person_name") or "").strip() or None
        age = (row.get("age_band") or "").strip() or None
        desc = (row.get("physical_description") or "").strip() or None
        loc = (row.get("last_seen_location") or "").strip() or None
        coords = resolve_location(loc) or (None, None)
        c = Case(
            case_id=row["case_id"], client_uuid=row["case_id"],
            case_type=CaseType.missing.value, status=CaseStatus.pending.value,
            person_name=name, gender=(row.get("gender") or "").strip() or None,
            age_band=age, state=(row.get("state") or "").strip() or None,
            district=(row.get("district") or "").strip() or None,
            language=(row.get("language") or "").strip() or None,
            last_seen_location=loc, last_seen_lat=coords[0], last_seen_lng=coords[1],
            geo_cell=geo_cell(coords[0], coords[1]), physical_description=desc,
            reporting_center=(row.get("reporting_center") or "").strip() or None,
            normalized=build_normalized(person_name=name, age_band=age, physical_description=desc),
            reported_at=datetime.now(timezone.utc),
        )
        db.add(c)
        cases.append(c)
    db.commit()
    return cases


AGE = ["0-12", "13-17", "18-40", "41-60", "61-70", "71-80", "80+"]


def _make_found(origin: Case, rng: random.Random) -> Case:
    """Synthesize a noisy FOUND counterpart of a MISSING case."""
    n = origin.normalized or {}
    colors = list(n.get("colors", []))
    stable = list(n.get("stable", []))

    # Reporter-perspective description: appearance-focused, different wording.
    bits = []
    if origin.age_band:
        bits.append(f"approx {origin.age_band}")
    if origin.gender:
        bits.append(origin.gender.lower())
    # Translate / drift one colour.
    if colors and rng.random() < 0.7:
        canon = colors[0]
        alt = _COLOR_REVERSE.get(canon, [canon])
        bits.append(rng.choice(alt))  # may be a Hindi/Tamil/etc. word
    elif rng.random() < 0.3:
        bits.append(rng.choice(["dusty clothes", "faded clothes"]))  # drift, no colour
    if stable:
        bits.append(stable[0].replace("_", " "))
    desc = "person found, " + ", ".join(bits) if bits else "person found at center"

    # Age band: occasionally mis-judged to an adjacent band.
    age_band = origin.age_band
    if age_band in AGE and rng.random() < 0.25:
        i = AGE.index(age_band)
        j = max(0, min(len(AGE) - 1, i + rng.choice([-1, 1])))
        age_band = AGE[j]

    # Geo: a nearby coordinate (separations happen near where last seen).
    lat, lng = origin.last_seen_lat, origin.last_seen_lng
    if lat is not None:
        lat = lat + rng.uniform(-0.004, 0.004)
        lng = lng + rng.uniform(-0.004, 0.004)

    found = Case(
        case_id=f"FOUND-{origin.case_id}", client_uuid=f"FOUND-{origin.case_id}",
        case_type=CaseType.found.value, status=CaseStatus.pending.value,
        # Name dropped most of the time (the at-risk group often can't give it).
        person_name=None if rng.random() < 0.8 else origin.person_name,
        gender=origin.gender,
        age_band=age_band,
        # Family always knows origin; volunteer learns it from the person sometimes.
        state=origin.state if rng.random() < 0.7 else None,
        district=origin.district if rng.random() < 0.4 else None,
        language=origin.language if rng.random() < 0.85 else None,
        last_seen_location=origin.last_seen_location,
        last_seen_lat=lat, last_seen_lng=lng, geo_cell=geo_cell(lat, lng),
        physical_description=desc,
        reporting_center="Found Persons Desk",
        normalized=build_normalized(person_name=None, age_band=age_band, physical_description=desc),
        reported_at=(origin.reported_at or datetime.now(timezone.utc)) + timedelta(hours=rng.uniform(0.5, 18)),
    )
    return found


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", type=int, default=200, help="number of injected pairs")
    ap.add_argument("--pool", type=int, default=600, help="open missing pool size")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    # Fresh in-file DB so the eval is isolated and repeatable.
    os.environ.setdefault("DATABASE_URL", settings.DATABASE_URL)
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    try:
        pool = _seed_open_missing(db, args.pool, rng)
        targets = rng.sample(pool, min(args.pairs, len(pool)))

        ranks = []
        true_probs, best_nonpair_probs = [], []
        for origin in targets:
            found = _make_found(origin, rng)
            db.add(found)
            db.commit()
            res = find_matches(db, found)
            cand_ids = [c["case"].id for c in res["candidates"]]
            probs = {c["case"].id: c["probability"] for c in res["candidates"]}
            if origin.id in cand_ids:
                rank = cand_ids.index(origin.id) + 1
                ranks.append(rank)
                true_probs.append(probs[origin.id])
            else:
                ranks.append(0)  # not found at all
            best_nonpair = max((p for cid, p in probs.items() if cid != origin.id), default=0.0)
            best_nonpair_probs.append(best_nonpair)
            # Remove the found case so it doesn't pollute later queries' candidate pools.
            db.delete(found)
            db.commit()

        n = len(ranks)
        r1 = sum(1 for r in ranks if r == 1) / n
        r5 = sum(1 for r in ranks if 1 <= r <= 5) / n
        found_at_all = sum(1 for r in ranks if r >= 1) / n
        mrr = sum((1.0 / r) for r in ranks if r >= 1) / n
        avg_true = sum(true_probs) / len(true_probs) if true_probs else 0
        avg_nonpair = sum(best_nonpair_probs) / n

        print("=" * 60)
        print(f"  MATCHING ACCURACY  (n={n} injected noisy pairs)")
        print("=" * 60)
        print(f"  Recall@1 : {r1:.1%}   (true partner ranked #1)")
        print(f"  Recall@5 : {r5:.1%}   (true partner in top 5)")
        print(f"  Found    : {found_at_all:.1%}   (true partner surfaced at all)")
        print(f"  MRR      : {mrr:.3f}")
        print("-" * 60)
        print(f"  avg P(true pair)        : {avg_true:.3f}")
        print(f"  avg P(best non-pair)    : {avg_nonpair:.3f}")
        print(f"  separation              : {avg_true - avg_nonpair:+.3f}")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    main()
