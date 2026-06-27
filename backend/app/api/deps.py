"""Shared FastAPI dependencies: DB session, current operator, role guard."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.base import get_db
from app.db.models import Operator, Role


class CurrentUser:
    def __init__(self, id: str, username: str, role: str, center: str):
        self.id = id
        self.username = username
        self.role = role
        self.center = center


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    op = db.get(Operator, payload.get("sub"))
    if not op:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown operator")
    return CurrentUser(op.id, op.username, op.role, op.center)


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != Role.admin.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user
