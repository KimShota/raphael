# LiveKit real-time voice setup

## 1. LiveKit Cloud (MVP)

1. Create a project at [https://cloud.livekit.io](https://cloud.livekit.io).
2. Copy **WebSocket URL**, **API Key**, and **API Secret** into `backend/.env`.
3. Set `LIVEKIT_AGENT_NAME=raphael-buddy` (must match the Python worker).

## 2. Provider API keys

| Service | Env var | Purpose |
|---------|---------|---------|
| Deepgram | `DEEPGRAM_API_KEY` | Streaming STT |
| ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Flash TTS (US/UK voices) |
| OpenAI-compatible | `LLM_*` | Theo’s brain (same as backend) |

Pick an ElevenLabs voice ID from the dashboard (e.g. American casual male for Theo).

## 3. Run services

```bash
# Terminal 1 — Hono API
cd backend && cp ../.env.example .env  # fill in values
npm install && npm run dev

# Terminal 2 — LiveKit agent worker
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env.local  # fill agent section
python src/agent.py dev

# Terminal 3 — Expo (dev build required, not Expo Go)
cd app
npm install
npx expo run:ios   # or run:android
```

Set `EXPO_PUBLIC_API_URL` to your machine’s LAN IP (e.g. `http://192.168.0.25:3000`).

## 4. Self-hosted LiveKit (later)

Change only:

```env
LIVEKIT_URL=wss://livekit.yourdomain.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Redeploy the same agent worker pointing at the new URL. No mobile app changes.

## 5. Latency tuning

Agent defaults (see `agent/src/agent.py`):

- `min_endpointing_delay=0.3` — responsive after user finishes
- `max_endpointing_delay=5.0` — patient silence for learners
- `preemptive_generation=True` — LLM starts while user may still be trailing off

Watch agent logs for `e2e_latency` on `conversation_item_added` events.
