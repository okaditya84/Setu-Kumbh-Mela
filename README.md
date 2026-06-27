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
```
Then see [`docs/`](docs/) for the web app, mobile app, env keys, and deployment.

## Roles
- **Volunteer** — voice/quick intake of missing & found, see ranked matches, reunite.
- **Admin / Control room** — live map, hotspots, metrics, audit feed, privacy purge.

## Status
Backend: complete + tested. Web + mobile clients and full docs: in progress.
