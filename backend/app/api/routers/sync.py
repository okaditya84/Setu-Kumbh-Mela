"""Offline-first sync endpoints.

Clients (web PWA / Flutter) queue intake locally while offline and replay it
here when connectivity returns. ``client_uuid`` makes every push idempotent:
re-sending the same record updates rather than duplicates, so a flaky 2G link
that retries never creates twins — which is exactly the cross-center duplicate
problem we exist to prevent.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.api.serializers import case_to_out
from app.db.base import get_db
from app.db.models import Case
from app.schemas.models import (
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncPushResult,
)
from app.services import case_service

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
def push(
    payload: SyncPushRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    results = []
    for item in payload.cases:
        cuid = item.client_uuid
        existing = None
        if cuid:
            existing = db.execute(select(Case).where(Case.client_uuid == cuid)).scalar_one_or_none()
        if existing:
            # Idempotent: the record already landed (likely a retried push).
            results.append(SyncPushResult(
                client_uuid=cuid, server_id=existing.id, case_id=existing.case_id, status="updated"
            ))
            continue
        if not item.reporting_center and user.center:
            item.reporting_center = user.center
        case = case_service.create_case(db, item, actor=user.id, source="sync")
        db.flush()
        results.append(SyncPushResult(
            client_uuid=case.client_uuid, server_id=case.id, case_id=case.case_id, status="created"
        ))
    db.commit()
    return SyncPushResponse(results=results, server_time=datetime.now(timezone.utc))


@router.get("/pull", response_model=SyncPullResponse)
def pull(
    since: Optional[datetime] = Query(default=None),
    limit: int = Query(default=500, le=2000),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Return cases updated since a timestamp so a client can refresh its cache."""
    stmt = select(Case)
    if since:
        stmt = stmt.where(Case.updated_at >= since)
    stmt = stmt.order_by(Case.updated_at.asc()).limit(limit)
    cases = [case_to_out(c) for c in db.execute(stmt).scalars().all()]
    return SyncPullResponse(cases=cases, server_time=datetime.now(timezone.utc))
