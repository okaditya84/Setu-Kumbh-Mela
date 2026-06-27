from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.base import get_db
from app.db.models import Operator
from app.schemas.models import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    op = db.execute(select(Operator).where(Operator.username == payload.username.lower())).scalar_one_or_none()
    if not op or not verify_password(payload.password, op.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token = create_access_token(op.id, {"role": op.role, "center": op.center, "username": op.username})
    return TokenResponse(access_token=token, role=op.role, center=op.center, full_name=op.full_name)
