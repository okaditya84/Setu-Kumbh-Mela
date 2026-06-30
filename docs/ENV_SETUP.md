# Getting your keys & filling the `.env` (step-by-step, non-technical)

> **You do NOT need any of these keys to run Setu.** With an empty config it runs
> fully: matching, offline sync, maps, the whole flow. Keys only *upgrade* two
> optional things: (1) the AI that turns messy speech into a clean form and
> writes announcements, and (2) server-side voice transcription. Add them only
> if you want those upgrades.

Everything goes in **one file**: `backend/.env` (copy it from
`backend/.env.example` if it doesn't exist). Each setting is `NAME=value` on its
own line. Save the file and restart the backend after editing.

---

## 1. The one setting you SHOULD change (security)

`SECRET_KEY` signs login tokens. Use any long random text. To generate one:

- Mac/Linux terminal: `python3 -c "import secrets; print(secrets.token_hex(32))"`
- Or just mash 50+ random letters/numbers.

```
SECRET_KEY=paste-the-long-random-text-here
```

---

## 2. The AI brain (LLM) - optional

Pick **one** provider. You set three lines: `LLM_PROVIDER`, `LLM_MODEL`,
`LLM_API_KEY`. (You never need `LLM_BASE_URL` unless you use a custom gateway.)

### Option A - Anthropic (Claude)  ← what this project is set up for
1. Go to **https://console.anthropic.com** and sign up / log in.
2. Add a small amount of credit under **Billing** (a few dollars lasts the event).
3. Left menu → **API Keys** → **Create Key** → copy it (starts with `sk-ant-`).
4. In `.env`:
   ```
   LLM_PROVIDER=anthropic
   LLM_MODEL=claude-sonnet-4-6
   LLM_API_KEY=sk-ant-...your key...
   ```

### Option B - OpenAI (GPT)
1. **https://platform.openai.com** → log in → add billing credit.
2. **API keys** → **Create new secret key** → copy (starts with `sk-`).
3. ```
   LLM_PROVIDER=openai
   LLM_MODEL=gpt-4o-mini
   LLM_API_KEY=sk-...your key...
   ```

### Option C - Google Gemini  (has a free tier)
1. **https://aistudio.google.com/app/apikey** → **Create API key** → copy.
2. ```
   LLM_PROVIDER=gemini
   LLM_MODEL=gemini-1.5-flash
   LLM_API_KEY=...your key...
   ```

### Option D - OpenRouter (one key, many models)
1. **https://openrouter.ai** → **Keys** → create key (starts with `sk-or-`).
2. ```
   LLM_PROVIDER=openrouter
   LLM_MODEL=anthropic/claude-3.5-sonnet
   LLM_API_KEY=sk-or-...your key...
   ```

### Option E - DeepSeek (low cost)
1. **https://platform.deepseek.com** → **API keys** → create.
2. ```
   LLM_PROVIDER=deepseek
   LLM_MODEL=deepseek-chat
   LLM_API_KEY=...your key...
   ```

> Groq, Together and a local Ollama also work - set `LLM_PROVIDER` to that name,
> the model id, and the key. The official URL is built in for all of them.

---

## 3. Voice transcription (STT) - optional

Only needed if you want the **server** to transcribe audio. The phone/browser
already does on-device speech-to-text for free, so this is a bonus for noisy
audio or recorded samples. Pick one:

### Sarvam (best for Indian languages)
1. **https://dashboard.sarvam.ai** → sign up → **API Keys** → create.
2. ```
   VOICE_PROVIDER=sarvam
   VOICE_API_KEY=...your key...
   VOICE_MODEL=saarika:v2
   ```

### Deepgram
1. **https://console.deepgram.com** → sign up (free credit) → **API Keys** → create.
2. ```
   VOICE_PROVIDER=deepgram
   VOICE_API_KEY=...your key...
   VOICE_MODEL=nova-2
   ```

### ElevenLabs
1. **https://elevenlabs.io** → Profile → **API Key** → copy.
2. ```
   VOICE_PROVIDER=elevenlabs
   VOICE_API_KEY=...your key...
   VOICE_MODEL=scribe_v1
   ```

---

## 4. Map (optional)
The app uses free OpenStreetMap with **no key**. Leave `MAP_STYLE_URL` blank.
For prettier vector tiles you can paste a MapTiler/Stadia style URL there later.

---

## 5. Database (only for production persistence)
Default is a local file (SQLite) - nothing to do. For a permanent multi-server
database (e.g. on Render), create a free Postgres, copy its connection URL into
`DATABASE_URL`, and install the Postgres driver:
`pip install -r backend/requirements-postgres.txt`.

---

## ⚠️ Never share your keys
Keys are like passwords. `backend/.env` is **git-ignored** so it is never
uploaded. Never paste a real key into `.env.example` or any file that gets
committed - GitHub will block the push if you do.
