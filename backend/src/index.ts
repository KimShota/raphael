import "dotenv/config"; 
import { Hono } from "hono"; 
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { callLLM } from "./llm.js";
import { THEO_SYSTEM_PROMPT } from "./theo-prompt.js";
import { supabase, DEV_USER_ID, getOrCreateSession } from "./db.js";

// create an object of Hono
const app = new Hono(); 
app.use("/*", cors()); 

// response to the client with ok when landing on home page 
app.get("/", (c) => c.text("ok"));

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

// POST request to send prompt to LLM prov
app.post("/chat", async (c) => {
    const { messages, level, todaysPhrases } = await c.req.json(); 
    // set the prompt with level and today's phrase 
    const system = THEO_SYSTEM_PROMPT
        .replace("{{LEVEL}}", level ?? "LOWER-INTERMEDIATE")
        .replace("{{PHRASES}}", (todaysPhrases ?? []).join(", ") || "(none)");
    try {
        const sessionId = await getOrCreateSession(DEV_USER_ID);
        const userMsg = messages[messages.length - 1];

        // store user's input
        await supabase.from("messages").insert({
            session_id: sessionId, role: userMsg.role, content: userMsg.content,
        });

        // call LLM provider 
        const reply = await callLLM(system, messages); 

        // store the reply
        await supabase.from("messages").insert({
            session_id: sessionId, role: "assistant", content: reply,
        });

        return c.json({ reply }); 
    } catch (error){
        console.error(error); 
        return c.json({ error: "LLM failed" }, 500); 
    }
}); 

const port = Number(process.env.PORT || 3000); 
// tell Node to pass HTTP request to hono routing engine
serve({
    fetch: app.fetch, 
    port
}); 
console.log(`backend on http://localhost:${port}`);