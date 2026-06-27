"""Public UI translation endpoint (dynamic, LLM-backed, cached)."""
from __future__ import annotations

from fastapi import APIRouter

from app.services.i18n_service import LANG_NAMES, get_dict

router = APIRouter(prefix="/i18n", tags=["i18n"])


@router.get("/languages")
def languages():
    """Languages the UI can render (English + every name we can translate to)."""
    langs = [{"code": "en", "name": "English"}]
    langs += [{"code": c, "name": n} for c, n in LANG_NAMES.items()]
    return {"languages": langs}


@router.get("/{lang}")
def dictionary(lang: str):
    return get_dict(lang)
