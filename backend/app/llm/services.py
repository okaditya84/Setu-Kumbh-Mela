"""High-level LLM-assisted features. Every function degrades gracefully to a
deterministic result (or None) when no provider is configured.
"""
from __future__ import annotations

import json
from typing import Dict, List, Optional

from loguru import logger

from app.llm.client import get_llm
from app.llm.prompts import load_prompt


def _parse_json(text: Optional[str]) -> Optional[dict]:
    if not text:
        return None
    text = text.strip()
    # Tolerate code fences / leading prose.
    if "```" in text:
        text = text.split("```")[1].lstrip("json").strip() if text.count("```") >= 2 else text
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.debug("LLM JSON parse failed")
        return None


def enrich_attributes(description: Optional[str]) -> Optional[dict]:
    """LLM-enriched structured extraction. Returns None if unavailable."""
    if not description:
        return None
    llm = get_llm()
    if not llm.available:
        return None
    out = llm.chat(load_prompt("extract_attributes.txt"), description, json_mode=True)
    return _parse_json(out)


def explain_match(evidence: Dict) -> Optional[str]:
    llm = get_llm()
    if not llm.available:
        return None
    return llm.chat(load_prompt("match_explanation.txt"), json.dumps(evidence, ensure_ascii=False))


def pa_announcement(details: Dict, language: str = "Hindi") -> Optional[str]:
    llm = get_llm()
    if not llm.available:
        return None
    prompt = load_prompt("pa_announcement.txt").replace("{language}", language)
    return llm.chat(prompt, json.dumps(details, ensure_ascii=False))
