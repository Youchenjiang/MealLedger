import { afterEach, describe, expect, test, vi } from "vitest";
import { requestAiJson } from "./client";

const EDGE_FUNCTION_URL = "http://127.0.0.1:54321/functions/v1/ai-parse";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("requestAiJson", () => {
  test("returns a setup message when no key and no edge function are configured", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
    const result = await requestAiJson({ system: "s", user: "u" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("AI");
  });

  describe("edge function proxy (production route)", () => {
    test("calls the configured ai-parse edge function and parses the returned data", async () => {
      vi.stubEnv("AI_EDGE_FUNCTION_URL", EDGE_FUNCTION_URL);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ data: { items: [] } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestAiJson({ system: "sys", user: "usr" });

      expect(result.ok).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe(EDGE_FUNCTION_URL);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.system).toBe("sys");
      expect(body.user).toBe("usr");
      expect(body).not.toHaveProperty("imageDataUrl");
    });

    test("forwards image data so the server can route to the vision model", async () => {
      vi.stubEnv("AI_EDGE_FUNCTION_URL", EDGE_FUNCTION_URL);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ data: { items: [] } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestAiJson({
        system: "s",
        user: "u",
        imageDataUrl: "data:image/jpeg;base64,QUJD",
      });

      expect(result.ok).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe(EDGE_FUNCTION_URL);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.system).toBe("s");
      expect(body.user).toBe("u");
      expect(body.imageDataUrl).toBe("data:image/jpeg;base64,QUJD");
    });

    test("routes through the edge function even when a provider base URL is configured", async () => {
      vi.stubEnv("AI_EDGE_FUNCTION_URL", EDGE_FUNCTION_URL);
      vi.stubEnv("AI_BASE_URL", "https://api.tokenrouter.com/v1/");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ data: { items: [] } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await requestAiJson({ system: "s", user: "u" });

      expect(fetchMock.mock.calls[0][0]).toBe(EDGE_FUNCTION_URL);
    });

    test("surfaces edge function HTTP errors", async () => {
      vi.stubEnv("AI_EDGE_FUNCTION_URL", EDGE_FUNCTION_URL);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await requestAiJson({ system: "s", user: "u" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("401");
    });

    test("surfaces edge function error payloads", async () => {
      vi.stubEnv("AI_EDGE_FUNCTION_URL", EDGE_FUNCTION_URL);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ error: "ai_empty_response" }),
      }));

      const result = await requestAiJson({ system: "s", user: "u" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("ai_empty_response");
    });
  });

  describe("direct provider fallback (AI_EDGE_FUNCTION_URL unset)", () => {
    test("calls the OpenAI chat-completions shape and parses JSON", async () => {
      vi.stubEnv("AI_API_KEY", "test-key");
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestAiJson({ system: "sys", user: "usr" });

      expect(result.ok).toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/chat/completions");
      const body = JSON.parse(init.body as string);
      expect(body.messages[0].content).toBe("sys");
      expect(body.messages[1].content).toBe("usr");
      expect(body.response_format).toEqual({ type: "json_object" });
    });

    test("sends an image to OpenAI as an image_url content part", async () => {
      vi.stubEnv("AI_API_KEY", "test-key");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestAiJson({ system: "s", user: "u", imageDataUrl: "data:image/jpeg;base64,QUJD" });

      expect(result.ok).toBe(true);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.messages[1].content[0].type).toBe("text");
      expect(body.messages[1].content[1]).toMatchObject({ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } });
    });

    test("routes image requests to AI_VISION_MODEL and text to AI_MODEL", async () => {
      vi.stubEnv("AI_API_KEY", "test-key");
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("AI_MODEL", "fast-model");
      vi.stubEnv("AI_VISION_MODEL", "vision-model");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await requestAiJson({ system: "s", user: "u" });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe("fast-model");

      await requestAiJson({ system: "s", user: "u", imageDataUrl: "data:image/jpeg;base64,QUJD" });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).model).toBe("vision-model");
    });

    test("falls back to AI_MODEL for images when AI_VISION_MODEL is unset", async () => {
      vi.stubEnv("AI_API_KEY", "test-key");
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("AI_MODEL", "fast-model");
      vi.stubEnv("AI_VISION_MODEL", "");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await requestAiJson({ system: "s", user: "u", imageDataUrl: "data:image/jpeg;base64,QUJD" });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe("fast-model");
    });

    test("uses a custom base URL when AI_BASE_URL is set", async () => {
      vi.stubEnv("AI_API_KEY", "test-key");
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("AI_BASE_URL", "https://api.tokenrouter.com/v1");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestAiJson({ system: "sys", user: "usr" });

      expect(result.ok).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.tokenrouter.com/v1/chat/completions");
    });

    test("normalizes a trailing slash on the custom base URL", async () => {
      vi.stubEnv("AI_API_KEY", "test-key");
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("AI_BASE_URL", "https://api.tokenrouter.com/v1/");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestAiJson({ system: "sys", user: "usr" });

      expect(result.ok).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.tokenrouter.com/v1/chat/completions");
    });

    test("calls the Gemini generateContent shape with an inline image", async () => {
      vi.stubEnv("AI_API_KEY", "gem-key");
      vi.stubEnv("AI_PROVIDER", "gemini");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await requestAiJson({ system: "sys", user: "辨識", imageDataUrl: "data:image/png;base64,QUFB" });

      expect(result.ok).toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("generateContent");
      const body = JSON.parse(init.body as string);
      expect(body.systemInstruction.parts[0].text).toBe("sys");
      expect(body.contents[0].parts[1]).toMatchObject({ inline_data: { mime_type: "image/png", data: "QUFB" } });
    });

    test("surfaces provider HTTP errors", async () => {
      vi.stubEnv("AI_API_KEY", "k");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await requestAiJson({ system: "s", user: "u" });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("401");
    });

    test("surfaces malformed JSON responses", async () => {
      vi.stubEnv("AI_API_KEY", "k");
      vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: "not-json" } }] }),
      }));

      const result = await requestAiJson({ system: "s", user: "u" });

      expect(result.ok).toBe(false);
    });

    test("aborts a hanging direct provider request after the timeout", async () => {
      vi.useFakeTimers();
      try {
        vi.stubEnv("AI_API_KEY", "test-key");
        vi.stubEnv("AI_PROVIDER", "openai");
        vi.stubEnv("AI_EDGE_FUNCTION_URL", "");
        let capturedSignal: AbortSignal | undefined;
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => {
          capturedSignal = init?.signal ?? undefined;
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
          });
        }));

        const pending = requestAiJson({ system: "s", user: "u" });
        await vi.advanceTimersByTimeAsync(90_000);

        expect(capturedSignal?.aborted).toBe(true);
        const result = await pending;
        expect(result.ok).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
