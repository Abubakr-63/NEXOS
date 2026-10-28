import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCompatibility } from "../packages/utils/src/index";
import {
  registrationSchema,
  catalogQuerySchema,
} from "../packages/contracts/src/index";
import {
  hashPassword,
  verifyPassword,
  sessionDigest,
} from "../apps/api/src/security";
test("compatibility refuses to infer support from a missing rule, variant mismatch, or missing evidence", () => {
  assert.equal(evaluateCompatibility("a").result, "UNKNOWN");
  const rule = {
    variantId: "b",
    result: "SUPPORTED" as const,
    explanation: "Maintainer tested",
    evidenceUrl: "https://example.com/evidence",
  };
  assert.equal(evaluateCompatibility("a", rule).result, "UNKNOWN");
  assert.equal(
    evaluateCompatibility("b", { ...rule, evidenceUrl: undefined }).result,
    "UNKNOWN",
  );
});
test("requirements stay conditional until every declared condition is satisfied", () => {
  const rule = {
    variantId: "a",
    result: "SUPPORTED" as const,
    explanation: "Maintainer tested",
    evidenceUrl: "https://example.com/evidence",
    requiredFirmware: "1.2",
    requiredRecovery: "3.0",
    requiredBootloaderUnlocked: true,
  };
  assert.equal(evaluateCompatibility("a", rule).result, "CONDITIONAL");
  assert.equal(
    evaluateCompatibility("a", rule, {
      firmware: "1.2",
      recovery: "3.0",
      bootloaderUnlocked: true,
    }).result,
    "SUPPORTED",
  );
  assert.equal(
    evaluateCompatibility("a", { ...rule, result: "UNSUPPORTED" }).result,
    "UNSUPPORTED",
  );
});
test("registration rejects role escalation, weak passwords, and invalid usernames", () => {
  const valid = {
    email: "TEST@example.com",
    username: "Valid_Name",
    password: "a-long-password-123",
  };
  assert.equal(registrationSchema.parse(valid).email, "test@example.com");
  assert.equal(registrationSchema.parse(valid).username, "valid_name");
  for (const input of [
    { ...valid, role: "ADMIN" },
    { ...valid, password: "short" },
    { ...valid, username: "../admin" },
  ])
    assert.equal(registrationSchema.safeParse(input).success, false);
});
test("pagination bounds prevent unbounded database requests", () => {
  assert.equal(catalogQuerySchema.parse({}).limit, 12);
  for (const input of [{ limit: 1000 }, { page: -1 }, { page: "abc" }])
    assert.equal(catalogQuerySchema.safeParse(input).success, false);
});
test("scrypt passwords are salted, verifiable, and never stored as plaintext", async () => {
  const password = "example-password-123";
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  assert.notEqual(one, two);
  assert.equal(one.includes(password), false);
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword("incorrect-password", one), false);
  assert.equal(await verifyPassword(password, "broken"), false);
  assert.equal(sessionDigest("a").length, 64);
  assert.notEqual(sessionDigest("a"), sessionDigest("b"));
});
