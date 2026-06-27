"""Provider-agnostic Text-to-Speech.

Browsers can only speak languages with an OS-installed voice — most Indian
languages have none, so a Gujarati announcement gets read in English. Serving
real synthesized audio fixes that. Sarvam (Bulbul) is supported now; ElevenLabs
is easy to add. Falls back to None (client then uses browser TTS) when no
provider/credentials are configured.
"""
from __future__ import annotations

import base64
from typing import Optional, Tuple

import httpx
from loguru import logger

from app.core.config import settings

# Sarvam Bulbul supported target languages (TTS).
_SARVAM_TTS_CODES = {"bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"}
_NAMES = {
    "english": "en-IN", "hindi": "hi-IN", "marathi": "mr-IN", "bengali": "bn-IN", "tamil": "ta-IN",
    "telugu": "te-IN", "gujarati": "gu-IN", "kannada": "kn-IN", "malayalam": "ml-IN",
    "punjabi": "pa-IN", "odia": "od-IN", "oriya": "od-IN",
}


def _provider() -> str:
    p = (settings.TTS_PROVIDER or "").lower()
    if p:
        return p
    # Auto: reuse the Sarvam voice credentials if present.
    if (settings.VOICE_PROVIDER or "").lower() == "sarvam":
        return "sarvam"
    return "none"


def _key() -> Optional[str]:
    return settings.TTS_API_KEY or settings.VOICE_API_KEY


def available() -> bool:
    return _provider() in ("sarvam", "elevenlabs") and bool(_key())


def _to_code(lang: Optional[str]) -> Optional[str]:
    if not lang:
        return None
    s = lang.strip()
    if s in _SARVAM_TTS_CODES:
        return s
    low = s.lower()
    if low in _NAMES and _NAMES[low] in _SARVAM_TTS_CODES:
        return _NAMES[low]
    cand = f"{low[:2]}-IN"
    return cand if cand in _SARVAM_TTS_CODES else None


def synthesize(text: str, language: Optional[str]) -> Optional[Tuple[bytes, str]]:
    """Return (audio_bytes, content_type) for the text, or None if unavailable/unsupported."""
    if not available() or not text:
        return None
    provider = _provider()
    try:
        if provider == "sarvam":
            return _sarvam(text, language)
        if provider == "elevenlabs":
            return _elevenlabs(text)
    except Exception as e:
        logger.warning(f"TTS failed ({provider}): {e}")
        return None
    return None


def _sarvam(text: str, language: Optional[str]) -> Optional[Tuple[bytes, str]]:
    code = _to_code(language)
    if not code:
        return None  # language not supported by Sarvam TTS → client falls back
    base = settings.TTS_BASE_URL or "https://api.sarvam.ai"
    model = settings.TTS_MODEL or "bulbul:v2"
    body = {
        "text": text[:1400],  # stay under bulbul:v2 limit
        "target_language_code": code,
        "model": model,
    }
    if settings.TTS_SPEAKER:
        body["speaker"] = settings.TTS_SPEAKER
    headers = {"api-subscription-key": _key() or "", "Content-Type": "application/json"}
    with httpx.Client(timeout=60) as c:
        r = c.post(f"{base}/text-to-speech", json=body, headers=headers)
        r.raise_for_status()
        audios = r.json().get("audios") or []
        if not audios:
            return None
        return base64.b64decode(audios[0]), "audio/wav"


def _elevenlabs(text: str) -> Optional[Tuple[bytes, str]]:
    voice = settings.TTS_SPEAKER or "21m00Tcm4TlvDq8ikWAM"
    model = settings.TTS_MODEL or "eleven_multilingual_v2"
    headers = {"xi-api-key": _key() or "", "Content-Type": "application/json"}
    body = {"text": text[:2000], "model_id": model}
    with httpx.Client(timeout=60) as c:
        r = c.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}", json=body, headers=headers)
        r.raise_for_status()
        return r.content, "audio/mpeg"
