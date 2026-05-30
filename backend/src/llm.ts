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
            max_tokens: 300, // response should be little
            temperature: 0.8, // naturally flowing  
        }),
    }); 

    // error handling
    if (!res.ok){
        throw new Error(`LLM error ${res.status}: ${await res.text()}`); 
    }

    const data = await res.json(); 
    return data.choices[0].message.content as string; 
}