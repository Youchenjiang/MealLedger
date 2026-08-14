// Unit tests for the pure ai-parse handler. Run with `deno test` (or
// `npm run test:edge`). The suite injects fake auth and fetch dependencies,
// so no Supabase project or provider credentials are required.

import { handleAiParseRequest, type AiParseDeps } from "./handler.ts";

const BASE_URL = "http://edge/ai-parse";
const OK_CONTENT = '{"items":[]}';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEq(actual: unknown, expected: unknown, message?: string): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    message ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertIncludes(haystack: string, needle: string, message?: string): void {
  assert(haystack.includes(needle), message ?? `expected ${JSON.stringify(haystack)} to include ${JSON.stringify(needle)}`);
}

function makeDeps(overrides: {
  env?: Partial<AiParseDeps["env"]>;
  getUser?: AiParseDeps["getUser"];
  fetchImpl?: AiParseDeps["fetchImpl"];
} = {}): AiParseDeps {
  const env: AiParseDeps["env"] = {
    aiApiKey: "test-key",
    aiBaseUrl: "https://api.openai.com/v1",
    aiModel: "gpt-4o-mini",
    aiVisionModel: "gpt-4o",
    allowedOrigin: "*",
    maxBodyBytes: 4 * 1024 * 1024,
    requireAuth: true,
    // Tiny backoff so retry tests never sleep; the default env overrides
    // these where a test exercises the real retry policy.
    providerTimeoutMs: 20_000,
    providerMaxAttempts: 3,
    providerBackoffMs: 1,
    providerBackoffMaxMs: 2,
  };
  Object.assign(env, overrides.env);
  return {
    env,
    getUser: overrides.getUser ?? (() => Promise.resolve({ data: { user: { id: "user-1" } }, error: null })),
    fetchImpl: overrides.fetchImpl ?? (() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: OK_CONTENT } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )),
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-token", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function jsonBody(response: Response): Promise<unknown> {
  return await response.json();
}

function fetchCapture(): { calls: Array<{ url: string; init: RequestInit }>; deps: AiParseDeps } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const deps = makeDeps({
    fetchImpl: (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: OK_CONTENT } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    },
  });
  return { calls, deps };
}

Deno.test("rejects requests without an authorization header", async () => {
  const deps = makeDeps();
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }, { authorization: "" }), deps);

  assertEq(response.status, 401);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "missing_authorization");
});

Deno.test("rejects requests whose bearer token does not resolve to a user", async () => {
  const deps = makeDeps({
    getUser: () => Promise.resolve({ data: null, error: new Error("bad token") }),
  });
  const response = await handleAiParseRequest(
    post({ system: "s", user: "u" }, { authorization: "Bearer invalid" }),
    deps,
  );

  assertEq(response.status, 401);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "invalid_user");
});

Deno.test("skips the auth gate when requireAuth is disabled", async () => {
  let getUserCalled = false;
  const deps = makeDeps({
    env: { requireAuth: false },
    getUser: () => {
      getUserCalled = true;
      return Promise.resolve({ data: null, error: new Error("should not be called") });
    },
  });
  const response = await handleAiParseRequest(
    post({ system: "s", user: "u" }, { authorization: "" }),
    deps,
  );

  assertEq(response.status, 200);
  assertEq(getUserCalled, false);
});

Deno.test("still serves signed-in requests when requireAuth is disabled", async () => {
  const deps = makeDeps({ env: { requireAuth: false } });
  const response = await handleAiParseRequest(
    post({ system: "s", user: "u" }, { authorization: "Bearer abc.def.ghi" }),
    deps,
  );

  assertEq(response.status, 200);
});

Deno.test("passes the bare token to getUser and accepts a valid session", async () => {
  const tokens: string[] = [];
  const deps = makeDeps({
    getUser: (token) => {
      tokens.push(token);
      return Promise.resolve({ data: { user: { id: "user-1" } }, error: null });
    },
  });
  const response = await handleAiParseRequest(
    post({ system: "s", user: "u" }, { authorization: "Bearer abc.def.ghi" }),
    deps,
  );

  assertEq(response.status, 200);
  assertEq(tokens, ["abc.def.ghi"]);
});

