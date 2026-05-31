import { createClient } from "@supabase/supabase-js";

// create an object of supabase
export const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
); 

// user for dev
export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// function to get or create session
export async function getOrCreateSession(userId: string): Promise<string> {
    // get the session if it exists
    const { data: existing } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", userId)
        .is("ended_at", null) 
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing){
        return existing.id; 
    }

    // create if session does not exist 
    const { data: created, error } = await supabase
        .from("sessions")
        .insert({ user_id: userId })
        .select("id")
        .single();
    
    if (error){
        throw error; 
    }

    return created.id; 
}

// function to load prev chat memory 
export async function loadMemory(userId: string): Promise<string>{
    const { data } = await supabase
        .from("user_memory")
        .select("summary")
        .eq("user_id", userId)
        .maybeSingle(); 

    return data?.summary ?? "";
}

// function to save the chat summary 
export async function saveMemory(userId: string, summary: string){
    await supabase.from("user_memory").upsert({
        user_id: userId, summary, updated_at: new Date().toISOString(),
    }); 
}

// function to get today's phrase
export async function getTodaysPhrases(){
    // get all the phrases and sort them based on id 
    const { data } = await supabase 
        .from("phrases")
        .select("*")
        .order("id"); 

    // return empty array if data is none 
    if (!data || data.length === 0){
        return []; 
    }

    // count how many 3-element groups we can form
    const groups = Math.ceil(data.length / 3); 
    // ensure dayIndex stays the same all day 
    const dayIndex = Math.floor(Date.now() / 86_400_000) % groups; 
    // extract 3 items
    return data.slice(dayIndex * 3, dayIndex * 3 + 3); 
}

// function to check which phrase user has practiced or missed in the session
export async function updateUserPhrases(
    userId: string, 
    phrasesUsed: string[], 
    phrasesMissed: string[]
){
    const allTexts = [...phrasesUsed, ...phrasesMissed]; 
    if (allTexts.length === 0){
        return; 
    }

    // 
    const { data: rows } = await supabase
        .from("phrases")
        .select("id, text")
        .in("text", allTexts);
    
    if (!rows){
        return; 
    }

    // track user's review activity across phrases in the list and update their progress
    for (const row of rows){
        const wasUsed = phrasesUsed.includes(row.text);
        const { data: existing } = await supabase
            .from("user_phrases")
            .select("*")
            .eq("user_id", userId)
            .eq("phrase_id", row.id)
            .maybeSingle();

        if (wasUsed){
            const timesUsed = (existing?.times_used ?? 0) + 1;
            // update status of review and set deadline for the next review 
            await supabase
                .from("user_phrases")
                .upsert({
                    user_id: userId, 
                    phrase_id: row.id,
                    status: timesUsed >= 3 ? "mastered" : "used",
                    times_used: timesUsed,
                    due_at: new Date(Date.now() + 3 * 86400000).toISOString(), // show phrase in 3 days 
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id,phrase_id" });
        } else {
            // set the review interval to tomorrow 
            await supabase
                .from("user_phrases")
                .upsert({
                    user_id: userId, 
                    phrase_id: row.id, 
                    status: existing?.status === "used" ? "used" : "seen",
                    times_used: existing?.times_used ?? 0,
                    due_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow 
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id,phrase_id" }); 
        }
    }
}

// function to get phrases for review
export async function getDuePhrases(userId: string): Promise<string[]>{
    // get at most 3 phrases from the list to review
    const { data: ups } = await supabase
        .from("user_phrases")
        .select("phrase_id")
        .eq("user_id", userId)
        .neq("status", "mastered")
        .lte("due_at", new Date().toISOString()).limit(3);
    
    if (!ups || ups.length === 0) {
        return [];
    }

    // extract id 
    const ids = ups.map((r) => r.phrase_id);
    // get phrases based on ids
    const { data: rows } = await supabase
        .from("phrases")
        .select("text")
        .in("id", ids);
    
    return (rows ?? []).map((r) => r.text);
}

// function to fetch phrases
export async function getUserPhrases(userId: string){
    // get phrases info in order
    const { data: ups } = await supabase
        .from("user_phrases")
        .select("phrase_id, status, times_used")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
    
    if (!ups || ups.length === 0) {
        return [];
    }

    // get actual phrases from ups 
    const { data: rows } = await supabase
        .from("phrases")
        .select("id, text, meaning")
        .in("id", ups.map((r) => r.phrase_id));
    
    // combine ups and rows 
    return ups.map((up) => {
        const p = rows?.find((r) => r.id === up.phrase_id);
        return { ...up, text: p?.text, meaning: p?.meaning };
    });
}

// function to get the user 
export async function getUser(userId: string){
    const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
    
    return data;
}

// function to create a new user 
export async function createUser(userId: string, buddyName: string, level: string, interests: string[]){
    await supabase
        .from("users")
        .upsert({ id: userId, buddy_name: buddyName, level, interests });
}