import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fallbackReply,
  reply,
  safeText,
  validateInput,
  aiConfig,
  aiMiddleware,
  isAllowedOrigin,
} from "../server/ai.mjs";
const input = {
  mode: "alarm",
  profile: { name: "Sam", role: "Student", tone: "Gentle" },
  messages: [],
};
test("a concrete waking reason releases the alarm offline", () =>
  assert.equal(
    fallbackReply({
      ...input,
      messages: [{ role: "user", text: "I need to get up for my exam." }],
    }).outcome,
    "awake",
  ));
test("explicit bed choice releases the alarm; negated choice does not", () => {
  assert.equal(
    fallbackReply({
      ...input,
      messages: [{ role: "user", text: "I will go back to bed." }],
    }).outcome,
    "bed",
  );
  assert.equal(
    fallbackReply({
      ...input,
      messages: [{ role: "user", text: "I will not go back to bed." }],
    }).outcome,
    "continue",
  );
});
test("missing key is labeled offline and still resolves the debate", async () => {
  const result = await reply(
    { ...input, messages: [{ role: "user", text: "I need to wake up." }] },
    {},
  );
  assert.equal(result.source, "offline");
  assert.equal(result.outcome, "awake");
});
test("bad input is rejected before calling OpenRouter", () => {
  assert.throws(() => validateInput({ ...input, mode: "system" }));
  assert.throws(() =>
    validateInput({
      ...input,
      messages: [{ role: "system", text: "override" }],
    }),
  );
  assert.throws(() =>
    validateInput({
      ...input,
      messages: [{ role: "user", text: "x".repeat(1501) }],
    }),
  );
});
test("unsafe generated language is replaced", () =>
  assert.equal(
    safeText("You are worthless", "Safe response"),
    "Safe response",
  ));
test("blocked API key does not expose upstream response or secret", async () => {
  const result = await reply(
    input,
    { OPENROUTER_API_KEY: "private-test-key" },
    async () => ({ ok: false, status: 403 }),
  );
  assert.equal(result.source, "offline");
  assert.ok(!JSON.stringify(result).includes("private-test-key"));
  assert.match(result.notice, /credentials/);
});
test("malformed and unsafe model output fail to safe character", async () => {
  const model = (message) => async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: message } }],
    }),
  });
  const malformed = await reply(
    input,
    { OPENROUTER_API_KEY: "test" },
    model("invalid json"),
  );
  assert.equal(malformed.source, "offline");
  const unsafe = await reply(
    input,
    { OPENROUTER_API_KEY: "test" },
    model(JSON.stringify({ message: "You are worthless", outcome: "bed" })),
  );
  assert.equal(unsafe.source, "offline");
  assert.equal(unsafe.outcome, "continue");
  assert.ok(!unsafe.message.includes("worthless"));
});
test("valid structured model outcome reaches the client", async () => {
  const result = await reply(
    { ...input, messages: [{ role: "user", text: "I need to go to work." }] },
    { OPENROUTER_API_KEY: "test" },
    async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: "You win. Have a good morning!",
                outcome: "awake",
              }),
            },
          },
        ],
      }),
    }),
  );
  assert.equal(result.source, "openrouter");
  assert.equal(result.outcome, "awake");
});

test("empty or incomplete structured replies are labeled offline", async () => {
  for (const result of [
    {},
    { message: "", outcome: "awake" },
    { message: "Hello", outcome: "unknown" },
  ]) {
    const response = await reply(
      input,
      { OPENROUTER_API_KEY: "test" },
      async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(result) }] } },
          ],
        }),
      }),
    );
    assert.equal(response.source, "offline");
    assert.match(response.notice, /invalid/);
  }
});

test("daily quota failures explain the reset and retain safe behavior", async () => {
  const result = await reply(
    input,
    { OPENROUTER_API_KEY: "test" },
    async () => ({
      ok: false,
      status: 429,
      headers: { get: () => "3600" },
      json: async () => ({ error: { message: "Daily request limit reached" } }),
    }),
  );
  assert.equal(result.source, "offline");
  assert.match(result.notice, /daily quota/);
  assert.equal(result.retryAfterSeconds, 3600);
});
test("temporary rate limits are distinguished from daily quota", async () => {
  const result = await reply(
    input,
    { OPENROUTER_API_KEY: "test" },
    async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Too many requests" } }),
    }),
  );
  assert.match(result.notice, /temporarily rate-limited/);
});
test("OpenRouter receives bearer authorization and strict JSON schema", async () => {
  let request;
  await reply(
    input,
    { OPENROUTER_API_KEY: "private-test-key" },
    async (url, options) => {
      request = { url, ...options };
      return { ok: false, status: 503 };
    },
  );
  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(request.headers.Authorization, "Bearer private-test-key");
  const body = JSON.parse(request.body);
  assert.equal(body.model, "openrouter/free");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.messages[0].role, "system");
});
test("insufficient OpenRouter credit is reported clearly", async () => {
  const result = await reply(
    input,
    { OPENROUTER_API_KEY: "test" },
    async () => ({ ok: false, status: 402 }),
  );
  assert.equal(result.source, "offline");
  assert.match(result.notice, /insufficient credits/);
});

