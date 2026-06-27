"""Admin observability: live operational metrics + audit feed + purge control.

This is the administrator's window into the whole platform — case throughput,
reunion rate, time-to-reunite, where separations cluster, and a live event feed.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, require_admin
from app.core.logging import metrics
from app.db.base import get_db
from app.db.models import AuditEvent, Case, CaseStatus, CaseType, MatchLink, MatchStatus
from app.geo import reference
from app.services.case_service import run_purge_sweep

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/metrics")
def admin_metrics(db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    def count(*conds) -> int:
        stmt = select(func.count(Case.id))
        for c in conds:
            stmt = stmt.where(c)
        return db.execute(stmt).scalar_one()

    total = count()
    by_status = {
        s.value: count(Case.status == s.value) for s in CaseStatus
    }
    by_type = {
        t.value: count(Case.case_type == t.value) for t in CaseType
    }
    reunited = by_status.get(CaseStatus.reunited.value, 0)
    avg_res = db.execute(
        select(func.avg(Case.resolution_hours)).where(Case.resolution_hours.is_not(None))
    ).scalar()

    # Cases per reporting center.
    center_rows = db.execute(
        select(Case.reporting_center, func.count(Case.id)).group_by(Case.reporting_center)
    ).all()
    by_center = {(r[0] or "Unknown"): r[1] for r in center_rows}

    # Cases per language (helps staff multilingual announcement desks).
    lang_rows = db.execute(
        select(Case.language, func.count(Case.id)).group_by(Case.language)
    ).all()
    by_language = {(r[0] or "Unknown"): r[1] for r in lang_rows}

    match_rows = db.execute(
        select(MatchLink.status, func.count(MatchLink.id)).group_by(MatchLink.status)
    ).all()
    matches = {r[0]: r[1] for r in match_rows}

    open_pts = db.execute(
        select(Case.last_seen_lat, Case.last_seen_lng).where(
            Case.status == CaseStatus.pending.value, Case.last_seen_lat.is_not(None)
        )
    ).all()
    top_hotspots = reference.hotspots([(r[0], r[1]) for r in open_pts])[:8]

    return {
        "totals": {
            "cases": total,
            "by_status": by_status,
            "by_type": by_type,
            "reunited": reunited,
            "reunion_rate": round(reunited / total, 4) if total else 0,
            "avg_resolution_hours": round(avg_res, 2) if avg_res else None,
            "open_cases": by_status.get(CaseStatus.pending.value, 0),
        },
        "matches": matches,
        "by_center": by_center,
        "by_language": by_language,
        "top_hotspots": top_hotspots,
        "runtime": metrics.snapshot(),
    }


@router.get("/events")
def admin_events(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
    limit: int = Query(default=100, le=500),
    action: Optional[str] = None,
):
    stmt = select(AuditEvent).order_by(AuditEvent.ts.desc())
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    rows = db.execute(stmt.limit(limit)).scalars().all()
    return {
        "events": [
            {
                "id": e.id, "ts": e.ts, "actor": e.actor, "action": e.action,
                "entity_type": e.entity_type, "entity_id": e.entity_id, "meta": e.meta,
            }
            for e in rows
        ]
    }


@router.post("/purge")
def purge(db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    """Manually trigger the privacy PII-purge sweep (also runs on a schedule)."""
    n = run_purge_sweep(db)
    return {"purged": n}