Deno.test("selects the text model for text-only requests", async () => {
  const { calls, deps } = fetchCapture();
  await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(calls.length, 1);
  const body = JSON.parse(String(calls[0].init.body)) as { model?: string };
  assertEq(body.model, "gpt-4o-mini");
});

Deno.test("selects the vision model for image requests", async () => {
  const { calls, deps } = fetchCapture();
  await handleAiParseRequest(
    post({ system: "s", user: "u", imageDataUrl: "data:image/png;base64,QUFB" }),
    deps,
  );

  const body = JSON.parse(String(calls[0].init.body)) as { model?: string };
  assertEq(body.model, "gpt-4o");
});

Deno.test("falls back to the text model when the vision model is unset", async () => {
  const { calls, deps } = fetchCapture();
  deps.env.aiVisionModel = "";
  await handleAiParseRequest(
    post({ system: "s", user: "u", imageDataUrl: "data:image/png;base64,QUFB" }),
    deps,
  );

  const body = JSON.parse(String(calls[0].init.body)) as { model?: string };
  assertEq(body.model, "gpt-4o-mini");
});

Deno.test("sends the OpenAI chat-completions shape with the provider key", async () => {
  const { calls, deps } = fetchCapture();
  await handleAiParseRequest(post({ system: "sys", user: "usr" }), deps);

  assertEq(calls.length, 1);
  assertEq(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assertEq(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assertEq(headers["Content-Type"], "application/json");
  assertEq(headers["Authorization"], "Bearer test-key");
  const body = JSON.parse(String(calls[0].init.body)) as {
    messages: Array<{ role: string; content: unknown }>;
    response_format?: { type: string };
  };
  assertEq(body.messages[0], { role: "system", content: "sys" });
  assertEq(body.messages[1], { role: "user", content: "usr" });
  assertEq(body.response_format, { type: "json_object" });
});

Deno.test("builds the image_url content part for image requests", async () => {
  const { calls, deps } = fetchCapture();
  await handleAiParseRequest(
    post({ system: "s", user: "u", imageDataUrl: "data:image/jpeg;base64,QUJD" }),
    deps,
  );

  const body = JSON.parse(String(calls[0].init.body)) as {
    messages: Array<{ role: string; content: Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  };
  const content = body.messages[1].content;
  assertEq(content[0], { type: "text", text: "u" });
  assertEq(content[1], { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } });
});

Deno.test("defaults the image text prompt when the user field is empty", async () => {
  const { calls, deps } = fetchCapture();
  await handleAiParseRequest(
    post({ user: "", imageDataUrl: "data:image/png;base64,QUFB" }),
    deps,
  );

  const body = JSON.parse(String(calls[0].init.body)) as {
    messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }>;
  };
  const userMessage = body.messages[body.messages.length - 1];
  assertIncludes(String(userMessage.content[0].text), "發票");
});

Deno.test("omits the system message when system is empty", async () => {
  const { calls, deps } = fetchCapture();
  await handleAiParseRequest(post({ system: "", user: "u" }), deps);

  const body = JSON.parse(String(calls[0].init.body)) as { messages: Array<{ role: string }> };
  assertEq(body.messages.map((message) => message.role), ["user"]);
});

Deno.test("returns the parsed provider JSON as data", async () => {
  const deps = makeDeps();
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 200);
  assertEq(await jsonBody(response), { data: { items: [] } });
});

Deno.test("surfaces a persistent provider HTTP failure as a 502 with detail", async () => {
  const deps = makeDeps({
    fetchImpl: () => Promise.resolve(new Response("upstream exploded", { status: 500 })),
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 502);
  const body = await jsonBody(response) as { error?: string; detail?: string };
  assertEq(body.error, "ai_request_failed:500");
  assertEq(body.detail, "upstream exploded");
});

Deno.test("retries a transient provider overload and succeeds on a later attempt", async () => {
  let calls = 0;
  const deps = makeDeps({
    fetchImpl: () => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(new Response("overloaded", { status: 529 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: OK_CONTENT } }] }), { status: 200 }),
      );
    },
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 200);
  assertEq(calls, 2);
});

