"""Provider-agnostic speech-to-text.

Switch providers purely via env:
    VOICE_PROVIDER = sarvam | deepgram | elevenlabs | openai | none
    VOICE_API_KEY, VOICE_MODEL, VOICE_BASE_URL, VOICE_DEFAULT_LANGUAGE

With ``none`` (default) audio is still stored — it just isn't transcribed, which
is exactly what we want: the voice *sample* is the primary artefact (a family
identifies a relative by hearing them); the transcript is a bonus.
"""
from __future__ import annotations

from typing import Optional

import httpx
from loguru import logger

from app.core.config import settings


def transcribe(blob: bytes, content_type: str, language: Optional[str] = None) -> Optional[str]:
    provider = (settings.VOICE_PROVIDER or "none").lower()
    if provider == "none" or not settings.VOICE_API_KEY:
        return None
    lang = language or settings.VOICE_DEFAULT_LANGUAGE
    try:
        if provider == "deepgram":
            return _deepgram(blob, content_type, lang)
        if provider == "sarvam":
            return _sarvam(blob, content_type, lang)
        if provider == "elevenlabs":
            return _elevenlabs(blob, content_type)
        if provider == "openai":
            return _openai(blob, content_type, lang)
    except Exception as e:
        logger.warning(f"STT failed ({provider}): {e}")
        return None
    return None


def _deepgram(blob: bytes, content_type: str, lang: str) -> Optional[str]:
    model = settings.VOICE_MODEL or "nova-2"
    url = f"https://api.deepgram.com/v1/listen?model={model}&language={lang}&smart_format=true"
    headers = {"Authorization": f"Token {settings.VOICE_API_KEY}", "Content-Type": content_type}
    with httpx.Client(timeout=60) as c:
        r = c.post(url, content=blob, headers=headers)
        r.raise_for_status()
        return r.json()["results"]["channels"][0]["alternatives"][0]["transcript"] or None


# Valid Sarvam language codes (per docs) + a name->code map. Anything we can't
# confidently resolve becomes "unknown" so Sarvam AUTO-DETECTS the spoken language.
_SARVAM_CODES = {
    "unknown", "hi-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN",
    "te-IN", "en-IN", "gu-IN", "as-IN", "ur-IN", "ne-IN", "kok-IN", "ks-IN", "sd-IN",
    "sa-IN", "sat-IN", "mni-IN", "brx-IN", "mai-IN", "doi-IN",
}
_SARVAM_NAMES = {
    "english": "en-IN", "hindi": "hi-IN", "marathi": "mr-IN", "bengali": "bn-IN",
    "tamil": "ta-IN", "telugu": "te-IN", "gujarati": "gu-IN", "kannada": "kn-IN",
    "malayalam": "ml-IN", "punjabi": "pa-IN", "odia": "od-IN", "oriya": "od-IN",
    "assamese": "as-IN", "urdu": "ur-IN", "nepali": "ne-IN", "konkani": "kok-IN",
    "sanskrit": "sa-IN", "maithili": "mai-IN", "kashmiri": "ks-IN", "sindhi": "sd-IN",
    "santali": "sat-IN", "manipuri": "mni-IN", "bodo": "brx-IN", "dogri": "doi-IN",
}


def _sarvam_lang(lang: Optional[str]) -> str:
    if not lang:
        return "unknown"
    s = lang.strip()
    if s in _SARVAM_CODES:
        return s
    low = s.lower()
    if low in _SARVAM_NAMES:
        return _SARVAM_NAMES[low]
    cand = f"{low[:2]}-IN"
    if cand in _SARVAM_CODES:
        return cand
    return "unknown"  # let Sarvam auto-detect


def _sarvam(blob: bytes, content_type: str, lang: str) -> Optional[str]:
    base = settings.VOICE_BASE_URL or "https://api.sarvam.ai"
    model = settings.VOICE_MODEL or "saarika:v2.5"
    # Clean the content-type ("audio/webm;codecs=opus" -> "audio/webm") and ext.
    clean_ct = content_type.split(";")[0].strip() or "audio/webm"
    ext = (clean_ct.split("/")[-1] or "webm")
    files = {"file": (f"audio.{ext}", blob, clean_ct)}
    headers = {"api-subscription-key": settings.VOICE_API_KEY}

    # "saaras" models are speech-to-text-TRANSLATE (auto-detect → English text)
    # and live on a different endpoint; "saarika" models transcribe in-language.
    if model.lower().startswith("saaras"):
        endpoint, data = "/speech-to-text-translate", {"model": model}
    else:
        endpoint, data = "/speech-to-text", {"model": model, "language_code": _sarvam_lang(lang)}

    with httpx.Client(timeout=60) as c:
        r = c.post(f"{base}{endpoint}", files=files, data=data, headers=headers)
        if r.status_code >= 400:
            logger.warning(f"Sarvam {endpoint} {r.status_code}: {r.text[:300]}")
            r.raise_for_status()
        return r.json().get("transcript") or None


def _elevenlabs(blob: bytes, content_type: str) -> Optional[str]:
    model = settings.VOICE_MODEL or "scribe_v1"
    files = {"file": ("audio", blob, content_type)}
    data = {"model_id": model}
    headers = {"xi-api-key": settings.VOICE_API_KEY}
    with httpx.Client(timeout=60) as c:
        r = c.post("https://api.elevenlabs.io/v1/speech-to-text", files=files, data=data, headers=headers)
        r.raise_for_status()
        return r.json().get("text") or None


def _openai(blob: bytes, content_type: str, lang: str) -> Optional[str]:
    base = settings.VOICE_BASE_URL or "https://api.openai.com/v1"
    model = settings.VOICE_MODEL or "whisper-1"
    files = {"file": ("audio.webm", blob, content_type)}
    data = {"model": model, "language": lang.split("-")[0]}
    headers = {"Authorization": f"Bearer {settings.VOICE_API_KEY}"}
    with httpx.Client(timeout=60) as c:
        r = c.post(f"{base}/audio/transcriptions", files=files, data=data, headers=headers)
        r.raise_for_status()
        return r.json().get("text") or None
