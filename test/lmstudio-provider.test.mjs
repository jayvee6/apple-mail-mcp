// LMStudioProvider against a mock that mirrors LM Studio 0.4's real responses:
// its native POST /api/v1/chat takes `input` (not `messages`) and 400s on a
// chat-completions-shaped body; the OpenAI-compatible /v1/chat/completions
// returns `choices`. Run with `npm test` (builds first; imports from dist/).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { LMStudioProvider } from "../dist/ai/lmstudio-provider.js";

function startMockLMStudio() {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = (code, obj) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.method === "POST" && req.url === "/api/v1/chat") {
        if (!JSON.parse(body).input) {
          return json(400, { error: { message: "'input' is required", type: "invalid_request", param: "input" } });
        }
        return json(200, { output: [{ type: "message", content: "OK" }] });
      }
      if (req.method === "POST" && req.url === "/v1/chat/completions") {
        const { messages } = JSON.parse(body);
        assert.ok(Array.isArray(messages), "chat completions body must carry messages");
        return json(200, { choices: [{ message: { role: "assistant", content: " OK " }, finish_reason: "stop" }] });
      }
      if (req.method === "GET" && (req.url === "/v1/models" || req.url === "/api/v1/models")) {
        return json(200, { data: [{ id: "google/gemma-4-e4b" }] });
      }
      json(404, { error: "not found" });
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }))
  );
}

test("complete() returns the model's reply from a stock LM Studio server", async () => {
  const { server, url } = await startMockLMStudio();
  try {
    const provider = new LMStudioProvider(url, "google/gemma-4-e4b");
    assert.equal(await provider.complete([{ role: "user", content: "Say OK" }]), "OK");
  } finally {
    server.close();
  }
});

test("isAvailable() is true when the server lists models", async () => {
  const { server, url } = await startMockLMStudio();
  try {
    assert.equal(await new LMStudioProvider(url, "google/gemma-4-e4b").isAvailable(), true);
  } finally {
    server.close();
  }
});

test("provider still reports itself as lmstudio", () => {
  assert.equal(new LMStudioProvider("http://127.0.0.1:1", "m").name, "lmstudio");
});
