/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../supabase/functions/send-payment-reminder/index.ts"), "utf8")
  .replace(/^import .*createClient.*;$/m, "");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test("browser preflight succeeds without auth, database access, or a push", async () => {
  let handler;
  vm.runInNewContext(code, {
    Deno: { serve: (fn) => { handler = fn; } },
    createClient: () => assert.fail("Preflight must not access Supabase"),
    fetch: () => assert.fail("Preflight must not send a push"),
    Response,
  });
  const response = await handler(new Request("https://example.test", {
    method: "OPTIONS",
    headers: {
      origin: "https://tripwise.example.test",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization, content-type",
    },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("access-control-allow-methods"), "post, options");
  assert.equal(response.headers.get("access-control-allow-headers"), "authorization, content-type");
  assert.deepEqual(await response.json(), {});
});

async function send({ push, finishErrors = 0 }) {
  let handler;
  const results = [];
  const removed = [];
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: "sender" } } }) },
    from: () => ({
      select: () => ({ eq: async () => ({ data: [{ token: "one" }, { token: "two" }] }) }),
      delete: () => ({ in: async (_column, tokens) => { removed.push(...tokens); return {}; } }),
    }),
    rpc: async (_name, args) => {
      results.push(args);
      if (finishErrors-- > 0) return { error: { message: "temporary database failure" } };
      return { data: true };
    },
  };
  const caller = { rpc: async () => ({ data: {
    attemptId: "attempt", amountMinor: 25000, groupName: "Trip", currency: "INR", senderName: "Sender",
  } }) };
  vm.runInNewContext(code, {
    Deno: { env: { get: (name) => name }, serve: (fn) => { handler = fn; } },
    createClient: (_url, key) => key === "SUPABASE_SERVICE_ROLE_KEY" ? admin : caller,
    fetch: push, Response, AbortSignal, console: { error() {} },
  });
  const response = await handler(new Request("https://example.test", {
    method: "POST", headers: { authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify({ groupId: "00000000-0000-0000-0000-000000000100", recipientId: "00000000-0000-0000-0000-000000000001" }),
  }));
  assert.ok(results.every((args) => args.p_attempt_id === "attempt"));
  return { status: response.status, results: results.map((args) => args.p_sent), removed };
}

for (const [name, push] of [
  ["HTTP rejection", async () => new Response("unavailable", { status: 503 })],
  ["network failure", async () => { throw new TypeError("fetch failed"); }],
  ["timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
  ["invalid response", async () => Response.json({ unexpected: true })],
  ["all tickets rejected", async () => Response.json({ data: [{ status: "error" }, { status: "error" }] })],
]) {
  test(`${name} releases the attempt without marking it sent`, async () => {
    const result = await send({ push });
    assert.equal(result.status, 502);
    assert.deepEqual(result.results, [false]);
  });
}

test("partial acceptance confirms the attempt and removes stale tokens", async () => {
  const result = await send({ push: async () => Response.json({ data: [
    { status: "error", details: { error: "DeviceNotRegistered" } }, { status: "ok", id: "ticket" },
  ] }) });
  assert.equal(result.status, 200);
  assert.deepEqual(result.results, [true]);
  assert.deepEqual(result.removed, ["one"]);
});

test("finalization retries without sending a second push", async () => {
  let pushes = 0;
  const result = await send({ finishErrors: 1, push: async () => {
    pushes += 1;
    return Response.json({ data: [{ status: "ok", id: "ticket" }] });
  } });
  assert.equal(result.status, 200);
  assert.equal(pushes, 1);
  assert.deepEqual(result.results, [true, true]);
});

test("database failure after acceptance never releases the attempt", async () => {
  const result = await send({ finishErrors: 2, push: async () => Response.json({ data: [{ status: "ok", id: "ticket" }] }) });
  assert.equal(result.status, 503);
  assert.deepEqual(result.results, [true, true]);
});
