"""Dynamic UI translations — nothing hard-coded per language.

There is exactly ONE source of truth: ``app/i18n/base_en.json`` (English).
Any other language is produced on demand by the configured LLM and cached to
disk + memory, so adding a language needs ZERO code or new files — the client
just asks for it. With no LLM configured it gracefully returns English.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Dict, Optional

from loguru import logger

from app.core.config import settings
from app.llm.client import get_llm
from app.llm.services import _parse_json

_BASE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "i18n", "base_en.json")
_CACHE_DIR = os.path.join(settings.DATA_DIR, "i18n_cache")
_mem: Dict[str, Dict[str, str]] = {}

# Human-readable names for the LLM prompt (extend freely; unknown codes still work).
LANG_NAMES = {
    "hi": "Hindi", "mr": "Marathi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
    "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi", "or": "Odia",
    "as": "Assamese", "ur": "Urdu", "sa": "Sanskrit", "ne": "Nepali", "kok": "Konkani",
    "mai": "Maithili", "bho": "Bhojpuri", "awa": "Awadhi",
}

_SYS = (
    "You are a professional UI localizer for an Indian lost-and-found app used by "
    "volunteers, police and families. Translate the VALUES of the given JSON into {lang} "
    "using the correct native script. Keep every KEY exactly the same. Preserve "
    "placeholders like {{n}} and {{center}} verbatim. Keep strings short and natural for "
    "buttons and labels. Do not translate the app name 'Setu'. Output ONLY one valid JSON "
    "object — no prose, no markdown."
)


@lru_cache
def base_dict() -> Dict[str, str]:
    with open(_BASE_PATH, encoding="utf-8") as f:
        return json.load(f)


def _cache_file(lang: str) -> str:
    return os.path.join(_CACHE_DIR, f"{lang}.json")


def _load_file(lang: str) -> Optional[Dict[str, str]]:
    p = _cache_file(lang)
    if os.path.exists(p):
        try:
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def _save_file(lang: str, d: Dict[str, str]) -> None:
    os.makedirs(_CACHE_DIR, exist_ok=True)
    with open(_cache_file(lang), "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)


def _translate(lang: str) -> Optional[Dict[str, str]]:
    """Translate the whole base dict in small chunks (fast + avoids timeouts)."""
    llm = get_llm()
    if not llm.available:
        return None
    name = LANG_NAMES.get(lang, lang)
    base = base_dict()
    items = list(base.items())
    chunk = 30
    result: Dict[str, str] = {}
    any_ok = False
    for i in range(0, len(items), chunk):
        part = dict(items[i:i + chunk])
        out = llm.chat(_SYS.replace("{lang}", name), json.dumps(part, ensure_ascii=False),
                       json_mode=True, max_tokens=4000)
        parsed = _parse_json(out)
        if parsed:
            any_ok = True
            for k in part:
                result[k] = parsed.get(k) or part[k]
        else:
            for k in part:
                result[k] = part[k]  # English fallback for this chunk
    if not any_ok:
        logger.warning(f"i18n translate produced nothing for {lang}")
        return None
    return result


def get_dict(lang: str) -> Dict[str, object]:
    lang = (lang or "en").lower()
    if lang == "en":
        return {"lang": "en", "source": "base", "dict": base_dict()}
    if lang in _mem:
        return {"lang": lang, "source": "cache", "dict": _mem[lang]}
    cached = _load_file(lang)
    if cached:
        _mem[lang] = cached
        return {"lang": lang, "source": "cache", "dict": cached}
    translated = _translate(lang)
    if translated:
        _mem[lang] = translated
        _save_file(lang, translated)
        return {"lang": lang, "source": "llm", "dict": translated}
    # Graceful fallback: English (clients still render).
    return {"lang": lang, "source": "fallback-en", "dict": base_dict()}
