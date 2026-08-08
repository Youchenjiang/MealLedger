// Pure request handler for the ai-parse edge function. It reads no Deno or
// environment globals directly: configuration, auth, and the fetch
// implementation are injected so the logic can be unit-tested in isolation.

export type AiParseEnv = {
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  aiVisionModel: string;
  allowedOrigin: string;
  maxBodyBytes: number;
};

export type AiParseDeps = {
  env: AiParseEnv;
  getUser(token: string): Promise<{ data: { user: unknown } | null; error: unknown }>;
  fetchImpl: typeof fetch;
};

const DEFAULT_IMAGE_USER_TEXT = "請辨識這張發票/收據。";
const MAX_TEXT_CHARS = 8000;

function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number, allowedOrigin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(allowedOrigin), "content-type": "application/json" },
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

// Reads the whole request body while enforcing the byte limit, so oversized
// payloads are rejected even when the content-length header is missing or
// lies. Returns null when the body exceeds maxBytes.
async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text().catch(() => "");
    return text.length > maxBytes ? null : text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function buildMessages(system: string, user: string, imageDataUrl: string): Array<{ role: string; content: unknown }> {
  return [
    ...(system ? [{ role: "system", content: system }] : []),
    {
      role: "user",
      content: imageDataUrl
        ? [
            { type: "text", text: user || DEFAULT_IMAGE_USER_TEXT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ]
        : user,
    },
  ];
}

type ProviderResult =
  | { kind: "ok"; data: unknown }
  | { kind: "http-error"; status: number; detail: string }
  | { kind: "empty" }
  | { kind: "exception"; detail: string };

async function callProvider(fetchImpl: typeof fetch, env: AiParseEnv, model: string, messages: unknown[]): Promise<ProviderResult> {
  try {
    const response = await fetchImpl(`${env.aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.aiApiKey}`,
      },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { kind: "http-error", status: response.status, detail: detail.slice(0, 500) };
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return { kind: "empty" };
    }
    return { kind: "ok", data: JSON.parse(content) };
  } catch (error) {
    return { kind: "exception", detail: String(error).slice(0, 500) };
  }
}

export async function handleAiParseRequest(request: Request, deps: AiParseDeps): Promise<Response> {
  const { env, getUser, fetchImpl } = deps;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env.allowedOrigin) });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, env.allowedOrigin);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > env.maxBodyBytes) {
    return json({ error: "request_too_large" }, 413, env.allowedOrigin);
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return json({ error: "missing_authorization" }, 401, env.allowedOrigin);
  }

  const { data: userData, error: userError } = await getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (userError || !userData?.user) {
    return json({ error: "invalid_user" }, 401, env.allowedOrigin);
  }

  const rawBody = await readBodyWithLimit(request, env.maxBodyBytes);
  if (rawBody === null) {
    return json({ error: "request_too_large" }, 413, env.allowedOrigin);
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }
  if (!isAiParseRequest(body)) {
    return json({ error: "invalid_body" }, 400, env.allowedOrigin);
  }

  const system = typeof body.system === "string" ? body.system.slice(0, MAX_TEXT_CHARS) : "";
  const user = typeof body.user === "string" ? body.user.slice(0, MAX_TEXT_CHARS) : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!user.trim() && !imageDataUrl) {
    return json({ error: "empty_input" }, 400, env.allowedOrigin);
  }

  // Model is server-controlled: the client can never pick a model, so the
  // shared key cannot be redirected to arbitrary provider models.
  const model = imageDataUrl ? env.aiVisionModel || env.aiModel : env.aiModel;
  const result = await callProvider(fetchImpl, env, model, buildMessages(system, user, imageDataUrl));
  if (result.kind === "ok") {
    return json({ data: result.data }, 200, env.allowedOrigin);
  }
  if (result.kind === "http-error") {
    return json({ error: `ai_request_failed:${result.status}`, detail: result.detail }, 502, env.allowedOrigin);
  }
  if (result.kind === "empty") {
    return json({ error: "ai_empty_response" }, 502, env.allowedOrigin);
  }
  return json({ error: "ai_request_failed", detail: result.detail }, 502, env.allowedOrigin);
}
