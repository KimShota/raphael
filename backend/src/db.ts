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