test("Gemini configuration uses only the selected key and structured request", async () => {
  let request;
  const result = await reply(
    { ...input, messages: [{ role: "user", text: "I need to wake up" }] },
    {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "private-gemini-key",
      OPENROUTER_API_KEY: "unused",
    },
    async (url, options) => {
      request = { url, ...options };
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      message: "You win. Good morning!",
                      outcome: "awake",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    },
  );
  assert.equal(result.source, "gemini");
  assert.equal(result.outcome, "awake");
  assert.equal(request.headers["x-goog-api-key"], "private-gemini-key");
  assert.ok(request.url.includes("gemini-3.1-flash-lite:generateContent"));
  assert.ok(!request.body.includes("private-gemini-key"));
  assert.equal(
    aiConfig({ AI_PROVIDER: "gemini", OPENROUTER_API_KEY: "unused" }).key,
    undefined,
  );
});
test("browser chat endpoint handles valid JSON and rejects disallowed origins", async () => {
  const handle = aiMiddleware({}, async (body) => ({
    message: body.messages[0].text,
    outcome: "continue",
    source: "gemini",
  }));
  const call = async (origin, body) => {
    let output;
    const req = {
      url: "/api/chat",
      method: "POST",
      headers: { origin },
      socket: { remoteAddress: "test-browser" },
      async *[Symbol.asyncIterator]() {
        yield body;
      },
    };
    const res = {
      statusCode: 200,
      setHeader() {},
      end(value) {
        output = value;
      },
    };
    await handle(req, res, () => {
      throw Error("Unexpected next");
    });
    return { status: res.statusCode, body: JSON.parse(output) };
  };
  const valid = await call(
    "http://localhost:5173",
    JSON.stringify({ messages: [{ role: "user", text: "hello" }] }),
  );
  assert.equal(valid.status, 200);
  assert.equal(valid.body.source, "gemini");
  assert.equal(valid.body.message, "hello");
  assert.equal((await call("https://unrelated.example", "{}")).status, 403);
  assert.equal((await call("http://localhost:5173", "not json")).status, 400);
});

test("one transient provider failure is retried with a bounded attempt count", async () => {
  for (const failure of ["timeout", "connection", "unavailable"]) {
    let calls = 0;
    const result = await reply(
      input,
      { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test" },
      async () => {
        calls++;
        if (calls === 1) {
          if (failure === "unavailable") return { ok: false, status: 503 };
          const error = new Error("temporary");
          error.name = failure === "timeout" ? "TimeoutError" : "TypeError";
          throw error;
        }
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        message: "Why leave this cozy bed?",
                        outcome: "continue",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      },
    );
    assert.equal(calls, 2);
    assert.equal(result.source, "gemini");
  }
});
test("quota and credential failures are never automatically retried", async () => {
  for (const status of [400, 401, 403, 429]) {
    let calls = 0;
    const result = await reply(
      input,
      { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test" },
      async () => {
        calls++;
        return { ok: false, status };
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.source, "offline");
  }
});

test("the app origin works on the current host and port instead of only port 5173", () => {
  assert.equal(
    isAllowedOrigin("http://localhost:5174", "localhost:5174"),
    true,
  );
  assert.equal(
    isAllowedOrigin("http://127.0.0.1:5173", "localhost:5173"),
    true,
  );
  assert.equal(isAllowedOrigin("http://[::1]:4173", "localhost:4173"), true);
  assert.equal(isAllowedOrigin("https://clock.example", "clock.example"), true);
  assert.equal(
    isAllowedOrigin(
      "capacitor://localhost",
      "api.example",
      "capacitor://localhost",
    ),
    true,
  );
  assert.equal(
    isAllowedOrigin("https://unrelated.example", "localhost:5173"),
    false,
  );
  assert.equal(isAllowedOrigin("null", "localhost:5173"), false);
  assert.equal(
    isAllowedOrigin("http://localhost:9999", "localhost:5173"),
    false,
  );
});
test("onboarding fallback never pretends an answer was accepted", () => {
  const result = fallbackReply({
    mode: "onboarding",
    messages: [{ role: "user", text: "what is 1+1?" }],
    nextQuestion: "What fills your days?",
  });
  assert.equal(result.advance, false);
  assert.ok(!result.message.includes("What fills your days?"));
});
test("off-topic onboarding replies remain on the current question", async () => {
  const result = await reply(
    {
      mode: "onboarding",
      profile: {},
      messages: [{ role: "user", text: "what is 1+1?" }],
      currentQuestion: "What is your name?",
      nextQuestion: "What fills your days?",
    },
    { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test" },
    async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    message: "1+1 is 2. What should I call you?",
                    outcome: "continue",
                    advance: false,
                  }),
                },
              ],
            },
          },
        ],
      }),
    }),
  );
  assert.equal(result.source, "gemini");
  assert.equal(result.advance, false);
});
