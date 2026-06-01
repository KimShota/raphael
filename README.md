# Raphael

AI English buddy app — real-time voice via LiveKit Agents.

## Structure

| Path | Role |
|------|------|
| [`app/`](app/) | Expo (React Native) client |
| [`backend/`](backend/) | Hono API — auth tokens, memory, review |
| [`agent/`](agent/) | LiveKit voice agent worker (Python) |

## Quick start

See [docs/LIVEKIT_SETUP.md](docs/LIVEKIT_SETUP.md) for full setup (LiveKit Cloud, Deepgram, ElevenLabs).

1. Copy env files from [`.env.example`](.env.example) into `backend/.env` and `agent/.env.local`.
2. `cd backend && npm install && npm run dev`
3. `cd agent && pip install -r requirements.txt && python src/agent.py dev`
4. `cd app && npm install && npx expo run:ios` (dev build — not Expo Go)

## Voice architecture

- Mobile connects to LiveKit via WebRTC (`GET /livekit/token`).
- Agent pipeline: Deepgram STT → OpenAI-compatible LLM (Theo) → ElevenLabs Flash TTS.
- Transcripts persist to Supabase through `POST /internal/message`.
- Post-session review unchanged (`POST /review`, `POST /end-session`).
