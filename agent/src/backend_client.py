import os
from typing import Any

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000").rstrip("/")
INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")

# create request headers for the backend
def _headers() -> dict[str, str]:
    return {"X-Internal-Key": INTERNAL_KEY}

# fetch user session context from the backend like level, buddyname, etc
async def fetch_session_context(user_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"{BACKEND_URL}/internal/context",
            params={"userId": user_id},
            headers=_headers(),
        )
        res.raise_for_status()
        return res.json()

# send user message and persist it to the backend
async def persist_message(user_id: str, role: str, content: str) -> None:
    text = content.strip()
    if not text:
        return
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{BACKEND_URL}/internal/message",
            json={"userId": user_id, "role": role, "content": text},
            headers=_headers(),
        )
        res.raise_for_status()
