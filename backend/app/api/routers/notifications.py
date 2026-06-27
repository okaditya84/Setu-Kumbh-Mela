"""Center-scoped notifications for the logged-in operator."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.db.base import get_db
from app.db.models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(n: Notification) -> dict:
    return {
        "id": n.id, "kind": n.kind, "title": n.title, "body": n.body,
        "case_id": n.case_id, "related_case_id": n.related_case_id,
        "probability": n.probability, "read": n.read, "created_at": n.created_at,
    }


@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    unread_only: bool = False,
    limit: int = Query(default=50, le=200),
):
    stmt = select(Notification).where(Notification.center == user.center)
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))
    stmt = stmt.order_by(Notification.read.asc(), Notification.created_at.desc()).limit(limit)
    return {"notifications": [_serialize(n) for n in db.execute(stmt).scalars().all()]}


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    n = db.execute(
        select(func.count(Notification.id)).where(
            Notification.center == user.center, Notification.read.is_(False)
        )
    ).scalar_one()
    return {"count": n}


@router.post("/{notif_id}/read")
def mark_read(notif_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    n = db.get(Notification, notif_id)
    if not n or n.center != user.center:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    n.read = True
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    db.execute(update(Notification).where(
        Notification.center == user.center, Notification.read.is_(False)
    ).values(read=True))
    db.commit()
    return {"ok": True}
