"""Center-wise notifications.

Volunteers are assigned to a center. When a found report at one center matches a
missing report filed at another (at/above NOTIFY_THRESHOLD), BOTH centers are
alerted so each side knows to bring their person/family together. Reunions notify
both centers too. Dedup prevents repeat alerts for the same pair+center.
"""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Case, CaseType, Notification


def _exists(db: Session, center: str, case_id: str, related_case_id: str, kind: str) -> bool:
    return db.execute(
        select(Notification.id).where(
            Notification.center == center, Notification.case_id == case_id,
            Notification.related_case_id == related_case_id, Notification.kind == kind,
        )
    ).first() is not None


def _add(db: Session, *, center: Optional[str], kind: str, title: str, body: str,
         case_id: str, related_case_id: str, probability: Optional[float] = None) -> None:
    if not center:
        return
    if _exists(db, center, case_id, related_case_id, kind):
        return
    db.add(Notification(center=center, kind=kind, title=title, body=body,
                        case_id=case_id, related_case_id=related_case_id, probability=probability))


def _label(c: Case) -> str:
    bits = [c.person_name or "Unidentified", c.gender or "", c.age_band or ""]
    return " · ".join(b for b in bits if b)


def notify_match(db: Session, query: Case, candidates: List[dict]) -> int:
    """Raise cross-center alerts for strong candidates of a freshly created case."""
    made = 0
    for cand in candidates:
        if cand["probability"] < settings.NOTIFY_THRESHOLD:
            continue
        other: Case = cand["case"]
        qc, oc = query.reporting_center, other.reporting_center
        # Same non-empty center: staff already sees both sides, no alert needed.
        # But if either side has no center (e.g. a public/family self-report),
        # we still alert whichever center IS present - that is the actionable side.
        if qc and oc and qc == oc:
            continue
        # Identify which is the missing vs found side for clear wording.
        missing = query if query.case_type == CaseType.missing.value else other
        found = other if query.case_type == CaseType.missing.value else query
        pct = round(cand["probability"] * 100)
        found_where = found.reporting_center or "another center"
        family_where = missing.reporting_center or "a family searching online"
        # Alert the family's (missing) center, if one is set.
        _add(db, center=missing.reporting_center, kind="match",
             title=f"Possible match ({pct}%) for {_label(missing)}",
             body=f"A found person at {found_where} may be your missing case {missing.case_id}.",
             case_id=missing.id, related_case_id=found.id, probability=cand["probability"])
        # Alert the center holding the found person, if one is set.
        _add(db, center=found.reporting_center, kind="match",
             title=f"Possible match ({pct}%) for the person at your center",
             body=f"{family_where} is looking for this person (missing case {missing.case_id}).",
             case_id=found.id, related_case_id=missing.id, probability=cand["probability"])
        made += 1
    if made:
        db.commit()
    return made


def notify_reunion(db: Session, missing: Optional[Case], found: Optional[Case]) -> None:
    if not missing or not found:
        return
    for tgt, other in ((missing, found), (found, missing)):
        _add(db, center=tgt.reporting_center, kind="reunion",
             title=f"Reunited: {_label(missing)}",
             body=f"Cases {missing.case_id} ↔ {found.case_id} were confirmed reunited.",
             case_id=tgt.id, related_case_id=other.id)
    db.commit()
