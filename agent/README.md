# Raphael LiveKit agent

Run from this directory:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local   # fill in keys
python src/agent.py dev
```

The worker name must match `LIVEKIT_AGENT_NAME` in the backend (default: `raphael-buddy`).
