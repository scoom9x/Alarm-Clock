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
test("bad input is rejected before calling Gemini", () => {
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
    { GEMINI_API_KEY: "private-test-key" },
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
      candidates: [{ content: { parts: [{ text: message }] } }],
    }),
  });
  const malformed = await reply(
    input,
    { GEMINI_API_KEY: "test" },
    model("invalid json"),
  );
  assert.equal(malformed.source, "offline");
  const unsafe = await reply(
    input,
    { GEMINI_API_KEY: "test" },
    model(JSON.stringify({ message: "You are worthless", outcome: "bed" })),
  );
  assert.equal(unsafe.outcome, "continue");
  assert.ok(!unsafe.message.includes("worthless"));
});
test("valid structured model outcome reaches the client", async () => {
  const result = await reply(
    { ...input, messages: [{ role: "user", text: "I need to go to work." }] },
    { GEMINI_API_KEY: "test" },
    async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    message: "You win. Have a good morning!",
                    outcome: "awake",
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
  assert.equal(result.outcome, "awake");
});
