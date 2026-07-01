"""Central configuration.

Every tunable value lives here and is overridable via environment variables
(or a .env file). Nothing operational is hard-coded elsewhere in the codebase.

The app is designed to boot and run the *critical path* (intake + matching +
sync) with ZERO external API keys. LLM and voice providers are strictly
optional enhancements that degrade gracefully when unconfigured.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List, Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # ----------------------------- App -----------------------------------
    APP_NAME: str = "Setu - Kumbh Lost & Found Network"
    APP_ENV: Literal["dev", "prod"] = "dev"
    API_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"

    # CORS: comma-separated origins, or "*" for any (dev only).
    CORS_ORIGINS: str = "*"

    # ----------------------------- Rate limiting --------------------------
    # Per-client-IP token bucket. Tunable at runtime by an admin via
    # PATCH /admin/rate-limits (held in memory; env sets the defaults).
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_RPM: int = 240          # general requests/min/IP
    RATE_LIMIT_AUTH_RPM: int = 15      # stricter for /auth/login (brute-force)
    RATE_LIMIT_WRITE_RPM: int = 60     # stricter for POST/PATCH writes
    TRACE_BUFFER_SIZE: int = 1000      # recent requests kept for the admin trace feed

    # ----------------------------- Database -------------------------------
    # SQLite by default (zero-config, perfect for the demo + offline edge box).
    # For production, set DATABASE_URL to a Postgres URL (Render/Supabase free tier).
    DATABASE_URL: str = "sqlite:///./setu.db"

    # ----------------------------- Security -------------------------------
    # Used to sign JWTs and to hash PII (mobile numbers, secret answers).
    SECRET_KEY: str = "change-me-in-production-please-32chars-min"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MINUTES: int = 60 * 12

    # Privacy: auto-purge personally identifiable data this many hours after a
    # case is marked Reunited. The non-identifying record is retained for stats.
    PII_PURGE_AFTER_HOURS: int = 72

    # ----------------------------- Public accounts ----------------------
    # Lets ordinary people (families) self-register an email/password account so
    # they can report a missing relative themselves. These are NON-admin,
    # NON-volunteer accounts (role="public"); admin/volunteer logins stay private.
    PUBLIC_SIGNUP_ENABLED: bool = True
    SIGNUP_DEFAULT_ROLE: str = "public"

    # ----------------------------- Google OAuth -------------------------
    # Optional "Continue with Google" sign-in. Leave blank to disable the button.
    # GOOGLE_CLIENT_ID must match the OAuth 2.0 Web client created in the GCP
    # console; the server verifies Google ID tokens against it. The same value is
    # exposed to the web client via NEXT_PUBLIC_GOOGLE_CLIENT_ID.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ----------------------------- Seed / data ---------------------------
    DATA_DIR: str = "data"
    SEED_ON_STARTUP: bool = True  # load reference geo + (optionally) sample cases
    SEED_SAMPLE_CASES: bool = True  # load the 2,500 synthetic missing-person rows
    # On top of the official 2,500, generate a realistic, diverse population
    # (both missing AND found, planted true cross-center pairs) up to this total.
    SEED_TARGET_TOTAL: int = 9000
    SEED_FOUND_RATIO: float = 0.40       # share of generated cases that are "found"
    SEED_PLANTED_PAIRS: int = 350        # true missing/found pairs to plant

    # ----------------------------- LLM (optional) -------------------------
    # provider: openai | anthropic | gemini | openrouter | deepseek | groq |
    #           together | ollama | none
    # "none" => deterministic fallbacks everywhere; system stays fully functional.
    LLM_PROVIDER: str = "none"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_API_KEY: Optional[str] = None
    # Override base URL for any OpenAI-compatible gateway (openrouter/deepseek/
    # groq/together/ollama/local). Leave blank to use the provider default.
    LLM_BASE_URL: Optional[str] = None
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: int = 1024
    LLM_TIMEOUT_SECONDS: float = 30.0
    # Use the LLM to rephrase the top match explanation. Turn off to save cost /
    # latency (the deterministic explanation is always present as a fallback).
    MATCH_LLM_EXPLANATIONS: bool = True
    # Re-run LLM attribute extraction when a case is CREATED. Off by default: the
    # voice intake path (/intake/parse) already does LLM extraction, and the
    # deterministic normalizer covers structured submits - so this would be a
    # redundant per-report LLM call on the hot path. Enable only if desired.
    INTAKE_LLM_ENRICH: bool = False

    # ----------------------------- Voice (optional) -----------------------
    # provider: sarvam | deepgram | elevenlabs | openai | none
    VOICE_PROVIDER: str = "none"
    VOICE_API_KEY: Optional[str] = None
    VOICE_MODEL: Optional[str] = None  # provider-specific, e.g. "saarika:v2", "nova-2"
    VOICE_BASE_URL: Optional[str] = None
    VOICE_DEFAULT_LANGUAGE: str = "hi"
    # Storage backend for audio blobs: "local" (disk) or "s3" (S3-compatible).
    VOICE_STORAGE: Literal["local", "s3"] = "local"
    VOICE_STORAGE_DIR: str = "data/voice"
    # S3-compatible (optional, e.g. Cloudflare R2 / Backblaze B2 free tier)
    S3_ENDPOINT_URL: Optional[str] = None
    S3_BUCKET: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_PUBLIC_BASE_URL: Optional[str] = None

    # ----------------------------- Face embeddings (optional) -------------
    # Turns a photo into a vector so face similarity becomes a dominant matching
    # signal. provider: none | http
    #   http -> POST the image to an embedding service that returns a vector.
    # Default "none": photos are still captured, shown and used for HUMAN
    # identification (families recognise by sight) - just not auto-embedded.
    # Kept off by default so the free-tier deploy stays light (no heavy model).
    FACE_PROVIDER: str = "none"
    FACE_API_URL: Optional[str] = None     # e.g. a hosted face-embedding endpoint
    FACE_API_KEY: Optional[str] = None
    FACE_MODEL: Optional[str] = None
    FACE_TIMEOUT_SECONDS: float = 30.0
    # Face similarity weights (dominant when both sides have a photo embedding).
    W_FACE_MATCH: float = 9.0       # cosine >= FACE_STRONG_SIM => near-certain
    W_FACE_MISMATCH: float = -6.0   # both have faces but clearly different
    FACE_STRONG_SIM: float = 0.82
    FACE_WEAK_SIM: float = 0.55

    # ----------------------------- Text-to-Speech (optional) --------------
    # Speaks announcements in real Indian-language audio (browsers lack most
    # Indian TTS voices). provider: sarvam | elevenlabs | none | "" (auto).
    # When blank, falls back to the Sarvam VOICE_* credentials if available.
    TTS_PROVIDER: str = ""
    TTS_API_KEY: Optional[str] = None
    TTS_MODEL: Optional[str] = None        # e.g. "bulbul:v2"
    TTS_SPEAKER: Optional[str] = None       # e.g. "anushka"
    TTS_BASE_URL: Optional[str] = None

    # ----------------------------- Contact / SMTP (optional) --------------
    # Powers the website Contact form. Leave blank to disable sending (messages
    # are still logged to the audit feed). For Gmail use an App Password.
    CONTACT_EMAIL: str = "adityajethani11@gmail.com"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None

    # ----------------------------- Maps -----------------------------------
    # The web/mobile clients use OpenStreetMap (no key). A MapTiler/Stadia key
    # is optional for prettier vector tiles; clients read this from /api/v1/config.
    MAP_STYLE_URL: Optional[str] = None  # e.g. a MapTiler style URL with key
    MAP_DEFAULT_LAT: float = 19.9975
    MAP_DEFAULT_LNG: float = 73.7898
    MAP_DEFAULT_ZOOM: float = 12.0

    # ----------------------------- Matching weights -----------------------
    # Fellegi-Sunter style log-likelihood weights. These are the *defaults*;
    # they are meant to be re-estimated from real reunification outcomes.
    # See app/matching/scorer.py for how they are applied.
    W_GENDER_AGREE: float = 2.2
    W_GENDER_DISAGREE: float = -4.0       # strong (near-veto) disagreement
    W_AGEBAND_AGREE: float = 2.0
    W_AGEBAND_ADJACENT: float = 0.6       # neighbouring band (e.g. 61-70 vs 71-80)
    W_AGEBAND_DISAGREE: float = -1.5
    W_LANGUAGE_AGREE: float = 1.8
    W_LANGUAGE_DISAGREE: float = -0.6
    W_STATE_AGREE: float = 1.4
    W_DISTRICT_AGREE: float = 1.0
    W_NAME_STRONG: float = 4.0            # exact/nickname name-token match: strong evidence
    W_NAME_WEAK: float = 1.2
    W_NAME_DISAGREE: float = -0.8
    W_MOBILE_EXACT: float = 8.0           # exact phone => near-certain identity
    W_GEO_NEAR: float = 1.6               # last-seen within GEO_NEAR_KM
    W_GEO_FAR: float = -0.8
    W_DESC_COLOR: float = 0.5             # clothing colour (transient => low)
    W_DESC_STABLE: float = 1.5            # stable descriptors (stick, blind, etc.)
    W_DESC_SEMANTIC: float = 1.0          # LLM/text semantic similarity bonus

    GEO_NEAR_KM: float = 1.5
    GEO_FAR_KM: float = 6.0
    TIME_WINDOW_HOURS: float = 48.0       # plausible report-time separation
    # Temporal drift: clothing-colour weight decays toward zero as the time gap
    # between the two reports grows (white at 8am looks grey by 4pm).
    COLOR_DRIFT_HALFLIFE_HOURS: float = 8.0

    # Logistic calibration mapping total evidence weight -> 0..1 probability:
    #   p = 1 / (1 + exp(-(W - OFFSET) / SCALE))
    # Defaults are sensible; ``scripts/eval_matcher.py`` reports the achieved
    # separation and can recommend re-calibrated values from labelled pairs.
    MATCH_PROB_OFFSET: float = 6.0
    MATCH_PROB_SCALE: float = 2.5

    # Decision thresholds on the normalised 0..1 match probability.
    MATCH_AUTO_THRESHOLD: float = 0.82    # show as "strong match"
    MATCH_REVIEW_THRESHOLD: float = 0.55  # show as "possible match"
    MATCH_MAX_CANDIDATES: int = 25
    # Candidates below this probability are noise - never shown to the operator
    # (kills the "everyone is an 8% match" effect on a thin query).
    MATCH_DISPLAY_FLOOR: float = 0.40
    # A cross-center match at/above this probability raises notifications to BOTH
    # the missing and found reporting centers.
    NOTIFY_THRESHOLD: float = 0.50
    # If more than this many candidates cluster above the review threshold with
    # little score separation, the engine asks disambiguating questions instead
    # of dumping a long list.
    DISAMBIGUATION_TRIGGER_COUNT: int = 8
    DISAMBIGUATION_MARGIN: float = 0.08

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origin_list(self) -> List[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
