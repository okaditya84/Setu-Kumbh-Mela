"""Optional face-embedding layer.

A photo is turned into a vector by an external, env-configured embedding service
(``FACE_PROVIDER=http``). Face cosine similarity then becomes a dominant matching
signal (see scorer.py). When ``FACE_PROVIDER=none`` (default) this is inert and
photos are used purely for human recognition — keeping the free-tier deploy light
and never putting a heavy model on the critical path.

The HTTP contract is intentionally simple so it works with most hosted services:
  POST {FACE_API_URL}  (Authorization: Bearer {FACE_API_KEY} if set)
  body: {"image": "<base64 jpeg, no data: prefix>", "model": "<FACE_MODEL>"}
  200: {"embedding": [floats]}   (also accepts {"vector": [...]} / {"data":[{"embedding":[...]}]})
"""
from __future__ import annotations

import base64
import math
import re
from typing import List, Optional

import httpx
from loguru import logger

from app.core.config import settings

_DATA_URL = re.compile(r"^data:image/[^;]+;base64,", re.I)


def available() -> bool:
    return (settings.FACE_PROVIDER or "none").lower() == "http" and bool(settings.FACE_API_URL)


def _to_b64(photo: str) -> Optional[str]:
    """Accept a data URL or a raw base64 string; return bare base64."""
    if not photo:
        return None
    if _DATA_URL.match(photo):
        return _DATA_URL.sub("", photo)
    if photo.startswith("http"):
        return None  # remote URL: a real service would fetch it; out of scope here
    return photo  # assume already base64


def embed(photo: Optional[str]) -> Optional[List[float]]:
    """Return a face embedding for a data-URL/base64 image, or None."""
    if not available() or not photo:
        return None
    b64 = _to_b64(photo)
    if not b64:
        return None
    try:
        headers = {"Content-Type": "application/json"}
        if settings.FACE_API_KEY:
            headers["Authorization"] = f"Bearer {settings.FACE_API_KEY}"
        body = {"image": b64}
        if settings.FACE_MODEL:
            body["model"] = settings.FACE_MODEL
        with httpx.Client(timeout=settings.FACE_TIMEOUT_SECONDS) as c:
            r = c.post(settings.FACE_API_URL, json=body, headers=headers)
            r.raise_for_status()
            j = r.json()
        vec = j.get("embedding") or j.get("vector")
        if vec is None and isinstance(j.get("data"), list) and j["data"]:
            vec = j["data"][0].get("embedding")
        if isinstance(vec, list) and vec and all(isinstance(x, (int, float)) for x in vec):
            return [float(x) for x in vec]
    except Exception as e:
        logger.warning(f"Face embed failed: {e}")
    return None


def cosine(a: Optional[List[float]], b: Optional[List[float]]) -> Optional[float]:
    if not a or not b or len(a) != len(b):
        return None
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return None
    return dot / (na * nb)
