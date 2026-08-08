export type AiProvider = "openai" | "gemini";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  visionModel?: string;
  baseUrl: string;
  edgeFunctionUrl?: string;
};

const env = import.meta.env;

const DEFAULT_BASE_URLS: Record<AiProvider, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

export function readAiConfig(): AiConfig | null {
  const edgeFunctionUrl = (env.AI_EDGE_FUNCTION_URL as string | undefined)?.trim() || undefined;
  const apiKey = (env.AI_API_KEY as string | undefined)?.trim() ?? "";
  if (!apiKey && !edgeFunctionUrl) {
    return null;
  }
  const providerRaw = (env.AI_PROVIDER as string | undefined)?.trim().toLowerCase();
  const provider: AiProvider = providerRaw === "gemini" ? "gemini" : "openai";
  const model = (env.AI_MODEL as string | undefined)?.trim()
    || (provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini");
  const visionModel = (env.AI_VISION_MODEL as string | undefined)?.trim() || undefined;
  const baseUrl = (env.AI_BASE_URL as string | undefined)?.trim().replace(/\/+$/, "")
    || DEFAULT_BASE_URLS[provider];
  return { provider, apiKey, model, visionModel, baseUrl, edgeFunctionUrl };
}

export function isAiConfigured(): boolean {
  return readAiConfig() !== null;
}
