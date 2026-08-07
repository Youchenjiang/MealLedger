import { afterEach, describe, expect, test, vi } from "vitest";
import { requestAiJson } from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("requestAiJson", () => {
  test("returns a setup message when no key is configured", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const result = await requestAiJson({ system: "s", user: "u" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("AI");
  });

  test("calls the OpenAI chat-completions shape and parses JSON", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_PROVIDER", "openai");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiJson({ system: "s", user: "u", imageDataUrl: "data:image/jpeg;base64,QUJD" });

    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages[1].content[0].type).toBe("text");
    expect(body.messages[1].content[1]).toMatchObject({ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } });
  });

  test("uses a custom base URL when AI_BASE_URL is set", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_BASE_URL", "https://api.tokenrouter.com/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"items":[]}' } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiJson({ system: "sys", user: "usr" });

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.tokenrouter.com/v1/chat/completions");
  });

  test("calls the Gemini generateContent shape with an inline image", async () => {
    vi.stubEnv("AI_API_KEY", "gem-key");
    vi.stubEnv("AI_PROVIDER", "gemini");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }] }),
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const result = await requestAiJson({ system: "s", user: "u" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("401");
  });

  test("surfaces malformed JSON responses", async () => {
    vi.stubEnv("AI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not-json" } }] }),
    }));

    const result = await requestAiJson({ system: "s", user: "u" });

    expect(result.ok).toBe(false);
  });
});
