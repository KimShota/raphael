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
            max_tokens: 180,
            temperature: 0.8,
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

// function to generate feedback from LLM
export async function generateFeedback(
  transcript: { role: string; content: string }[],
  todaysPhrases: string[]
): Promise<{ corrections: any[]; rephrasings: any[]; phrases_used: string[]; phrases_missed: string[] }> {
    const convo = transcript.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    
    const system = `You are a kind English coach reviewing a conversation between a Japanese learner (USER) and their AI friend Theo (ASSISTANT). 
        Analyze the USER's messages only. Return ONLY a JSON object — no preamble, no markdown backticks:
        {
        "corrections": [{"original": "...", "corrected": "...", "tip": "..."}],
        "rephrasings": [{"original": "...", "casual": "...", "note": "..."}],
        "phrases_used": ["..."],
        "phrases_missed": ["..."]
        }
        Rules:
        - corrections: MAX 2-3. Only the most important errors. Kind and brief. Skip tiny mistakes.
        - rephrasings: 1-3 places where the user sounded textbook/formal. Show the casual, natural alternative. THIS IS THE KEY FEATURE — help them sound like a native.
        - phrases_used: which of TODAY'S TARGET PHRASES the user actually used.
        - phrases_missed: which weren't used (they'll come back later).
        - If no major errors, corrections = [].
        - Output ONLY the JSON object. Nothing else.`;

        const user = `TODAY'S TARGET PHRASES: ${todaysPhrases.join(", ")}

        CONVERSATION TRANSCRIPT:
        ${convo}

        Analyze the USER's messages and return the feedback JSON.`;
    
    // get response from LLM
    const raw = await callLLM(system, [{ role: "user", content: user }]); 
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
        return JSON.parse(clean); 
    } catch (error){
        return { corrections: [], rephrasings: [], phrases_used: [], phrases_missed: todaysPhrases };
    }
}