Deno.test("returns the last failure when every retry is transient", async () => {
  let calls = 0;
  const deps = makeDeps({
    fetchImpl: () => {
      calls += 1;
      return Promise.resolve(new Response("still overloaded", { status: 529 }));
    },
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 502);
  const body = await jsonBody(response) as { error?: string; detail?: string };
  assertEq(body.error, "ai_request_failed:529");
  assertEq(body.detail, "still overloaded");
  assertEq(calls, 3);
});

Deno.test("does not retry permanent provider errors", async () => {
  let calls = 0;
  const deps = makeDeps({
    fetchImpl: () => {
      calls += 1;
      return Promise.resolve(new Response("bad request", { status: 400 }));
    },
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 502);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "ai_request_failed:400");
  assertEq(calls, 1);
});

Deno.test("aborts a provider call that exceeds the per-attempt timeout", async () => {
  let calls = 0;
  const deps = makeDeps({
    env: { providerTimeoutMs: 30, providerMaxAttempts: 1 },
    fetchImpl: (_input, init) => {
      calls += 1;
      // Never resolves on its own; the abort signal must reject the call so
      // the handler does not hang past the timeout.
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    },
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 502);
  const body = await jsonBody(response) as { error?: string; detail?: string };
  assertEq(body.error, "ai_request_failed");
  assertIncludes(String(body.detail), "aborted");
  assertEq(calls, 1);
});

Deno.test("returns ai_empty_response when the provider sends no content", async () => {
  const deps = makeDeps({
    fetchImpl: () =>
      Promise.resolve(new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })),
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 502);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "ai_empty_response");
});

Deno.test("surfaces malformed provider JSON as a 502", async () => {
  const deps = makeDeps({
    fetchImpl: () =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }),
      ),
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 502);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "ai_request_failed");
});

Deno.test("surfaces a throwing provider fetch as a 502", async () => {
  const deps = makeDeps({
    fetchImpl: () => Promise.reject(new Error("socket hang up")),
  });
  const response = await handleAiParseRequest(post({ system: "s", user: "u" }), deps);

  assertEq(response.status, 502);
  const body = await jsonBody(response) as { error?: string; detail?: string };
  assertEq(body.error, "ai_request_failed");
  assertIncludes(String(body.detail), "socket hang up");
});

Deno.test("answers OPTIONS preflight without auth", async () => {
  const deps = makeDeps();
  const response = await handleAiParseRequest(new Request(BASE_URL, { method: "OPTIONS" }), deps);

  assertEq(response.status, 204);
  assertEq(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

Deno.test("rejects non-POST methods", async () => {
  const deps = makeDeps();
  const response = await handleAiParseRequest(new Request(BASE_URL, { method: "GET" }), deps);

  assertEq(response.status, 405);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "method_not_allowed");
});

Deno.test("rejects oversized request bodies via the content-length header", async () => {
  const deps = makeDeps({ env: { maxBodyBytes: 100 } });
  // In-process Request objects do not derive content-length automatically,
  // so the header is set explicitly to simulate a real HTTP request.
  const response = await handleAiParseRequest(
    post("x".repeat(200), { authorization: "Bearer t", "content-length": "200" }),
    deps,
  );

  assertEq(response.status, 413);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "request_too_large");
});

Deno.test("rejects oversized bodies even without a content-length header", async () => {
  const deps = makeDeps({ env: { maxBodyBytes: 100 } });
  const response = await handleAiParseRequest(
    post("x".repeat(200), { authorization: "Bearer t" }),
    deps,
  );

  assertEq(response.status, 413);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "request_too_large");
});

Deno.test("rejects malformed or non-object bodies", async () => {
  const deps = makeDeps();
  const notJson = await handleAiParseRequest(post("not-json"), deps);
  assertEq(notJson.status, 400);
  assertEq((await jsonBody(notJson) as { error?: string }).error, "invalid_body");

  // Arrays are typeof object, so they pass the body guard and then hit the
  // empty-input check like the production handler did before this refactor.
  const arrayBody = await handleAiParseRequest(post([1, 2]), deps);
  assertEq(arrayBody.status, 400);
  assertEq((await jsonBody(arrayBody) as { error?: string }).error, "empty_input");
});

Deno.test("rejects empty input with no image", async () => {
  const deps = makeDeps();
  const response = await handleAiParseRequest(
    post({ system: "", user: "   " }, { authorization: "Bearer t" }),
    deps,
  );

  assertEq(response.status, 400);
  const body = await jsonBody(response) as { error?: string };
  assertEq(body.error, "empty_input");
});
