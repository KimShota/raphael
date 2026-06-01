import { Hono } from "hono";
import {
  getOrCreateSession,
  loadMemory,
  getTodaysPhrases,
  getDuePhrases,
  getUser,
  supabase,
} from "./db.js";

export const internal = new Hono();

function checkInternalKey(c: any): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  return c.req.header("x-internal-key") === expected;
}

/** Session context for the LiveKit agent (memory, phrases, level). */
internal.get("/context", async (c) => {
  if (!checkInternalKey(c)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const userId = c.req.query("userId");
  if (!userId) {
    return c.json({ error: "userId required" }, 400);
  }

  try {
    const [user, memory, todays, due, sessionId] = await Promise.all([
      getUser(userId),
      loadMemory(userId),
      getTodaysPhrases(),
      getDuePhrases(userId),
      getOrCreateSession(userId),
    ]);

    const todaysTexts = todays.map((p: { text: string }) => p.text);
    const phrases = [...new Set([...todaysTexts, ...due])];

    return c.json({
      userId,
      sessionId,
      level: user?.level ?? "LOWER-INTERMEDIATE",
      buddyName: user?.buddy_name ?? "Theo",
      memory,
      phrases,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "context failed" }, 500);
  }
});

/** Persist a single chat turn from the voice agent. */
internal.post("/message", async (c) => {
  if (!checkInternalKey(c)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { userId, role, content } = await c.req.json();
  if (!userId || !role || !content?.trim()) {
    return c.json({ error: "userId, role, content required" }, 400);
  }
  if (role !== "user" && role !== "assistant") {
    return c.json({ error: "invalid role" }, 400);
  }

  try {
    const sessionId = await getOrCreateSession(userId);
    await supabase.from("messages").insert({
      session_id: sessionId,
      role,
      content: content.trim(),
    });
    return c.json({ ok: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: "persist failed" }, 500);
  }
});
