"""Load prompt templates from the ``prompts/`` directory (editable, not in code)."""
from __future__ import annotations

import os
from functools import lru_cache

_PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "prompts")


@lru_cache
def load_prompt(name: str) -> str:
    path = os.path.join(_PROMPTS_DIR, name)
    with open(path, encoding="utf-8") as f:
        return f.read()
