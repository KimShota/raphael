type Msg = { role: "user" | "assistant"; content: string };

export async function callLLM(system: string, messages: Msg[]): Promise<string>{
    // send POST request to LLM provider with the prompt
    const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
        method: "POST", 
        headers: {
            "Content-Type": "application/json", 
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        }, 
        body: JSON.stringify({
            model: process.env.LLM_MODEL, 
            messages: [{ role: "system", content: system }, ...messages], 
            max_tokens: 500, // response should be little
            temperature: 0.8, // naturally flowing  
            reasoning_effort: "none",
        }),
    }); 

    // error handling
    if (!res.ok){
        throw new Error(`LLM error ${res.status}: ${await res.text()}`); 
    }

    const data = await res.json(); 
    return data.choices[0].message.content as string; 
}

// function to summarize the chat using LLM
export async function summarizeForMemory(existing: string, messages: Msg[]): Promise<string>{
    const convo = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const system =
        "You maintain a memory profile of a language learner for their AI friend Theo. " +
        "Given the existing memory and a new conversation, output an UPDATED memory: durable facts about the user " +
        "(life, interests, people they mention, likes/dislikes), topics discussed, and anything Theo should naturally " +
        "remember next time. Be concise — 5 to 8 short lines. Output ONLY the memory, no preamble.";
    const user = `EXISTING MEMORY:\n${existing || "(none)"}\n\nNEW CONVERSATION:\n${convo}\n\nUPDATED MEMORY:`;
    return callLLM(system, [{ role: "user", content: user }]);
}