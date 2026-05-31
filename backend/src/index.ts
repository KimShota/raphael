import "dotenv/config"; 
import { Hono } from "hono"; 
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { callLLM, summarizeForMemory, generateFeedback } from "./llm.js";
import { THEO_SYSTEM_PROMPT } from "./theo-prompt.js";
import {
  supabase, DEV_USER_ID, getOrCreateSession, loadMemory, saveMemory, getTodaysPhrases, updateUserPhrases, getDuePhrases, getUserPhrases
} from "./db.js";

// create an object of Hono
const app = new Hono(); 
app.use("/*", cors()); 

// response to the client with ok when landing on home page 
app.get("/", (c) => c.text("ok"));

// function tp build the prompt 
function buildTheoSystem(o: { memory: string; level: string; phrases: string[] }) {
  return THEO_SYSTEM_PROMPT
    .replace("{{LEVEL}}", o.level)
    .replace("{{PHRASES}}", o.phrases.join(", ") || "(none)")
    .replace("{{MEMORY}}", o.memory || "(nothing yet — this is one of your first chats with them)");
}

// endpoint to show the past chats to the user in order
app.get("/history", async (c) => {
    try {
        const sessionId = await getOrCreateSession(DEV_USER_ID);
        // get the history chat through session id 
        const { data, error } = await supabase
            .from("messages")
            .select("role, content")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
        if (error) throw error;
    return c.json({ messages: data ?? [] });
    } catch (error){
        console.error(error); 
        return c.json({ error: "history failed" }, 500); 
    }
}); 

// endpoint to start the conversation
app.get("/greeting", async (c) => {
    try {
        const sessionId = await getOrCreateSession(DEV_USER_ID);
        const { data: msgs } = await supabase
            .from("messages").select("id").eq("session_id", sessionId).limit(1);
        
        if (msgs && msgs.length > 0) return c.json({ reply: null });

        // load memory
        const memory = await loadMemory(DEV_USER_ID);
        
        // create opening prompt
        const system = buildTheoSystem({ memory, level: "LOWER-INTERMEDIATE", phrases: [] }) +
            "\n\nThe user just opened the app. Send a short, warm opening message as Theo (1-2 lines). " +
            "If you remember something about them, reference it naturally like a friend would.";
        
        // get reply from AI buddy 
        const reply = await callLLM(system, [{ role: "user", content: "hey" }]);
        
        // store AI's reply
        await supabase.from("messages").insert({ 
            session_id: sessionId, role: "assistant", content: reply 
        });

        return c.json({ reply });
    } catch (error){
        console.error(error);
        return c.json({ error: "Failed to greet"}, 500); 
    }
}); 

// endpoint to get today's phrases
app.get("/todays-phrases", async (c) => {
    const phrases = await getTodaysPhrases(); 
    return c.json({ phrases }); 
}); 

// endpoint to get user's phrases
app.get("/my-phrases", async (c) => {
    const data = await getUserPhrases(DEV_USER_ID);
    return c.json({ phrases: data }); 
}); 

// POST request to send prompt to LLM prov
app.post("/chat", async (c) => {
    const { messages, level } = await c.req.json();
    try {
        // load memory 
        const memory = await loadMemory(DEV_USER_ID);
        const todays = await getTodaysPhrases(); 
        const due = await getDuePhrases(DEV_USER_ID); 
        const allPhrases = [...new Set([...todays.map((p: any) => p.text), ...due])];
        // build the prompt 
        const system = buildTheoSystem({ 
            memory, 
            level: level ?? "LOWER-INTERMEDIATE", 
            phrases: allPhrases, 
        });
        // get the session id 
        const sessionId = await getOrCreateSession(DEV_USER_ID);
        // get the latest user message
        const userMsg = messages[messages.length - 1];
        // store user input into db
        await supabase.from("messages").insert({ 
            session_id: sessionId, 
            role: userMsg.role, 
            content: userMsg.content 
        });
        // get reply 
        const reply = await callLLM(system, messages);
        // store AI reply
        await supabase.from("messages").insert({ 
            session_id: sessionId, 
            role: "assistant", 
            content: reply 
        });
        return c.json({ reply });
    } catch (error) { 
        console.error(error); 
        return c.json({ error: "LLM failed" }, 500); 
    }
});

// endpoint to 
app.post("/end-session", async (c) => {
    try {
        // get the session id 
        const sessionId = await getOrCreateSession(DEV_USER_ID);
        // 
        const { data: msgs } = await supabase
            .from("messages")
            .select("role, content")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
        
        // get the summary and update memory
        if (msgs && msgs.length > 0) {
            const existing = await loadMemory(DEV_USER_ID);
            const updated = await summarizeForMemory(existing, msgs as any);
            await saveMemory(DEV_USER_ID, updated);
        }
        // record when the chat ended
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
        const sessionId = await getOrCreateSession(DEV_USER_ID); 
        const { data: cached } = await supabase
            .from("feedback")
            .select("*")
            .eq("session_id", sessionId)
            .maybeSingle();

        // return cache if it exists 
        if (cached) {
            return c.json({ feedback: cached });
        }

        // get messages
        const { data: msgs } = await supabase
            .from("messages")
            .select("role, content")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
        
        // return null if message does not exist 
        if (!msgs || msgs.length === 0) return c.json({ feedback: null });

        // get today's phrases 
        const todays = await getTodaysPhrases(); 
        const phraseTexts = todays.map((p: any) => p.text);

        // generate feedback with messages and phrases
        const result = await generateFeedback(msgs as any, phraseTexts); 

        // save the feedback 
        const { data: saved } = await supabase
            .from("feedback")
            .insert({
                session_id: sessionId, ...result,
            })
            .select()
            .single();

        // update user phrases 
        await updateUserPhrases(DEV_USER_ID, result.phrases_used, result.phrases_missed); 
        
        return c.json({ feedback: saved }); 

    } catch (error){
        console.error(error); 
        return c.json({ error: "review failed" }, 500); 
    }
}); 

const port = Number(process.env.PORT || 3000); 
// tell Node to pass HTTP request to hono routing engine
serve({
    fetch: app.fetch, 
    port
}); 
console.log(`backend on http://localhost:${port}`);