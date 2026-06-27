"""Provider-agnostic LLM client.

One interface, many providers, selected entirely by environment variables:

    LLM_PROVIDER = openai | anthropic | gemini | openrouter | deepseek |
                   groq | together | ollama | none
    LLM_MODEL, LLM_API_KEY, LLM_BASE_URL, LLM_TEMPERATURE, LLM_MAX_TOKENS

OpenAI/OpenRouter/DeepSeek/Groq/Together/Ollama all speak the OpenAI
chat-completions dialect, so they share one adapter (only the base URL changes).
Anthropic and Gemini have dedicated adapters.

Design rule: the LLM is *never* on the critical path. ``LLM_PROVIDER=none`` (the
default) makes ``available`` False and every caller falls back to deterministic
behaviour. Any network/parse error returns ``None`` rather than raising.
"""
from __future__ import annotations

from typing import Dict, Optional

import httpx
from loguru import logger

from app.core.config import settings

# Default base URLs for OpenAI-compatible gateways.
_OPENAI_COMPATIBLE_BASES = {
    "openai": "https://api.openai.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "together": "https://api.together.xyz/v1",
    "ollama": "http://localhost:11434/v1",
}


class LLMClient:
    def __init__(self) -> None:
        self.provider = (settings.LLM_PROVIDER or "none").lower()
        self.model = settings.LLM_MODEL
        self.api_key = settings.LLM_API_KEY
        self.base_url = settings.LLM_BASE_URL
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.timeout = settings.LLM_TIMEOUT_SECONDS

    @property
    def available(self) -> bool:
        if self.provider in ("none", "", None):
            return False
        if self.provider == "ollama":
            return True  # local, no key needed
        return bool(self.api_key)

    def chat(self, system: str, user: str, json_mode: bool = False) -> Optional[str]:
        if not self.available:
            return None
        try:
            if self.provider == "anthropic":
                return self._anthropic(system, user)
            if self.provider == "gemini":
                return self._gemini(system, user, json_mode)
            return self._openai_compatible(system, user, json_mode)
        except Exception as e:  # never break the caller
            logger.warning(f"LLM call failed ({self.provider}): {e}")
            return None

    # ---------------------------------------------------------------- adapters
    def _openai_compatible(self, system: str, user: str, json_mode: bool) -> Optional[str]:
        base = self.base_url or _OPENAI_COMPATIBLE_BASES.get(self.provider, _OPENAI_COMPATIBLE_BASES["openai"])
        body: Dict = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        if self.provider == "openrouter":
            headers["HTTP-Referer"] = "https://github.com/okaditya84/CIL_Kumbh_Mela"
            headers["X-Title"] = "Setu Kumbh Lost & Found"
        with httpx.Client(timeout=self.timeout) as c:
            r = c.post(f"{base}/chat/completions", json=body, headers=headers)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    def _anthropic(self, system: str, user: str) -> Optional[str]:
        base = self.base_url or "https://api.anthropic.com/v1"
        body = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        headers = {
            "x-api-key": self.api_key or "",
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=self.timeout) as c:
            r = c.post(f"{base}/messages", json=body, headers=headers)
            r.raise_for_status()
            parts = r.json().get("content", [])
            return "".join(p.get("text", "") for p in parts if p.get("type") == "text") or None

    def _gemini(self, system: str, user: str, json_mode: bool) -> Optional[str]:
        base = self.base_url or "https://generativelanguage.googleapis.com/v1beta"
        gen: Dict = {"temperature": self.temperature, "maxOutputTokens": self.max_tokens}
        if json_mode:
            gen["responseMimeType"] = "application/json"
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": gen,
        }
        url = f"{base}/models/{self.model}:generateContent?key={self.api_key}"
        with httpx.Client(timeout=self.timeout) as c:
            r = c.post(url, json=body, headers={"Content-Type": "application/json"})
            r.raise_for_status()
            cands = r.json().get("candidates", [])
            if not cands:
                return None
            return "".join(p.get("text", "") for p in cands[0]["content"]["parts"])


_client: Optional[LLMClient] = None


def get_llm() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client
