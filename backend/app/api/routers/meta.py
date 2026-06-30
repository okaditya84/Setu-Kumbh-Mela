"""Public meta endpoints: health + client runtime config (no secrets)."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.llm.client import get_llm

router = APIRouter(tags=["meta"])


@router.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}


@router.get("/config")
def client_config():
    """Non-sensitive config the web/mobile clients read at startup.

    Never returns API keys - only feature flags and map defaults.
    """
    return {
        "app_name": settings.APP_NAME,
        "map": {
            "style_url": settings.MAP_STYLE_URL,  # may be null => clients use OSM raster
            "default_lat": settings.MAP_DEFAULT_LAT,
            "default_lng": settings.MAP_DEFAULT_LNG,
            "default_zoom": settings.MAP_DEFAULT_ZOOM,
        },
        "features": {
            "llm_enabled": get_llm().available,
            "voice_enabled": (settings.VOICE_PROVIDER or "none").lower() != "none",
            "tts_enabled": __import__("app.voice.tts", fromlist=["available"]).available(),
            "face_matching_enabled": (settings.FACE_PROVIDER or "none").lower() == "http",
        },
        "auth": {
            "public_signup_enabled": settings.PUBLIC_SIGNUP_ENABLED,
            # Public client id only (the secret never leaves the server).
            "google_client_id": settings.GOOGLE_CLIENT_ID or None,
        },
    }
