import { readAiConfig } from "./config";
import { supabase } from "../lib/supabase";

export type AiRequest = {
  system: string;
  user: string;
  imageDataUrl?: string;
};

export type AiResult = { ok: true; data: unknown } | { ok: false; message: string };

async function currentAccessToken(): Promise<string> {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const REQUEST_TIMEOUT_MS = 90_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAiViaEdgeFunction(edgeFunctionUrl: string, request: AiRequest): Promise<unknown> {
  const token = await currentAccessToken();
  const response = await fetchWithTimeout(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      system: request.system,
      user: request.user,
      imageDataUrl: request.imageDataUrl ?? undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}).`);
  }
  const payload = (await response.json()) as { data?: unknown; error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload.data;
}

function extractImage(imageDataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(imageDataUrl);
  if (!match) {
    throw new Error("The selected image could not be read.");
  }
  return { mimeType: match[1], base64: match[2] };
}

function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("The AI returned an empty response.");
  }
  // Strip markdown fences if the provider wrapped the JSON.
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

async function requestOpenAi(baseUrl: string, apiKey: string, model: string, request: AiRequest): Promise<unknown> {
  const messages = [
    { role: "system", content: request.system },
    {
      role: "user",
      content: request.imageDataUrl
        ? [
            { type: "text", text: request.user },
            { type: "image_url", image_url: { url: request.imageDataUrl } },
          ]
        : request.user,
    },
  ];
  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}).`);
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("The AI returned no content.");
  }
  return parseJsonResponse(content);
}

async function requestGemini(baseUrl: string, apiKey: string, model: string, request: AiRequest): Promise<unknown> {
  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [{ text: request.user }];
  if (request.imageDataUrl) {
    const image = extractImage(request.imageDataUrl);
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  }
  const response = await fetchWithTimeout(
    `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: request.system }] },
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}).`);
  }
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("The AI returned no content.");
  }
  return parseJsonResponse(text);
}

export async function requestAiJson(request: AiRequest): Promise<AiResult> {
  const config = readAiConfig();
  if (!config) {
    return { ok: false, message: "AI 補帳尚未設定。請在 .env 設定 AI_API_KEY 與 AI_PROVIDER。" };
  }
  try {
    if (config.edgeFunctionUrl) {
      const data = await requestAiViaEdgeFunction(config.edgeFunctionUrl, request);
      return { ok: true, data };
    }
    const { baseUrl } = config;
    // Vision requests (receipt/invoice photos) use a dedicated vision-capable
    // model when configured; text parsing keeps the fast default model.
    const model = request.imageDataUrl ? config.visionModel ?? config.model : config.model;
    const data = config.provider === "gemini"
      ? await requestGemini(baseUrl, config.apiKey, model, request)
      : await requestOpenAi(baseUrl, config.apiKey, model, request);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "AI 請求失敗,請稍後再試。" };
  }
}
