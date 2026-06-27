from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.db.base import get_db
from app.db.models import MatchLink
from app.schemas.models import MatchDecision
from app.services.match_service import decide

router = APIRouter(prefix="/matches", tags=["matches"])


@router.post("/decide")
def decide_match(
    payload: MatchDecision,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    link = decide(db, payload.missing_case_id, payload.found_case_id, payload.decision, actor=user.id)
    return {
        "missing_case_id": link.missing_case_id,
        "found_case_id": link.found_case_id,
        "status": link.status,
        "decided_at": link.decided_at,
    }


@router.get("")
def list_matches(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=100, le=500),
):
    stmt = select(MatchLink).order_by(MatchLink.probability.desc())
    if status_filter:
        stmt = stmt.where(MatchLink.status == status_filter)
    stmt = stmt.limit(limit)
    rows = db.execute(stmt).scalars().all()
    return [
        {
            "id": r.id,
            "missing_case_id": r.missing_case_id,
            "found_case_id": r.found_case_id,
            "probability": r.probability,
            "score": r.score,
            "status": r.status,
            "explanation": r.explanation,
            "breakdown": r.breakdown,
            "created_at": r.created_at,
        }
        for r in rows
    ]
