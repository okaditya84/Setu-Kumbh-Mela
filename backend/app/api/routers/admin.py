"""Admin observability: live operational metrics + audit feed + purge control.

This is the administrator's window into the whole platform — case throughput,
reunion rate, time-to-reunite, where separations cluster, and a live event feed.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pydantic import BaseModel

from app.api.deps import CurrentUser, require_admin
from app.core import ratelimit
from app.core.logging import metrics
from app.core.security import hash_password
from app.db.base import get_db
from app.db.models import AuditEvent, Case, CaseStatus, CaseType, MatchLink, MatchStatus, Operator, Role
from app.geo import reference
from app.services.case_service import audit, run_purge_sweep

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


# ---------------------------- granular request trace -------------------------
@router.get("/trace")
def admin_trace(
    user: CurrentUser = Depends(require_admin),
    limit: int = Query(default=200, le=1000),
    status_min: int = 0,
    path: Optional[str] = None,
):
    """Live per-request trace: method, path, status, latency, client IP, actor."""
    return {"requests": ratelimit.recent_traces(limit, status_min, path), "counters": ratelimit.counters()}


# ---------------------------- dynamic rate limits ---------------------------
class RateLimits(BaseModel):
    auth: Optional[int] = None
    write: Optional[int] = None
    general: Optional[int] = None


@router.get("/rate-limits")
def get_rate_limits(user: CurrentUser = Depends(require_admin)):
    from app.core.config import settings
    return {"enabled": settings.RATE_LIMIT_ENABLED, "limits_rpm": ratelimit.LIMITS}


@router.patch("/rate-limits")
def set_rate_limits(payload: RateLimits, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    updated = ratelimit.set_limits({k: v for k, v in payload.dict().items() if v is not None})
    audit(db, "admin.rate_limits", actor=user.id, meta=updated)
    db.commit()
    return {"limits_rpm": updated}


# ---------------------------- operator management ---------------------------
class OperatorIn(BaseModel):
    username: str
    password: str
    full_name: str = ""
    role: str = Role.volunteer.value
    center: str = ""


class OperatorPatch(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    center: Optional[str] = None
    password: Optional[str] = None


@router.get("/operators")
def list_operators(db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    rows = db.execute(select(Operator).order_by(Operator.created_at.desc())).scalars().all()
    return {"operators": [
        {"id": o.id, "username": o.username, "full_name": o.full_name, "role": o.role,
         "center": o.center, "created_at": o.created_at} for o in rows
    ]}


@router.post("/operators", status_code=201)
def create_operator(payload: OperatorIn, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    if db.execute(select(Operator).where(Operator.username == payload.username.lower())).scalar_one_or_none():
        raise HTTPException(409, "Username already exists")
    op = Operator(username=payload.username.lower(), full_name=payload.full_name,
                  password_hash=hash_password(payload.password),
                  role=payload.role if payload.role in {r.value for r in Role} else Role.volunteer.value,
                  center=payload.center)
    db.add(op)
    audit(db, "admin.operator.create", actor=user.id, entity_type="operator", entity_id=op.id,
          meta={"username": op.username, "role": op.role, "center": op.center})
    db.commit()
    return {"id": op.id, "username": op.username}


@router.patch("/operators/{op_id}")
def update_operator(op_id: str, payload: OperatorPatch, db: Session = Depends(get_db),
                    user: CurrentUser = Depends(require_admin)):
    op = db.get(Operator, op_id)
    if not op:
        raise HTTPException(404, "Operator not found")
    if payload.full_name is not None:
        op.full_name = payload.full_name
    if payload.center is not None:
        op.center = payload.center
    if payload.role and payload.role in {r.value for r in Role}:
        op.role = payload.role
    if payload.password:
        op.password_hash = hash_password(payload.password)
    audit(db, "admin.operator.update", actor=user.id, entity_type="operator", entity_id=op.id)
    db.commit()
    return {"id": op.id, "username": op.username, "role": op.role, "center": op.center}


@router.delete("/operators/{op_id}")
def delete_operator(op_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    op = db.get(Operator, op_id)
    if not op:
        raise HTTPException(404, "Operator not found")
    if op.id == user.id:
        raise HTTPException(400, "You cannot delete your own account")
    db.delete(op)
    audit(db, "admin.operator.delete", actor=user.id, entity_type="operator", entity_id=op_id)
    db.commit()
    return {"ok": True}
