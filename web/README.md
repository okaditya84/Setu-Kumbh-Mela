# Setu - Web (Next.js PWA)

Offline-first, multilingual operator + control-room console. Installable PWA,
voice-first intake, interactive map, admin observability.

## Run locally
```bash
cd web
npm install
cp .env.example .env.local       # point NEXT_PUBLIC_API_BASE at your backend
npm run dev                      # http://localhost:3000
```
Start the backend first (see `../backend/README.md`). Log in with the demo
accounts: `volunteer / volunteer123` or `admin / admin123`.

## Highlights
- **Voice-first intake** - one big mic button; speaks any Indian language via the
  browser SpeechRecognition API (on-device → works on 2G), parsed into a draft.
- **Offline-first** - intake is queued in IndexedDB and auto-synced (idempotently)
  when the network returns; a service worker serves the app shell offline.
- **Camera capture**, **multilingual PA announcements** (with text-to-speech),
  **anti-impersonation verification**, **MapLibre+OSM** live map with hotspots.
- **i18n** - full UI in English / हिन्दी / मराठी; every other Indian language is
  selectable for voice + announcements and is one drop-in dictionary away
  (`src/i18n/dictionaries`).

## Deploy (Vercel)
1. Import the repo in Vercel, set **Root Directory = `web`**.
2. Add env var `NEXT_PUBLIC_API_BASE` = your backend URL.
3. Deploy. The PWA is installable and passes Lighthouse PWA checks.

## Build
```bash
npm run build
```
