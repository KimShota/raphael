import "dotenv/config"; 
import { Hono } from "hono"; 
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { callLLM } from "./llm.js";
import { THEO_SYSTEM_PROMPT } from "./theo-prompt.js";

// create an object of Hono
const app = new Hono(); 
app.use("/*", cors()); 

// response to the client with ok when landing on home page 
app.get("/", (c) => c.text("ok"));

// POST request to send prompt to LLM prov
app.post("/chat", async (c) => {
    const { messages, level, todaysPhrases } = await c.req.json(); 
    // set the prompt with level and today's phrase 
    const system = THEO_SYSTEM_PROMPT
        .replace("{{LEVEL}}", level ?? "LOWER-INTERMEDIATE")
        .replace("{{PHRASES}}", (todaysPhrases ?? []).join(", ") || "(none)");
    try {
        // call LLM provider 
        const reply = await callLLM(system, messages); 
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