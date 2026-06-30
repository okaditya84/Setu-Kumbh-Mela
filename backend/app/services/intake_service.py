"""Voice-first intake parsing.

A volunteer taps one big button and says, in Hindi/English/Hinglish:
  "ek lady hai, white saree pehni hai, 60-65 saal ki, Marathi bolti hai,
   Ramkund ke paas mili."
We transcribe it (provider-agnostic STT) and parse it into a structured draft
case the volunteer can confirm in one glance - no tedious form filling.

The parser tries the LLM (handles mixed-language, messy speech, background
chatter) and ALWAYS falls back to a deterministic extractor so it works offline.
"""
from __future__ import annotations

import re
from typing import Dict, Optional

from app.llm.client import get_llm
from app.llm.prompts import load_prompt
from app.llm.services import _parse_json
from app.matching.normalize import age_to_band, extract_descriptors

_FEMALE = re.compile(r"\b(woman|female|lady|girl|aurat|mahila|ladki|stri|budhiya|maa|mata|behen|wife|widow|saree|sari)\b", re.I)
_MALE = re.compile(r"\b(man|male|gentleman|boy|aadmi|purush|ladka|baba|baap|pita|husband|bhai|dada|dhoti|kurta)\b", re.I)


def _deterministic_parse(transcript: str, case_type: Optional[str]) -> Dict:
    desc = extract_descriptors(transcript)
    gender = None
    f, m = bool(_FEMALE.search(transcript)), bool(_MALE.search(transcript))
    if f and not m:
        gender = "Female"
    elif m and not f:
        gender = "Male"
    age_band = None
    if desc["age_years"] is not None:
        age_band = age_to_band(int(desc["age_years"]))
    return {
        "case_type": case_type,
        "person_name": None,
        "gender": gender,
        "age_band": age_band,
        "age_years_guess": desc["age_years"],
        "language": None,
        "state": None,
        "district": None,
        "last_seen_location": None,
        "physical_description": transcript.strip(),
        "colors": desc["colors"],
        "stable": desc["stable"],
        "confidence": 0.4,
    }


def parse_transcript(transcript: str, case_type: Optional[str] = None) -> Dict:
    """Return a structured draft for the intake form. Always succeeds."""
    base = _deterministic_parse(transcript, case_type)
    llm = get_llm()
    if llm.available and transcript.strip():
        prompt = load_prompt("parse_intake.txt")
        parsed = _parse_json(llm.chat(prompt, transcript, json_mode=True))
        if parsed:
            # LLM wins on fields it filled; keep deterministic where LLM left blank.
            for k, v in parsed.items():
                if v not in (None, [], ""):
                    base[k] = v
            if not base.get("age_band") and parsed.get("age_years_guess"):
                base["age_band"] = age_to_band(int(parsed["age_years_guess"]))
            base["source"] = "llm"
            return base
    base["source"] = "deterministic"
    return base
