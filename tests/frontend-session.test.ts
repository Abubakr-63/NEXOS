import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupSession } from "../apps/web/lib/session-lookup";
import { workspaceReturnPath } from "../apps/web/lib/return-path";
test("return paths cannot escape the workspace or inject a redirect URL", () => {
  for (const path of [
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil",
    "/%2fevil",
    "/login",
    "/register",
    "/settings?next=evil",
    "/projects/../login",
    "/projects/a\u0000",
  ])
    assert.equal(workspaceReturnPath(path), "/settings");
  for (const path of [
    "/",
    "/projects/new",
    "/projects/cuid-1",
    "/builder/cuid_1",
    "/dashboard",
    "/settings",
  ])
    assert.equal(workspaceReturnPath(path), path);
});
test("session validation is backend-authoritative and fails closed on outages or malformed responses", async () => {
  const token = "a".repeat(43);
  for (const status of [403, 429, 500, 503])
    assert.equal(
      (
        await lookupSession(
          token,
          "http://localhost:4200",
          async () => new Response("{}", { status }),
        )
      ).state,
      "unavailable",
    );
  assert.equal(
    (
      await lookupSession(
        token,
        "http://localhost:4200",
        async () => new Response("{}", { status: 401 }),
      )
    ).state,
    "anonymous",
  );
  assert.equal(
    (
      await lookupSession(
        token,
        "http://localhost:4200",
        async () => new Response("{}"),
      )
    ).state,
    "unavailable",
  );
  assert.equal(
    (
      await lookupSession(token, "http://localhost:4200", async () => {
        throw new Error("private-marker");
      })
    ).state,
    "unavailable",
  );
  let calls = 0;
  for (const value of [undefined, "", "forged", "bad\u0000cookie"])
    assert.equal(
      (
        await lookupSession(value, "http://localhost:4200", async () => {
          calls++;
          return new Response();
        })
      ).state,
      "anonymous",
    );
  assert.equal(calls, 0);
  const result = await lookupSession(
    token,
    "http://localhost:4200",
    async (url, options) => {
      assert.equal(String(url), "http://localhost:4200/api/v1/auth/me");
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.redirect, "error");
      return Response.json({
        user: {
          id: "test-owner",
          username: "test",
          role: "USER",
          emailVerifiedAt: null,
        },
      });
    },
  );
  assert.equal(result.state, "authenticated");
  assert.equal("token" in result, false);
});
