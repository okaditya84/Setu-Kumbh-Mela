"""Hashing, PII protection and JWT helpers.

Privacy-by-design: mobile numbers and secret answers are never stored in clear.
We keep a salted hash (for exact-match lookups / verification) plus a masked
display string (e.g. ``+91 98xxxxxx10``) so an operator can confirm a number a
family reads aloud without the full number sitting in the database.
"""
from __future__ import annotations

import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt

from app.core.config import settings

_DIGITS = re.compile(r"\D+")


# --------------------------- passwords --------------------------------------
def _b(raw: str) -> bytes:
    # bcrypt hard-limits the secret to 72 bytes; truncate deterministically.
    return raw.encode("utf-8")[:72]


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(_b(raw), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_b(raw), hashed.encode("utf-8"))
    except Exception:
        return False


# --------------------------- PII helpers ------------------------------------
def normalize_mobile(mobile: Optional[str]) -> Optional[str]:
    """Reduce a phone string to its trailing 10 digits (Indian mobiles)."""
    if not mobile:
        return None
    digits = _DIGITS.sub("", mobile)
    if len(digits) >= 10:
        return digits[-10:]
    return digits or None


def hash_pii(value: Optional[str]) -> Optional[str]:
    """Deterministic salted hash for exact-match lookups (e.g. phone matching)."""
    if not value:
        return None
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def mask_mobile(mobile: Optional[str]) -> Optional[str]:
    n = normalize_mobile(mobile)
    if not n or len(n) < 4:
        return None
    return f"{n[:2]}xxxx{n[-2:]}"


# --------------------------- JWT --------------------------------------------
def create_access_token(subject: str, extra: Optional[Dict[str, Any]] = None) -> str:
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
