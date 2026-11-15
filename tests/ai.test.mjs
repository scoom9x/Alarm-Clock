import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fallbackReply,
  reply,
  safeText,
  validateInput,
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
