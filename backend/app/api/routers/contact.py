"""Public contact form → email (SMTP). Graceful when SMTP is unconfigured."""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from fastapi import APIRouter, Depends
from loguru import logger
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import get_db
from app.services.case_service import audit

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str


def _send_email(payload: ContactRequest) -> bool:
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        return False
    msg = EmailMessage()
    msg["Subject"] = f"[Setu contact] {payload.name}"
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = settings.CONTACT_EMAIL
    msg["Reply-To"] = payload.email
    msg.set_content(f"From: {payload.name} <{payload.email}>\n\n{payload.message}")
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as s:
            s.starttls(context=ctx)
            s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            s.send_message(msg)
        return True
    except Exception as e:
        logger.warning(f"Contact email failed: {e}")
        return False


@router.post("")
def submit_contact(payload: ContactRequest, db: Session = Depends(get_db)):
    sent = _send_email(payload)
    # Always record it so nothing is lost even if SMTP is off.
    audit(db, "contact.submit", actor=payload.email, meta={"name": payload.name, "sent": sent,
                                                           "message": payload.message[:500]})
    db.commit()
    return {"ok": True, "delivered": sent}
