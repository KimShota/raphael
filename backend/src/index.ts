import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { callLLM, summarizeForMemory, generateFeedback } from "./llm.js";
import { buildTheoSystem, handleChatTurn } from "./chat.js";
import { createLiveKitToken } from "./livekit.js";
import { internal } from "./internal.js";
import {
  supabase,
  DEV_USER_ID,
  getOrCreateSession,
  loadMemory,
  saveMemory,
  getTodaysPhrases,
  updateUserPhrases,
  getUserPhrases,
  getUser,
  createUser,
} from "./db.js";

const app = new Hono();
app.use("/*", cors());

app.get("/", (c) => c.text("ok"));

app.route("/internal", internal);

function getUserId(c: { req: { query: (k: string) => string | undefined } }): string {
  return c.req.query("userId") || DEV_USER_ID;
}

app.get("/history", async (c) => {
  try {
    const userId = getUserId(c);
    const sessionId = await getOrCreateSession(userId);
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return c.json({ messages: data ?? [] });
  } catch (error) {
    console.error(error);
    return c.json({ error: "history failed" }, 500);
  }
});

app.get("/greeting", async (c) => {
  try {
    const userId = getUserId(c);
    const user = await getUser(userId);
    const level = user?.level ?? "LOWER-INTERMEDIATE";
    const sessionId = await getOrCreateSession(userId);
    const { data: msgs } = await supabase
      .from("messages")
      .select("id")
      .eq("session_id", sessionId)
      .limit(1);

    if (msgs && msgs.length > 0) return c.json({ reply: null });

    const memory = await loadMemory(userId);
    const system =
      buildTheoSystem({ memory, level, phrases: [] }) +
      "\n\nThe user just opened the app. Send a short, warm opening message as Theo (1-2 lines). " +
      "If you remember something about them, reference it naturally like a friend would.";

    const reply = await callLLM(system, [{ role: "user", content: "hey" }]);

    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
    });

    return c.json({ reply });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to greet" }, 500);
  }
});

app.get("/livekit/token", async (c) => {
  try {
    const userId = getUserId(c);
    const payload = await createLiveKitToken(userId);
    return c.json(payload);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "token failed";
    return c.json({ error: message }, 500);
  }
});

app.post("/chat", async (c) => {
  const { messages, level, userId: uid } = await c.req.json();
  const userId = uid || DEV_USER_ID;
  try {
    const reply = await handleChatTurn(userId, messages ?? [], level);
    return c.json({ reply });
  } catch (error) {
    console.error(error);
    return c.json({ error: "LLM failed" }, 500);
  }
});

app.get("/todays-phrases", async (c) => {
  const phrases = await getTodaysPhrases();
  return c.json({ phrases });
});

app.get("/my-phrases", async (c) => {
  const userId = getUserId(c);
  const data = await getUserPhrases(userId);
  return c.json({ phrases: data });
});

app.post("/end-session", async (c) => {
  try {
    const { userId: uid } = await c.req.json();
    const userId = uid || DEV_USER_ID;
    const sessionId = await getOrCreateSession(userId);
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (msgs && msgs.length > 0) {
      const existing = await loadMemory(userId);
      const updated = await summarizeForMemory(
        existing,
        msgs as { role: "user" | "assistant"; content: string }[],
      );
      await saveMemory(userId, updated);
    }

    await supabase
      .from("sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId);

    return c.json({ ok: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: "end-session failed" }, 500);
  }
});

app.post("/review", async (c) => {
  try {
    const { userId: uid } = await c.req.json();
    const userId = uid || DEV_USER_ID;
    const sessionId = await getOrCreateSession(userId);
    const { data: cached } = await supabase
      .from("feedback")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (cached) {
      return c.json({ feedback: cached });
    }

    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (!msgs || msgs.length === 0) return c.json({ feedback: null });

    const todays = await getTodaysPhrases();
    const phraseTexts = todays.map((p: { text: string }) => p.text);
    const result = await generateFeedback(msgs, phraseTexts);

    const { data: saved } = await supabase
      .from("feedback")
      .insert({ session_id: sessionId, ...result })
      .select()
      .single();

    await updateUserPhrases(userId, result.phrases_used, result.phrases_missed);

    return c.json({ feedback: saved });
  } catch (error) {
    console.error(error);
    return c.json({ error: "review failed" }, 500);
  }
});

app.get("/user", async (c) => {
  const userId = getUserId(c);
  const user = await getUser(userId);
  return c.json({ user });
});

app.post("/onboard", async (c) => {
  const { userId, buddyName, level, interests } = await c.req.json();
  await createUser(userId, buddyName, level, interests);
  return c.json({ ok: true });
});

const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port });
console.log(`backend on http://localhost:${port}`);
