"""Blocking — shrink the comparison space before scoring.

Naive matching compares a new report against every open record (O(n²) across the
event — fatal at Kumbh scale). Blocking restricts comparison to records that
share a coarse key with the query, so a new report is scored against a few
hundred plausible candidates instead of millions.

Keys used (a candidate need match only the structural gates):
* opposite case type (missing<->found) and an open status
* gender compatible (equal, or either side Unknown/blank)
* age band equal or *adjacent* (61-70 ~ 71-80 — reporters misjudge age)

Geography and everything else are handled as soft signal in the scorer, not as a
hard gate, so we never block away a true match because a place name differed.
An exact hashed-mobile hit bypasses blocking entirely (near-certain identity).
"""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.models import Case, CaseStatus, CaseType

AGE_ORDER = ["0-12", "13-17", "18-40", "41-60", "61-70", "71-80", "80+"]

# Statuses that are still "open" for matching purposes.
OPEN_STATUSES = [CaseStatus.pending.value, CaseStatus.hospital.value, CaseStatus.unresolved.value]


def adjacent_bands(band: Optional[str]) -> List[str]:
    if not band or band not in AGE_ORDER:
        return AGE_ORDER[:]  # unknown age => don't constrain
    i = AGE_ORDER.index(band)
    out = [band]
    if i > 0:
        out.append(AGE_ORDER[i - 1])
    if i < len(AGE_ORDER) - 1:
        out.append(AGE_ORDER[i + 1])
    return out


def candidate_query(db: Session, query: Case, limit: int = 800):
    opposite = CaseType.found.value if query.case_type == CaseType.missing.value else CaseType.missing.value

    filters = [Case.case_type == opposite, Case.status.in_(OPEN_STATUSES), Case.id != query.id]

    # Gender gate (Unknown/None on either side is a wildcard).
    if query.gender and query.gender.lower() != "unknown":
        filters.append(
            or_(Case.gender == query.gender, Case.gender == "Unknown", Case.gender.is_(None))
        )

    # Age band gate (self + adjacent), allowing unknown ages through.
    bands = adjacent_bands(query.age_band)
    if query.age_band and query.age_band in AGE_ORDER:
        filters.append(or_(Case.age_band.in_(bands), Case.age_band.is_(None)))

    stmt = select(Case).where(and_(*filters)).limit(limit)
    return db.execute(stmt).scalars().all()


def find_by_mobile(db: Session, query: Case) -> List[Case]:
    """Exact hashed-mobile fast path (privacy-preserving identity shortcut)."""
    if not query.reporter_mobile_hash:
        return []
    opposite = CaseType.found.value if query.case_type == CaseType.missing.value else CaseType.missing.value
    stmt = select(Case).where(
        and_(
            Case.case_type == opposite,
            Case.reporter_mobile_hash == query.reporter_mobile_hash,
            Case.id != query.id,
        )
    )
    return db.execute(stmt).scalars().all()
