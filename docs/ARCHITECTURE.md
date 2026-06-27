# Architecture

```
┌────────────────────┐     ┌────────────────────┐
│  Web PWA (Next.js)  │     │  Mobile (Flutter)  │   operators / control room
│  offline IndexedDB  │     │  offline sqflite   │
└─────────┬──────────┘     └─────────┬──────────┘
          │  HTTPS (JWT)               │  HTTPS (JWT)
          └──────────────┬─────────────┘
                         ▼
              ┌────────────────────────┐
              │   FastAPI backend      │
              │  ┌──────────────────┐  │
              │  │ Matching engine  │  │  normalize → block → score → engine
              │  ├──────────────────┤  │
              │  │ Intake / Voice   │  │  STT + LLM parse (provider-agnostic)
              │  │ Sync (idempotent)│  │
              │  │ Geo intelligence │  │  gazetteer, hotspots, routing
              │  │ Observability    │  │  metrics + audit feed
              │  └──────────────────┘  │
              └───────────┬────────────┘
                          ▼
              SQLite (default) / Postgres (prod)
```

## Why this shape
- **One backend, two clients, identical API.** Web and mobile call the same
  endpoints (`docs/API.md`), so behaviour and matching are consistent.
- **The critical path is deterministic and offline-safe.** Intake, matching and
  sync never require an LLM or the internet. LLM/voice providers are optional
  enhancements wrapped so any failure degrades gracefully.

## The matching pipeline (`backend/app/matching/`)
1. **normalize.py** — turn free text into structured, comparable fields:
   cross-language clothing colours (safed/vellai/shada → white), stable vs
   transient descriptors, nickname expansion (Raju → rajesh/rajendra…), child
   age from phrases.
2. **blocking.py** — fetch only plausible candidates (opposite case type, open
   status, compatible gender, equal/adjacent age band). Turns O(n²) into a few
   hundred comparisons → sub-second at Kumbh scale. An exact hashed-mobile hit
   bypasses blocking entirely.
3. **scorer.py** — Fellegi–Sunter weighted evidence. Missing fields contribute
   nothing (no imputation, no penalty). Clothing colour decays with the time gap
   between reports (temporal drift); stable traits keep full weight; a gender
   clash near-vetoes. Total weight → calibrated logistic → 0..1 probability with
   a per-field breakdown.
4. **engine.py** — rank, tier (strong/possible/weak), and if a large low-margin
   cluster forms, return **disambiguation questions** instead of a long list.

Accuracy is proven by `backend/scripts/eval_matcher.py` (injected noisy pairs):
**Recall@1 ≈ 87%, Recall@5 ≈ 97%, MRR ≈ 0.92.**

## Offline-first & sync
Clients write intake to a local store (IndexedDB / sqflite) tagged with a
`client_uuid`. A background syncer replays the queue when connectivity returns.
The server upserts by `client_uuid`, so retries on a flaky 2G link never create
duplicates — the exact problem the system exists to prevent.

## Privacy by design
- Mobile numbers stored **hashed + masked** (`98xxxx10`), never in clear.
- Secret-answer **hash** only (anti-impersonation verification).
- **Auto-purge** of identifying fields after a configurable window post-reunion;
  non-identifying attributes are kept for statistics.
- JWT auth + role gates (volunteer/admin); every action written to an audit log.

## Configuration
All operational values live in `backend/app/core/config.py` and are env-driven.
Prompts are editable files in `backend/prompts/`. Provider selection (LLM, STT,
storage, DB, maps) is entirely environment-based — no code changes to switch.

## Scale path
SQLite for the demo / an offline edge box. For the live event, set
`DATABASE_URL` to Postgres (+ PostGIS for a spatial blocking index) — the code is
storage-agnostic, so it's a config change, not a rewrite.
