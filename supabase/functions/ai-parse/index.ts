import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
// Default to "*" so browsers work out of the box; auth is enforced via the
// bearer token so an open origin does not weaken the endpoint.
const ALLOWED_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";
// Reject oversized bodies before proxying; base64 images inflate ~33%.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

// The proxy talks to any OpenAI-compatible chat completions endpoint.
const AI_API_KEY = requireEnv("AI_API_KEY");
const AI_BASE_URL = (Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";
const AI_VISION_MODEL = Deno.env.get("AI_VISION_MODEL") ?? AI_MODEL;

const corsHeaders = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

type AiParseRequest = {
  system?: unknown;
  user?: unknown;
  imageDataUrl?: unknown;
};

function isAiParseRequest(value: unknown): value is AiParseRequest {
  return typeof value === "object" && value !== null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "request_too_large" }, 413);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ""),
  );
  if (userError || !userData.user) return json({ error: "invalid_user" }, 401);

  const body = await req.json().catch(() => null);
  if (!isAiParseRequest(body)) return json({ error: "invalid_body" }, 400);

  const system = typeof body.system === "string" ? body.system.slice(0, 8000) : "";
  const user = typeof body.user === "string" ? body.user.slice(0, 8000) : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!user.trim() && !imageDataUrl) {
    return json({ error: "empty_input" }, 400);
  }

  // Model is server-controlled: the client can never pick a model, so the
  // shared key cannot be redirected to arbitrary provider models.
  const model = imageDataUrl ? AI_VISION_MODEL : AI_MODEL;
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    {
      role: "user",
      content: imageDataUrl
        ? [
            { type: "text", text: user || "請辨識這張發票/收據。" },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ]
        : user,
    },
  ];

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return json({ error: `ai_request_failed:${response.status}`, detail: detail.slice(0, 500) }, 502);
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return json({ error: "ai_empty_response" }, 502);
    return json({ data: JSON.parse(content) });
  } catch (error) {
    return json({ error: "ai_request_failed", detail: String(error).slice(0, 500) }, 502);
  }
});
