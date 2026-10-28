import { test } from "node:test";
import assert from "node:assert/strict";
import { scrypt as scryptCallback, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import {
  hashPassword,
  verifyPassword,
  passwordNeedsRehash,
} from "../apps/api/src/security";
import { upgradePasswordHash } from "../apps/api/src/password-upgrade";
const scrypt = promisify(scryptCallback);

async function legacyHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  // Independent reproduction of the original writer, including UTF-8 hex salt.
  const digest = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${digest.toString("hex")}`;
}

test("current password policy is explicit, salted and needs no rehash", async () => {
  const password = randomBytes(24).toString("base64url");
  const hash = await hashPassword(password);
  assert.ok(
    /^scrypt:v1:N=32768,r=8,p=3:[0-9a-f]{32}:[0-9a-f]{128}$/.test(hash),
  );
  assert.equal(passwordNeedsRehash(hash), false);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password + "wrong", hash), false);
  assert.ok(
    hash !== (await hashPassword(password)),
    "each hash must use a fresh salt",
  );
});

test("legacy verification retains the exact original scrypt policy and salt encoding", async () => {
  const password = randomBytes(24).toString("base64url");
  const hash = await legacyHash(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password + "wrong", hash), false);
  assert.equal(passwordNeedsRehash(hash), true);
});

test("malformed and unknown policies fail closed without accepting partial hex or arbitrary costs", async () => {
  const salt = "a".repeat(32),
    digest = "b".repeat(128);
  const validShape = `scrypt:v1:N=32768,r=8,p=3:${salt}:${digest}`;
  for (const hash of [
    "",
    "broken",
    `scrypt:${salt}:${digest}:extra`,
    `scrypt:${salt}:${digest}\n`,
    `scrypt:${salt}:${digest.slice(1)}`,
    `scrypt:${salt}:${digest.slice(0, -1)}z`,
    validShape + "\n",
    validShape + ":extra",
    validShape.replace("v1", "v99"),
    validShape.replace("32768", "1073741824"),
    validShape.replace("p=3", "p=1"),
    validShape.replace(salt, "a".repeat(34)),
  ]) {
    assert.equal(await verifyPassword("not-a-real-credential", hash), false);
    assert.equal(passwordNeedsRehash(hash), false);
  }
});

test("current hashes never trigger a database write or another derivation", async () => {
  const hash = await hashPassword("unit-test-only-password");
  const db = {
    user: {
      updateMany: async () => {
        throw new Error("must not write");
      },
    },
  } as unknown as Parameters<typeof upgradePasswordHash>[0];
  assert.equal(
    await upgradePasswordHash(db, "unit-user", "unused", hash),
    "current",
  );
});

test("a failed upgrade write is non-destructive and does not expose its error", async () => {
  const password = "unit-test-only-password";
  const original = await legacyHash(password);
  let writes = 0;
  const db = {
    user: {
      updateMany: async () => {
        writes++;
        throw new Error("sensitive-database-marker");
      },
    },
  } as unknown as Parameters<typeof upgradePasswordHash>[0];
  assert.equal(
    await upgradePasswordHash(db, "unit-user", password, original),
    "failed",
  );
  assert.equal(writes, 1);
  assert.equal(await verifyPassword(password, original), true);
});
