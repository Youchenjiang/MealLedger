import { createClient } from "@supabase/supabase-js";
import { isUsableSupabaseConfig } from "./supabaseConfig";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
) as string | undefined;

export const isSupabaseConfigured = isUsableSupabaseConfig(
  { url: supabaseUrl, anonKey: supabasePublicKey },
  { allowHttp: import.meta.env.DEV },
);
const explicitLocalDevelopmentMode = import.meta.env.VITE_LOCAL_DEVELOPMENT_MODE === "true";
export const isLocalDevelopmentMode = import.meta.env.DEV && (explicitLocalDevelopmentMode || !isSupabaseConfigured);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabasePublicKey as string)
  : null;
