import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    cli,
    inference,
    metrics,
    room_io,
)
from livekit.agents.llm import ChatMessage
from livekit.plugins import deepgram, elevenlabs, openai, silero

from backend_client import fetch_session_context, persist_message
from theo_prompt import build_theo_instructions

logger = logging.getLogger("raphael-agent")

load_dotenv(".env.local")
load_dotenv()

# define how long we should wait after detecting silence before stopping the recording
MIN_ENDPOINTING_DELAY = float(os.getenv("MIN_ENDPOINTING_DELAY", "0.3"))
MAX_ENDPOINTING_DELAY = float(os.getenv("MAX_ENDPOINTING_DELAY", "5.0"))

# define the agent class for AI buddy
class RaphaelBuddy(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(
            instructions=instructions,
            llm=openai.LLM(
                model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
                base_url=os.getenv("LLM_BASE_URL"),
                api_key=os.getenv("LLM_API_KEY"),
                temperature=0.8,
            ),
        )


server = AgentServer()

# load voice activity detection model 
def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm

# function to read session context from the backend like level, memory, etc
def _parse_metadata(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("invalid job metadata: %s", raw)
        return {}

# when user enters a LiveKit room, we will start the agent 
@server.rtc_session(agent_name=os.getenv("LIVEKIT_AGENT_NAME", "raphael-buddy"))
async def raphael_agent(ctx: JobContext) -> None:
    meta = _parse_metadata(ctx.job.metadata)
    user_id = meta.get("userId")
    if not user_id:
        logger.error("missing userId in dispatch metadata")
        return

    ctx.log_context_fields = {"room": ctx.room.name, "userId": user_id}

    # fetch personalized data like level, memory, phrases, etc
    try:
        session_ctx = await fetch_session_context(user_id)
    except Exception:
        logger.exception("failed to load session context")
        session_ctx = {
            "level": meta.get("level", "LOWER-INTERMEDIATE"),
            "buddyName": meta.get("buddyName", "Theo"),
            "memory": "",
            "phrases": [],
        }

    # build the instruction prompt for the agent
    instructions = build_theo_instructions(
        memory=session_ctx.get("memory", ""),
        level=session_ctx.get("level", "LOWER-INTERMEDIATE"),
        phrases=session_ctx.get("phrases", []),
        buddy_name=session_ctx.get("buddyName", "Theo"),
    )

    # configure TTS model and voice from elevenlab 
    eleven_model = os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID")
    if not voice_id:
        # use fallback if voice is missing
        logger.warning("ELEVENLABS_VOICE_ID not set — using LiveKit inference TTS fallback")
        tts = inference.TTS(model="elevenlabs/eleven_flash_v2_5")
    else:
        # create speech generator 
        tts = elevenlabs.TTS(
            voice_id=voice_id,
            model=eleven_model,
        )

    usage_collector = metrics.UsageCollector()

    # create the agent session with all configs
    session = AgentSession(
        stt=deepgram.STT(
            model=os.getenv("DEEPGRAM_MODEL", "nova-3"),
            language="en",
        ),
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        min_endpointing_delay=MIN_ENDPOINTING_DELAY,
        max_endpointing_delay=MAX_ENDPOINTING_DELAY,
        preemptive_generation=True,
    )

    # when user sends a message, persist the message to the backend
    @session.on("conversation_item_added")
    def on_item_added(event: ConversationItemAddedEvent) -> None:
        item = event.item
        if not isinstance(item, ChatMessage):
            return
        text = item.text_content
        if not text or not text.strip():
            return
        if item.role not in ("user", "assistant"):
            return

        m = getattr(item, "metrics", None) or {}
        if item.role == "assistant" and m.get("e2e_latency") is not None:
            logger.info("e2e_latency=%.3fs", m["e2e_latency"])

        asyncio.create_task(persist_message(user_id, item.role, text))

    # collect metrics like latency, usage, costs, etc
    @session.on("metrics_collected")
    def on_metrics(ev: MetricsCollectedEvent) -> None:
        usage_collector.collect(ev.metrics)

    async def log_usage() -> None:
        summary = usage_collector.get_summary()
        logger.info("usage: %s", summary)

    ctx.add_shutdown_callback(log_usage)

    logger.info("connecting to room %s", ctx.room.name)
    await ctx.connect()
    logger.info("connected — starting session for user %s", user_id)

    await session.start(
        agent=RaphaelBuddy(instructions),
        room=ctx.room,
        room_options=room_io.RoomOptions(),
    )
    logger.info("session started for user %s", user_id)


if __name__ == "__main__":
    cli.run_app(server)
