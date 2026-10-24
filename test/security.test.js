import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";
import { canWriteAdmin, canWriteFellowship } from "../src/lib/auth.js";
import { SESSION_COOKIE_NAME, createSignedCookieValue } from "../src/lib/cookies.js";
import { handleApi } from "../src/routes/api.js";

test("missing OIDC configuration fails closed", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/bootstrap"), {});
  assert.equal(response.status, 503);
});

test("anonymous requests cannot write", () => {
  const request = new Request("https://example.com/api/tallies");
  assert.equal(canWriteAdmin(request), false);
  assert.equal(canWriteFellowship(request, "大江戸"), false);
});

test("client supplied group and role headers cannot escalate a session", async () => {
  const secret = "test-session-secret";
  const cookie = await createSignedCookieValue(secret, {
    user: { loginId: "member", fellowship: "大江戸", role: "" },
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const request = new Request("https://example.com/", {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
      "x-dailytally-role": "admin",
      "x-authentik-groups": "admin",
    },
  });
  const env = {
    AUTHENTIK_ISSUER: "https://auth.example.com",
    AUTHENTIK_CLIENT_ID: "client",
    AUTHENTIK_CLIENT_SECRET: "secret",
    SESSION_SECRET: secret,
    ASSETS: { fetch: (trustedRequest) => Response.json({ admin: canWriteAdmin(trustedRequest) }) },
  };
  const response = await worker.fetch(request, env);
  assert.deepEqual(await response.json(), { admin: false });
});

test("cross-origin POST is rejected", async () => {
  const request = new Request("https://example.com/api/active-ceremony", {
    method: "POST",
    headers: { origin: "https://attacker.example", "x-dailytally-role": "admin" },
    body: "{}",
  });
  assert.equal((await handleApi(request, {})).status, 403);
});

test("oversized JSON is rejected before database access", async () => {
  const request = new Request("https://example.com/api/active-ceremony", {
    method: "POST",
    headers: { "x-dailytally-role": "admin" },
    body: JSON.stringify({ padding: "x".repeat(17 * 1024) }),
  });
  assert.equal((await handleApi(request, {})).status, 413);
});
