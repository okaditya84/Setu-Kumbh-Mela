from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.api.serializers import case_to_out
from app.db.base import get_db
from app.db.models import Case, CaseStatus
from app.schemas.models import (
    AnnouncementResponse,
    CaseCreate,
    CaseOut,
    CaseRefine,
    CaseStatusUpdate,
    MatchResponse,
)
from app.services import case_service
from app.services.match_service import build_match_response, decide_status_reunion, preview as preview_matches
from app.services.announce_service import make_announcement

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("/preview", response_model=MatchResponse)
def preview_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Search the registry for a draft WITHOUT registering it. The volunteer
    reviews the extracted details + matches, then explicitly registers (POST /cases)."""
    if not payload.reporting_center and user.center:
        payload.reporting_center = user.center
    return preview_matches(db, payload)


@router.post("", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Create a missing/found case AND immediately return cross-center matches."""
    # Idempotency: if this client_uuid already exists, return its matches.
    if payload.client_uuid:
        existing = db.execute(
            select(Case).where(Case.client_uuid == payload.client_uuid)
        ).scalar_one_or_none()
        if existing:
            return build_match_response(db, existing)

    if not payload.reporting_center and user.center:
        payload.reporting_center = user.center
    case = case_service.create_case(db, payload, actor=user.id, source="api")
    db.commit()
    db.refresh(case)
    return build_match_response(db, case)


@router.get("", response_model=List[CaseOut])
def list_cases(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    case_type: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    q: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
):
    stmt = select(Case)
    if case_type:
        stmt = stmt.where(Case.case_type == case_type)
    if status_filter:
        stmt = stmt.where(Case.status == status_filter)
    if q:
        import re as _re
        from sqlalchemy import func, or_
        from app.matching.normalize import age_to_band
        like = f"%{q.lower()}%"
        conds = [
            func.lower(Case.person_name).like(like),
            func.lower(Case.last_seen_location).like(like),
            func.lower(Case.physical_description).like(like),
            func.lower(Case.case_id).like(like),
            func.lower(Case.state).like(like),
            func.lower(Case.district).like(like),
            func.lower(Case.language).like(like),
            func.lower(Case.gender).like(like),
            func.lower(Case.reporting_center).like(like),
            func.lower(Case.age_band).like(like),
        ]
        # "65" or "65 years" -> the matching age band.
        m = _re.search(r"\b(\d{1,3})\b", q)
        if m:
            conds.append(Case.age_band == age_to_band(int(m.group(1))))
        stmt = stmt.where(or_(*conds))
    stmt = stmt.order_by(Case.reported_at.desc()).limit(limit).offset(offset)
    return [case_to_out(c) for c in db.execute(stmt).scalars().all()]


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return case_to_out(c)


@router.get("/{case_id}/matches", response_model=MatchResponse)
def case_matches(case_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return build_match_response(db, c)


@router.post("/{case_id}/refine", response_model=MatchResponse)
def refine_case(
    case_id: str,
    payload: CaseRefine,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Apply a disambiguation answer, then return the narrowed matches."""
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    case_service.refine_case(db, c, payload, actor=user.id)
    db.commit()
    db.refresh(c)
    return build_match_response(db, c)


@router.patch("/{case_id}/status", response_model=CaseOut)
def update_status(
    case_id: str,
    payload: CaseStatusUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    if payload.status not in {s.value for s in CaseStatus}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status")
    case_service.set_status(db, c, payload.status, actor=user.id)
    # If a reunion, optionally close the matched counterpart too.
    if payload.status == CaseStatus.reunited.value and payload.matched_case_id:
        decide_status_reunion(db, c, payload.matched_case_id, actor=user.id)
    db.commit()
    db.refresh(c)
    return case_to_out(c)


@router.get("/{case_id}/announcement", response_model=AnnouncementResponse)
def announcement(
    case_id: str,
    language: Optional[str] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    c = db.get(Case, case_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return make_announcement(c, language)
