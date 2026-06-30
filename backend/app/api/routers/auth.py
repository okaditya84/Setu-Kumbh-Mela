from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import get_db
from app.db.models import AuditEvent, Operator, Role
from app.schemas.models import (
    GoogleAuthRequest,
    LoginRequest,
    SignupRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Google's tokeninfo endpoint verifies an ID token (signature, expiry, audience)
# without us shipping Google's cert-handling code or an extra SDK.
_GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"


def _token_for(op: Operator) -> TokenResponse:
    token = create_access_token(
        op.id, {"role": op.role, "center": op.center, "username": op.username}
    )
    return TokenResponse(
        access_token=token, role=op.role, center=op.center, full_name=op.full_name
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    op = db.execute(
        select(Operator).where(Operator.username == payload.username.lower())
    ).scalar_one_or_none()
    if not op or not verify_password(payload.password, op.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    return _token_for(op)


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """Public self-registration. Always creates a non-admin, non-volunteer
    (``public``) account - privilege escalation is impossible from this route."""
    if not settings.PUBLIC_SIGNUP_ENABLED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Public sign-up is disabled")
    username = payload.email.strip().lower()
    existing = db.execute(
        select(Operator).where(Operator.username == username)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    op = Operator(
        username=username,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=Role.public.value,
        center="",
    )
    db.add(op)
    db.add(AuditEvent(actor=username, action="signup", entity_type="operator", entity_id=op.id))
    db.commit()
    db.refresh(op)
    return _token_for(op)


@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Sign in / sign up with a Google ID token. Creates a ``public`` account on
    first use; existing accounts (by email) just get a session token."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured")
    try:
        resp = httpx.get(
            _GOOGLE_TOKENINFO, params={"id_token": payload.credential}, timeout=10.0
        )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not reach Google to verify sign-in")
    if resp.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google credential")
    info = resp.json()
    # Audience must be OUR client id, and Google must have verified the email.
    if info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google credential was issued for another app")
    if info.get("email_verified") not in ("true", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google account email is not verified")
    email = (info.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google credential has no email")

    op = db.execute(select(Operator).where(Operator.username == email)).scalar_one_or_none()
    if not op:
        op = Operator(
            username=email,
            full_name=info.get("name") or email.split("@")[0],
            # No usable local password: store a random hash so password login fails.
            password_hash=hash_password(create_access_token("google-" + email)[:60]),
            role=Role.public.value,
            center="",
        )
        db.add(op)
        db.add(AuditEvent(actor=email, action="signup_google", entity_type="operator", entity_id=op.id))
        db.commit()
        db.refresh(op)
    return _token_for(op)
