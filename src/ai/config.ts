export type AiProvider = "openai" | "gemini";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

const env = import.meta.env;

export function readAiConfig(): AiConfig | null {
  const apiKey = (env.AI_API_KEY as string | undefined)?.trim();
  if (!apiKey) {
    return null;
  }
  const providerRaw = (env.AI_PROVIDER as string | undefined)?.trim().toLowerCase();
  const provider: AiProvider = providerRaw === "gemini" ? "gemini" : "openai";
  const model = (env.AI_MODEL as string | undefined)?.trim()
    || (provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini");
  return { provider, apiKey, model };
}

export function isAiConfigured(): boolean {
  return readAiConfig() !== null;
}
