# API contract (`/api/v1`)

Shared by the web and mobile clients. Auth is a JWT bearer token from
`/auth/login`. All times ISO-8601. Base path prefix: `/api/v1`.

## Auth
### `POST /auth/login`
```json
{ "username": "volunteer", "password": "volunteer123" }
→ { "access_token": "...", "token_type": "bearer", "role": "volunteer", "center": "...", "full_name": "..." }
```
Send `Authorization: Bearer <token>` on every other call.

## Meta (public)
- `GET /health` → `{ "status": "ok" }`
- `GET /config` → client config (map defaults, feature flags). No secrets.

## Cases
### `POST /cases` — create a case AND get matches in one call
Body (`CaseCreate`): `case_type` (`missing`|`found`), optional `client_uuid`,
`person_name`, `gender`, `age_band`, `state`, `district`, `language`,
`last_seen_location`, `last_seen_lat/lng`, `physical_description`,
`reporting_center`, `reporter_mobile`, `photo_url`, `secret_question`,
`secret_answer`, `remarks`, `reported_at`.
Returns a **`MatchResponse`** (see below). Idempotent on `client_uuid`.

### Other case endpoints
- `GET /cases?case_type=&status=&q=&limit=&offset=` → `CaseOut[]`
- `GET /cases/{id}` → `CaseOut`
- `GET /cases/{id}/matches` → `MatchResponse`
- `PATCH /cases/{id}/status` `{ "status": "Reunited", "matched_case_id?": "..." }` → `CaseOut`
- `GET /cases/{id}/announcement?language=Hindi` → `{ language, text, generated_by }`

`CaseOut` exposes `reporter_mobile_masked` (e.g. `98xxxx10`), `has_secret`,
`secret_question` (the question only), `photo_url`, `normalized` — never the raw
phone or the secret answer.

## Matching
`MatchResponse`:
```json
{
  "query_case_id": "…",
  "candidates": [
    { "case": CaseOut, "score": 12.3, "probability": 0.87, "tier": "strong",
      "breakdown": [{ "field": "geo", "detail": "last seen ~0.5 km apart", "weight": 1.4 }],
      "explanation": "87% likely the same person — both Female; both speak Marathi; …" }
  ],
  "needs_disambiguation": false,
  "disambiguation_questions": [{ "field": "language", "question": "…", "options": ["…"] }],
  "total_considered": 49
}
```
- `POST /matches/decide` `{ missing_case_id, found_case_id, decision }` (`confirm`|`reject`).
  Confirm marks both cases Reunited.
- `GET /matches?status=&limit=` → suggested/confirmed/rejected links.

## Voice-first intake
- `POST /intake/parse` `{ transcript, case_type? }` → `{ transcript, draft }`
  (`draft` is a structured `CaseCreate`-shaped object the client confirms).
- `POST /intake/voice` (multipart `file`, `case_type`, `language`) → transcribes
  server-side then parses. If server STT is off, returns `stt_available:false`
  so the client uses on-device transcription + `/intake/parse`.

## Voice samples & verification
- `POST /cases/{id}/voice` (multipart `file`, `kind`=`description`|`secret_answer`,
  `language`) → `VoiceOut`.
- `GET /cases/{id}/voice` → `VoiceOut[]`  ·  `GET /voice/{sampleId}/audio` → audio bytes.
- `POST /cases/{id}/verify` `{ answer }` → `{ verified, message }` (anti-impersonation).

## Offline sync
- `POST /sync/push` `{ cases: CaseCreate[] }` → per-item `{ client_uuid, server_id, case_id, status }`.
  Idempotent by `client_uuid` (retries never duplicate).
- `GET /sync/pull?since=<iso>&limit=` → cases updated since a timestamp.

## Geo
- `GET /geo/layers` → `{ cctv, police_stations, chokepoints, zones }`
- `GET /geo/locations` → known last-seen landmark names (intake dropdown)
- `GET /geo/hotspots` → separation-risk hotspots (amplified by live cases)
- `GET /geo/nearest-help?lat=&lng=` → nearest police station + CCTV coverage
- `GET /geo/cases?only_open=true` → lightweight case feed for map pins

## Admin (role: admin)
- `GET /admin/metrics` → totals, reunion rate, avg resolution, by-center,
  by-language, top hotspots, runtime latency.
- `GET /admin/events?limit=&action=` → audit feed.
- `POST /admin/purge` → run the privacy PII purge sweep.
