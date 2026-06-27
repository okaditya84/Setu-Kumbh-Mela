# Setu — Kumbh Lost & Found Network

> A unified, **offline-first**, **multilingual**, cross-center lost-and-found
> system for the Nashik–Trimbakeshwar Simhastha Kumbh Mela 2027.
> Built for Claude Impact Lab, Mumbai 2026.

## The problem
80M+ pilgrims; ~200–300 people separated **every day**, mostly elderly and
children. Today each lost-and-found center is an **island** — a person found at
Center A is invisible to a family searching at Center B. Networks collapse at
peak density. The at-risk group has no smartphone and speaks many languages.

## The solution
One shared registry across all centers with an intelligent **matching engine**
that links a *found* person to a *missing* report the instant either is filed —
robust to missing names, missing phones, wrong descriptions, and cross-language
clothing terms. Operated by volunteers on behalf of the phoneless, working even
with no network, in any Indian language, with a **one-tap voice intake**.

## What makes it credible (not a generic chatbot)
- **Measured accuracy:** Recall@1 ≈ 87%, Recall@5 ≈ 97% on injected noisy pairs
  (`backend/scripts/eval_matcher.py`) — an honest, reproducible proof.
- **Critical path needs no internet and no LLM** — deterministic, offline-safe.
- **Privacy by design** — mobiles hashed + masked, secret-answer verification to
  stop impersonation/abduction, auto-purge of PII after reunion.
- **Uses the real geography** — chokepoint separation-risk hotspots, CCTV
  coverage, nearest-police routing, live case map.

## Monorepo layout
```
backend/   FastAPI engine (matching, voice, sync, geo, observability)  — see backend/README.md
web/       Next.js PWA console (Vercel) — operator + admin, offline-first, multilingual
mobile/    Flutter app (Android now, iOS-ready) — voice-first field intake
docs/      ARCHITECTURE, API contract, ENV_SETUP (how to get every key), deploy guides
data/      reference datasets (CSV + KML)
```

## Quick start
```bash
# Backend (works with zero keys)
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt && uvicorn app.main:app --reload

# Web (new terminal)
cd web && npm install && npm run dev   # set NEXT_PUBLIC_API_BASE in .env.local

# …or the whole stack at once
docker compose up --build
```
Demo logins: `volunteer / volunteer123` · `admin / admin123`.

## Docs
- [`docs/ENV_SETUP.md`](docs/ENV_SETUP.md) — get every API key (non-technical, step-by-step)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it all fits + the matching pipeline
- [`docs/API.md`](docs/API.md) — the API contract (web + mobile)
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Render + Vercel + APK + Docker

## Identification is media-first
For the at-risk group (elderly, children), photo + voice are the most reliable
identifiers. Both ways: a family describes/records their relative and the system
surfaces candidate **photos to see and voice samples to hear** for confirmation;
a found person's photo + voice are captured at the desk. An optional, env-pluggable
face-embedding layer turns photos into a dominant automated matching signal too.

## Roles
- **Volunteer** — voice/quick intake of missing & found, see ranked matches, reunite.
- **Admin / Control room** — live map, hotspots, metrics, audit feed, privacy purge.

## Status
Backend (tested), web PWA, Flutter app, and full docs: complete. Optional LLM,
voice STT and face-embedding providers are env-pluggable and off by default.
