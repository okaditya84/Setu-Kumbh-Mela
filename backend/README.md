# Setu — Backend (FastAPI)

The unified cross-center Lost & Found engine: intake, probabilistic matching,
voice-first parsing, sync, geo intelligence, observability. Runs with **zero API
keys** (SQLite + deterministic matching); LLM and voice are optional add-ons.

## Run locally
```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional; defaults work as-is
uvicorn app.main:app --reload   # http://127.0.0.1:8000/docs
```
On first boot it seeds 3 demo operators and the 2,500 synthetic cases.

**Demo logins:** `admin / admin123` (admin) · `volunteer / volunteer123` (volunteer)

## Prove the matching accuracy
```bash
python -m scripts.eval_matcher --pairs 200
```
Injects known noisy pairs (dropped names, translated/drifted colours,
perspective-shifted wording, temporal drift) and reports recall@1/@5, MRR and
score separation. Current: **Recall@1 ≈ 87%, Recall@5 ≈ 97%**.

## Tests
```bash
python -m pytest -q
```

## Key endpoints (full contract in `docs/API.md`)
- `POST /api/v1/auth/login`
- `POST /api/v1/cases` → creates a case **and returns cross-center matches**
- `GET  /api/v1/cases/{id}/matches`
- `POST /api/v1/matches/decide` (confirm/reject → reunion)
- `POST /api/v1/intake/voice` · `POST /api/v1/intake/parse` (voice-first intake)
- `POST /api/v1/cases/{id}/voice` · `GET /api/v1/voice/{id}/audio`
- `POST /api/v1/cases/{id}/verify` (anti-impersonation secret check)
- `POST /api/v1/sync/push` · `GET /api/v1/sync/pull` (offline sync)
- `GET  /api/v1/geo/layers|hotspots|nearest-help|cases`
- `GET  /api/v1/admin/metrics|events` · `POST /api/v1/admin/purge`

## Architecture
See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
Matching internals live in `app/matching/` (normalize → blocking → scorer → engine).
Prompts are editable files in `prompts/`. All config is env-driven (`app/core/config.py`).
