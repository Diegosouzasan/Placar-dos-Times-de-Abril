import { createClient } from "@supabase/supabase-js";

// Pegamos as chaves do ambiente futuramente, por enquanto deixamos fixo para facilitar sua configuração rápida
const SUPABASE_URL = "https://hxvlvxzsznuaduktzfjh.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_Lh77569MWx0MSciPsgws4Q_gteGXkkD";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
