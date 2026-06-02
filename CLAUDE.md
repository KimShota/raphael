# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Raphael** is an AI English conversation companion (mobile app) where users practice English with an AI friend named "Theo" via real-time voice and text chat. It's a three-service system: a React Native mobile app, a Hono.js backend API, and a Python LiveKit voice agent.

## Three-Service Architecture

```
app/      — Expo/React Native mobile app (iOS/Android)
backend/  — Hono.js TypeScript API server
agent/    — Python LiveKit agent worker (voice pipeline)
```

All three must run simultaneously for full functionality. The agent connects to LiveKit Cloud; the app connects to LiveKit Cloud for WebRTC and to the backend for REST calls.

## Commands

### Backend (`backend/`)
```bash
npm install
npm run dev       # tsx watch mode, port 3000
npm run build     # compile to dist/
npm start         # run compiled output
```

### Mobile App (`app/`)
```bash
npm install
npm run start     # Expo dev server
npm run ios       # iOS simulator (requires dev client build, not Expo Go)
npm run android   # Android emulator
```

> The app requires a native dev build due to LiveKit, WebRTC, and audio plugins.

### Voice Agent (`agent/`)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/agent.py dev    # dev mode with auto-reload
```

## Environment Variables

Copy `.env.example` at the root and fill in values. Key variables:

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | backend | Database |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | backend + agent | LLM (default: gpt-4o-mini) |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | backend + agent | LiveKit Cloud |
| `LIVEKIT_AGENT_NAME` | backend | Name dispatched agent workers register under |
| `INTERNAL_API_KEY` | backend + agent | Secures agent→backend internal routes |
| `DEEPGRAM_API_KEY` | agent | Speech-to-text |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | agent | Text-to-speech |
| `EXPO_PUBLIC_API_URL` | app | Backend URL (must be LAN IP, not localhost) |

## Core Data Flow

### Text Chat
App → `POST /chat` → backend loads user memory + today's phrases → calls LLM with Theo prompt → stores message → returns reply.

### Voice Chat (LiveKit)
1. App calls `GET /livekit/token` → backend creates JWT + dispatches agent worker via RoomAgentDispatch
2. App joins LiveKit room; agent receives `metadata` containing userId, level, memory, phrases
3. **Voice pipeline**: Deepgram STT → OpenAI-compatible LLM → ElevenLabs TTS
4. Agent persists each turn via `POST /internal/message` (requires `x-internal-key` header)

### Session Lifecycle
- Session auto-created on first `/livekit/token` call
- On app background: `POST /end-session` → LLM summarizes transcript into `user_memory` → session marked ended
- Only one active session per user at a time

## Backend API Routes (`backend/src/index.ts`)

| Route | Purpose |
|---|---|
| `GET /greeting` | Generate opening message for user |
| `GET /livekit/token` | Create LiveKit token + dispatch agent |
| `POST /chat` | Single text chat turn |
| `GET /todays-phrases` | Daily 3-phrase rotation |
| `GET /history` | Session message history |
| `POST /end-session` | End session + summarize memory |
| `POST /review` | Generate post-session feedback |
| `POST /onboard` | Create user (onboarding) |
| `POST /internal/message` | Agent→backend: persist message |
| `GET /internal/context` | Agent→backend: fetch session context |

Internal routes are secured via `x-internal-key` header matching `INTERNAL_API_KEY`.

## Key Architecture Decisions

- **Theo character**: 22-year-old casual film student; responses capped at 180 tokens, 1-2 sentences, casual American English. Prompt lives in both `backend/src/theo-prompt.ts` and `agent/src/theo_prompt.py`.
- **Memory**: `user_memory` table stores LLM-generated summaries of past sessions; loaded before every chat turn for personalization.
- **Daily phrases**: Deterministic rotation — `dayIndex = Math.floor(Date.now() / 86_400_000) % groups`. Theo weaves them naturally into conversation.
- **Phrase rotation group size**: 3 phrases per day.
- **Feedback**: Post-session review focuses on corrections (max 2-3), rephrasings (formal→casual), and phrase tracking.
- **VAD**: Silero VAD prewarmed at agent startup. Endpointing tuned for patient language learners (0.3–5.0s).
- **Supabase**: Used for all persistence. The backend uses the service key (bypasses RLS).
