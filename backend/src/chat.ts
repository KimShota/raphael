import { callLLM } from "./llm.js";
import { THEO_SYSTEM_PROMPT } from "./theo-prompt.js";
import {
  getOrCreateSession,
  loadMemory,
  getTodaysPhrases,
  getDuePhrases,
  supabase,
} from "./db.js";

export function buildTheoSystem(o: {
  memory: string;
  level: string;
  phrases: string[];
}): string {
  return THEO_SYSTEM_PROMPT.replace("{{LEVEL}}", o.level)
    .replace("{{PHRASES}}", o.phrases.join(", ") || "(none)")
    .replace(
      "{{MEMORY}}",
      o.memory || "(nothing yet — this is one of your first chats with them)",
    );
}

type Msg = { role: "user" | "assistant"; content: string };

export async function handleChatTurn(
  userId: string,
  messages: Msg[],
  level: string,
): Promise<string> {
  const memory = await loadMemory(userId);
  const todays = await getTodaysPhrases();
  const due = await getDuePhrases(userId);
  const allPhrases = [
    ...new Set([...todays.map((p: { text: string }) => p.text), ...due]),
  ];

  const system = buildTheoSystem({
    memory,
    level: level ?? "LOWER-INTERMEDIATE",
    phrases: allPhrases,
  });

  const sessionId = await getOrCreateSession(userId);
  const lastUser = messages[messages.length - 1];
  if (lastUser?.role === "user") {
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: lastUser.content,
    });
  }

  const reply = await callLLM(system, messages);

  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: reply,
  });

  return reply;
}
