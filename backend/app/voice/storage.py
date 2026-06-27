"""Audio blob storage — pluggable backend.

* ``local`` (default): writes to ``VOICE_STORAGE_DIR`` on disk and serves bytes
  back through the API. Zero-config, free, perfect for the demo and an edge box.
* ``s3``: any S3-compatible bucket (Cloudflare R2 / Backblaze B2 free tier).
  Uses boto3, lazily imported so it is not a hard dependency for local runs.
"""
from __future__ import annotations

import os
from typing import Optional, Tuple

from app.core.config import settings


def _ensure_local_dir() -> str:
    os.makedirs(settings.VOICE_STORAGE_DIR, exist_ok=True)
    return settings.VOICE_STORAGE_DIR


def save(blob: bytes, key: str, content_type: str) -> Tuple[str, Optional[str]]:
    """Persist ``blob`` and return (storage_key, public_url_or_None)."""
    if settings.VOICE_STORAGE == "s3":
        return _save_s3(blob, key, content_type)
    path = os.path.join(_ensure_local_dir(), key)
    with open(path, "wb") as f:
        f.write(blob)
    return key, None  # local served via API endpoint, no public URL


def load(key: str) -> Optional[bytes]:
    if settings.VOICE_STORAGE == "s3":
        return _load_s3(key)
    path = os.path.join(settings.VOICE_STORAGE_DIR, key)
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return f.read()


# ------------------------------- S3 (optional) ------------------------------
def _s3_client():
    import boto3  # lazy import; only needed when VOICE_STORAGE=s3

    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )


def _save_s3(blob: bytes, key: str, content_type: str) -> Tuple[str, Optional[str]]:
    _s3_client().put_object(Bucket=settings.S3_BUCKET, Key=key, Body=blob, ContentType=content_type)
    url = f"{settings.S3_PUBLIC_BASE_URL.rstrip('/')}/{key}" if settings.S3_PUBLIC_BASE_URL else None
    return key, url


def _load_s3(key: str) -> Optional[bytes]:
    try:
        obj = _s3_client().get_object(Bucket=settings.S3_BUCKET, Key=key)
        return obj["Body"].read()
    except Exception:
        return None
