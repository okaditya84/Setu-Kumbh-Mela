"""PA announcement generation.

LLM path produces a fluent announcement in *any* language. Without an LLM we
fall back to a deterministic template (English + a few built-in Indian-language
templates), so the feature still works fully offline - just less fluently.
"""
from __future__ import annotations

from typing import Optional

from app.db.models import Case
from app.llm.services import pa_announcement
from app.schemas.models import AnnouncementResponse

# Minimal offline templates. {age}/{gender}/{lang}/{center} are filled in.
_TEMPLATES = {
    "English": "Attention please. A {gender} person, approximately {age}, speaking {lang}, is safe at {center}. Family members may come to {center} to reunite.",
    "Hindi": "कृपया ध्यान दें। {lang} बोलने वाले लगभग {age} आयु के एक {gender} व्यक्ति {center} पर सुरक्षित हैं। परिजन {center} पर आकर मिल सकते हैं।",
    "Marathi": "कृपया लक्ष द्या. {lang} बोलणारी सुमारे {age} वयाची एक {gender} व्यक्ती {center} येथे सुरक्षित आहे. कुटुंबीयांनी {center} येथे यावे.",
}

_GENDER = {"Male": {"English": "male", "Hindi": "पुरुष", "Marathi": "पुरुष"},
           "Female": {"English": "female", "Hindi": "महिला", "Marathi": "महिला"}}


def _template(case: Case, language: str) -> str:
    tpl = _TEMPLATES.get(language, _TEMPLATES["English"])
    gender = _GENDER.get(case.gender or "", {}).get(language, case.gender or "person")
    return tpl.format(
        gender=gender,
        age=case.age_band or "unknown age",
        lang=case.language or "unknown language",
        center=case.reporting_center or "the nearest lost-and-found center",
    )


def make_announcement(case: Case, language: Optional[str] = None) -> AnnouncementResponse:
    lang = language or case.language or "Hindi"
    details = {
        "gender": case.gender,
        "age_band": case.age_band,
        "language": case.language,
        "wearing": (case.normalized or {}).get("colors", []),
        "center": case.reporting_center,
        "last_seen": case.last_seen_location,
    }
    text = pa_announcement(details, lang)
    if text:
        return AnnouncementResponse(language=lang, text=text.strip(), generated_by="llm")
    return AnnouncementResponse(language=lang, text=_template(case, lang), generated_by="template")
