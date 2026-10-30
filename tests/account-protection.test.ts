import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { accountIdentity } from "../apps/api/src/account-protection";
import { accountProtectionSettings } from "../apps/api/src/config";
import { loginSchema } from "../packages/contracts/src";

test("account identifiers follow login normalization and are purpose-keyed HMACs", () => {
  const secret = randomBytes(32);
  const normalized = loginSchema.parse({
    email: "Example@Example.com",
    password: "test-only-password",
  }).email;
  const first = accountIdentity(normalized, secret);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, accountIdentity("EXAMPLE@example.COM", secret));
  assert.notEqual(first, accountIdentity(normalized, randomBytes(32)));
  assert.notEqual(first, accountIdentity("example+tag@example.com", secret));
  assert.notEqual(first, accountIdentity("other@example.com", secret));
  assert.throws(() =>
    loginSchema.parse({
      email: " Example@example.com ",
      password: "test-only-password",
    }),
  );
});

test("account HMAC configuration is required and rejects malformed secrets without disclosing values", () => {
  const original = process.env.AUTH_ACCOUNT_HMAC_KEY;
  try {
    for (const invalid of [
      undefined,
      "",
      "short-marker",
      "z".repeat(64),
      "ab".repeat(31),
      "ab".repeat(33),
    ]) {
      if (invalid === undefined) delete process.env.AUTH_ACCOUNT_HMAC_KEY;
      else process.env.AUTH_ACCOUNT_HMAC_KEY = invalid;
      assert.throws(accountProtectionSettings, (error: Error) => {
        assert.match(error.message, /AUTH_ACCOUNT_HMAC_KEY must/);
        if (invalid) assert.equal(error.message.includes(invalid), false);
        return true;
      });
    }
    const key = randomBytes(32);
    process.env.AUTH_ACCOUNT_HMAC_KEY = key.toString("hex");
    assert.deepEqual(accountProtectionSettings().secret, key);
  } finally {
    if (original === undefined) delete process.env.AUTH_ACCOUNT_HMAC_KEY;
    else process.env.AUTH_ACCOUNT_HMAC_KEY = original;
  }
});
