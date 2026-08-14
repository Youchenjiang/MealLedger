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
// Stable base URL for auth emails (password reset, OAuth callbacks). Email
// links are opened later, often on a different device, so they must point to a
// public deployment rather than the instance that sent the request (which is
// 127.0.0.1 in a local preview). Set VITE_AUTH_REDIRECT_URL to the deployed
// app URL; it falls back to the current origin for local development.
export const authRedirectBaseUrl = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim() ?? "";
const explicitLocalDevelopmentMode = import.meta.env.VITE_LOCAL_DEVELOPMENT_MODE === "true";
export const isLocalDevelopmentMode = import.meta.env.DEV && (explicitLocalDevelopmentMode || !isSupabaseConfigured);

// detectSessionInUrl is disabled because the app owns callback handling:
// restoreOAuthCallbackSession maps OAuth callbacks to sign-in and recovery
// links to the password-recovery state. Without this, supabase-js clears the
// URL hash at client construction and emits SIGNED_IN/PASSWORD_RECOVERY from a
// deferred timer, racing the app's subscription and overriding the recovery
// state back to signed-in.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabasePublicKey as string, { auth: { detectSessionInUrl: false } })
  : null;
