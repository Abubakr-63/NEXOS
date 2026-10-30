import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registrationSchema,
  loginSchema,
  defaultConfiguration,
  romConfigurationSchema,
  saveConfigurationSchema,
  authenticationResponseSchema,
  sessionsResponseSchema,
  apiErrorSchema,
  routerErrorSchema,
  rawROMProjectSchema,
  projectWriteResponseSchema,
  projectDetailResponseSchema,
  revisionsResponseSchema,
  devicesResponseSchema,
  androidBasesResponseSchema,
  compatibilityResponseSchema,
  validateConfiguration,
} from "../packages/contracts/src";

const at = "2026-10-29T00:00:00.000Z";
const project = {
  id: "opaque",
  ownerId: "user",
  configuration: defaultConfiguration,
  revision: 1,
  createdAt: at,
  updatedAt: at,
};

test("shared auth/session/error contracts preserve strict requests and secret-free wire shapes", () => {
  const input = {
    email: "PERSON@example.com",
    username: "PERSON",
    password: "test-only-passphrase",
  };
  assert.deepEqual(registrationSchema.parse(input), {
    ...input,
    email: "person@example.com",
    username: "person",
  });
  assert.equal(
    loginSchema.safeParse({ email: input.email, password: input.password })
      .success,
    true,
  );
  for (const value of [
    { ...input, role: "ADMIN" },
    { ...input, password: "short" },
    { ...input, email: "bad\u0000@example.com" },
  ])
    assert.equal(registrationSchema.safeParse(value).success, false);
  const auth = {
    user: {
      id: "user",
      username: "person",
      role: "USER",
      emailVerifiedAt: null,
    },
  };
  assert.deepEqual(authenticationResponseSchema.parse(auth), auth);
  for (const key of ["passwordHash", "email", "tokenHash"])
    assert.equal(
      authenticationResponseSchema.safeParse({
        user: { ...auth.user, [key]: "must-not-leak" },
      }).success,
      false,
    );
  assert.equal(
    authenticationResponseSchema.safeParse({
      user: { ...auth.user, emailVerifiedAt: undefined },
    }).success,
    false,
  );
  assert.equal(
    sessionsResponseSchema.safeParse({
      items: [{ id: "s", createdAt: at, expiresAt: at, tokenHash: "secret" }],
    }).success,
    false,
  );
  for (const message of ["Invalid project identifier", ["name: Required"]]) {
    const body = { error: { status: 400, message, requestId: "req-1" } };
    assert.deepEqual(apiErrorSchema.parse(body), body);
  }
  const native = {
    error: "Bad Request",
    code: "FST_ERR_BAD_URL",
    message: "invalid URL",
    statusCode: 400,
  };
  assert.deepEqual(routerErrorSchema.parse(native), native);
  assert.equal(apiErrorSchema.safeParse(native).success, false);
});

test("raw snapshots remain JSON while writes and detail contracts retain normalized configuration and nullable relations", () => {
  const { description: _description, ...legacy } = defaultConfiguration;
  const raw = { ...project, configuration: legacy };
  assert.deepEqual(rawROMProjectSchema.parse(raw), raw);
  const revisions = {
    items: [
      {
        id: "r",
        projectId: "opaque",
        number: 1,
        configuration: legacy,
        createdAt: at,
      },
    ],
  };
  assert.deepEqual(revisionsResponseSchema.parse(revisions), revisions);
  // Do not falsely normalize raw database JSON or hide unexpected out-of-band JSON.
  assert.deepEqual(
    rawROMProjectSchema.parse({
      ...project,
      configuration: { unknown: [null, true, 3] },
    }).configuration,
    { unknown: [null, true, 3] },
  );
  assert.deepEqual(projectWriteResponseSchema.parse(project), project);
  const detail = {
    ...project,
    deviceVariant: null,
    androidBase: null,
    compatibility: validateConfiguration(defaultConfiguration, false),
  };
  assert.deepEqual(projectDetailResponseSchema.parse(detail), detail);
  assert.equal(projectDetailResponseSchema.safeParse(project).success, false);
  assert.equal(projectWriteResponseSchema.safeParse(detail).success, false);
  assert.equal(
    saveConfigurationSchema.safeParse({
      configuration: defaultConfiguration,
      revision: 1,
    }).success,
    true,
  );
  for (const configuration of [
    { ...defaultConfiguration, ownerId: "victim" },
    { ...defaultConfiguration, apps: ["files", "files"] },
    { ...defaultConfiguration, kernel: "verified" },
  ])
    assert.equal(
      romConfigurationSchema.safeParse(configuration).success,
      false,
    );
  assert.equal(
    compatibilityResponseSchema.safeParse({
      ...detail.compatibility,
      status: "SUPPORTED",
    }).success,
    false,
  );
});

test("catalog contracts keep required nullable evidence fields and nested arrays without inventing support", () => {
  const device = {
    id: "device",
    manufacturerId: "maker",
    name: "Device",
    slug: "device",
    codename: "real",
    chipset: null,
    architecture: null,
    isDemo: false,
    deprecatedAt: null,
    manufacturer: { id: "maker", name: "Maker", slug: "maker" },
    variants: [
      {
        id: "variant",
        deviceId: "device",
        modelNumber: "model",
        region: "region",
        bootloaderNotes: null,
        androidVersions: ["13"],
        hardwareVariant: null,
        officialSourceUrl: null,
        evidenceUrls: [],
        sourceCodeUrl: null,
        catalogStatus: "CATALOGED",
        sourceStatus: "UNREVIEWED",
        buildSupportStatus: "NOT_VERIFIED",
        reviewedAt: null,
        notes: null,
      },
    ],
    supportStatus: "UNKNOWN",
    buildSupportStatus: "NOT_VERIFIED",
    catalogStatus: "CATALOGED",
  };
  const body = { items: [device], total: 1, page: 1, limit: 12 };
  assert.deepEqual(devicesResponseSchema.parse(body), body);
  assert.equal(
    devicesResponseSchema.safeParse({
      ...body,
      items: [{ ...device, supportStatus: "SUPPORTED" }],
    }).success,
    false,
  );
  assert.equal(
    devicesResponseSchema.safeParse({
      ...body,
      items: [
        { ...device, variants: [{ ...device.variants[0], notes: undefined }] },
      ],
    }).success,
    false,
  );
  const bases = {
    items: [
      {
        id: "base",
        name: "AOSP",
        androidVersion: "15",
        sourceRepository: "https://example.com/source",
        sourceRef: "ref",
        documentationUrl: "https://example.com/docs",
        evidenceUrls: [],
        availability: "SOURCE_AVAILABLE",
        buildSupportStatus: "NOT_VERIFIED",
        reviewedAt: at,
        supportStatus: "UNKNOWN",
        buildSupported: false,
      },
    ],
    explanation: "Source only",
  };
  assert.deepEqual(androidBasesResponseSchema.parse(bases), bases);
});
