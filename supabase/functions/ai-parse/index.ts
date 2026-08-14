import { createClient } from "npm:@supabase/supabase-js@2";
import { handleAiParseRequest, type AiParseDeps } from "./handler.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
// Default to "*" so browsers work out of the box; auth is enforced via the
// bearer token so an open origin does not weaken the endpoint.
const ALLOWED_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";
// Require a valid user session by default; local development can opt out with
// AI_REQUIRE_AUTH=false so signed-out users can still use the AI panel.
const REQUIRE_AUTH = Deno.env.get("AI_REQUIRE_AUTH") !== "false";
// Reject oversized bodies before proxying; base64 images inflate ~33%.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

// The proxy talks to any OpenAI-compatible chat completions endpoint.
const AI_API_KEY = requireEnv("AI_API_KEY");
const AI_BASE_URL = stripTrailingSlashes(Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1");
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";
// The handler falls back to AI_MODEL when the vision model is unset.
const AI_VISION_MODEL = Deno.env.get("AI_VISION_MODEL") ?? "";
// Provider resilience: each attempt is bounded, and transient overload
// (529/429/5xx) is retried with backoff instead of surfacing to users as a
// hard failure. Tune via function secrets when the provider needs it.
const PROVIDER_TIMEOUT_MS = Number(Deno.env.get("AI_PROVIDER_TIMEOUT_MS") ?? 20_000);
const PROVIDER_MAX_ATTEMPTS = Number(Deno.env.get("AI_PROVIDER_MAX_ATTEMPTS") ?? 3);
const PROVIDER_BACKOFF_MS = Number(Deno.env.get("AI_PROVIDER_BACKOFF_MS") ?? 300);
const PROVIDER_BACKOFF_MAX_MS = Number(Deno.env.get("AI_PROVIDER_BACKOFF_MAX_MS") ?? 2_000);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return value.slice(0, end);
}

const deps: AiParseDeps = {
  env: {
    aiApiKey: AI_API_KEY,
    aiBaseUrl: AI_BASE_URL,
    aiModel: AI_MODEL,
    aiVisionModel: AI_VISION_MODEL,
    allowedOrigin: ALLOWED_ORIGIN,
    maxBodyBytes: MAX_BODY_BYTES,
    requireAuth: REQUIRE_AUTH,
    providerTimeoutMs: PROVIDER_TIMEOUT_MS,
    providerMaxAttempts: PROVIDER_MAX_ATTEMPTS,
    providerBackoffMs: PROVIDER_BACKOFF_MS,
    providerBackoffMaxMs: PROVIDER_BACKOFF_MAX_MS,
  },
  getUser: (token) => supabase.auth.getUser(token),
  fetchImpl: fetch,
};

Deno.serve((request) => handleAiParseRequest(request, deps));
