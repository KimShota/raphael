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
