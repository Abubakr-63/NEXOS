import { randomBytes, scryptSync } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  passwordNeedsRehash,
  sessionDigest,
} from "../apps/api/src/security";
import { upgradePasswordHash } from "../apps/api/src/password-upgrade";
import { seedCatalog } from "../packages/database/prisma/catalog-seed";
import { defaultConfiguration } from "../packages/contracts/src/index";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const requireApi = createRequire(resolve("apps/api/package.json"));
const { PrismaClient } = requireApi("@prisma/client");
test(
  "database-backed authentication, session ownership, CSRF, RBAC, and catalog contracts",
  { timeout: 30000 },
  async () => {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL must point to a migrated test database");
    const db = new PrismaClient();
    const child = spawn(process.execPath, ["dist/main.js"], {
      cwd: resolve("apps/api"),
      env: {
        ...process.env,
        PORT: "4101",
        WEB_ORIGIN: "http://localhost:3000",
      },
      stdio: "pipe",
    });
    let output = "";
    child.stderr.on("data", (d) => {
      output += d;
    });
    child.stdout.on("data", (d) => {
      output += d;
    });
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const emails = [
      `test_${suffix}@example.com`,
      `other_${suffix}@example.com`,
    ];
    const base = "http://localhost:4101/api/v1";
    async function call(
      path: string,
      method = "GET",
      body?: unknown,
      cookie?: string,
      origin = "http://localhost:3000",
    ) {
      return fetch(`${base}/${path}`, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    try {
      let ready = false;
      for (let attempt = 0; attempt < 70; attempt++) {
        try {
          const res = await call("health");
          if (res.ok) {
            ready = true;
            break;
          }
        } catch {}
        if (child.exitCode !== null) break;
        await delay(100);
      }
      assert.equal(ready, true, output);
      assert.equal((await call("ready")).status, 200);
      for (const [contentType, body, expectedStatus] of [
        ["application/json", '{"password":"sensitive-audit-marker",', 400],
        [
          "application/json",
          JSON.stringify({
            password: "sensitive-audit-marker" + "x".repeat(33000),
          }),
          413,
        ],
        ["application/x-audit", "sensitive-audit-marker", 415],
      ] as const) {
        const response = await fetch(`${base}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": contentType,
            Origin: "http://localhost:3000",
          },
          body,
        });
        assert.equal(response.status, expectedStatus);
        const text = await response.text();
        assert.equal(text.includes("sensitive-audit-marker"), false);
        assert.ok(JSON.parse(text).error.requestId);
      }
      const cors = await call(
        "manufacturers",
        "GET",
        undefined,
        undefined,
        "https://evil.example",
      );
      assert.equal(
        cors.headers.get("access-control-allow-origin"),
        "http://localhost:3000",
      );
      assert.equal(
        cors.headers.get("access-control-allow-credentials"),
        "true",
      );
      const missingOrigin = await fetch(`${base}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(missingOrigin.status, 403);
      assert.equal((await call("auth/me")).status, 401);
      assert.equal(
        (
          await call("auth/register", "POST", {
            email: emails[0],
            username: `user_${suffix}`,
            password: "integration-password-123",
            role: "ADMIN",
          })
        ).status,
        400,
      );
      const credentials = {
        email: emails[0],
        password: "integration-password-123",
      };
      const register = await call("auth/register", "POST", {
        ...credentials,
        username: `user_${suffix}`,
      });
      assert.equal(register.status, 201, await register.clone().text());
      const user = (await register.json()).user;
      assert.equal(user.role, "USER");
      assert.equal(user.passwordHash, undefined);
      assert.equal(user.email, undefined);
      const header = register.headers.get("set-cookie")!;
      assert.match(header, /HttpOnly/i);
      assert.match(header, /SameSite=Lax/i);
      const cookie = header.split(";")[0];
      assert.equal(
        (await call("auth/me", "GET", undefined, cookie)).status,
        200,
      );
      assert.equal(
        (await call("admin/audit", "GET", undefined, cookie)).status,
        403,
      );
      assert.equal(
        (await call("auth/logout", "POST", {}, cookie, "https://evil.example"))
          .status,
        403,
      );
      const registered = await db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      assert.ok(
        registered.passwordHash.startsWith("scrypt:v1:N=32768,r=8,p=3:"),
      );
      assert.equal(passwordNeedsRehash(registered.passwordHash), false);
      assert.equal(
        await verifyPassword(credentials.password, registered.passwordHash),
        true,
      );
      const legacySalt = randomBytes(16).toString("hex");
      const legacy = `scrypt:${legacySalt}:${scryptSync(credentials.password, legacySalt, 64).toString("hex")}`;
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: legacy },
      });
      const wrongLegacy = await call("auth/login", "POST", {
        ...credentials,
        password: "incorrect-legacy-password",
      });
      assert.equal(wrongLegacy.status, 401);
      assert.ok(
        (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
          .passwordHash === legacy,
      );
      const upgradedLogins = await Promise.all([
        call("auth/login", "POST", credentials),
        call("auth/login", "POST", credentials),
      ]);
      assert.deepEqual(
        upgradedLogins.map((response) => response.status),
        [201, 201],
      );
      const upgradedLogin = upgradedLogins[0];
      const upgradedCookie = upgradedLogin.headers
        .get("set-cookie")!
        .split(";")[0];
      const upgradedHash = (
        await db.user.findUniqueOrThrow({ where: { id: user.id } })
      ).passwordHash;
      assert.ok(upgradedHash !== legacy);
      assert.equal(passwordNeedsRehash(upgradedHash), false);
      assert.equal(
        await verifyPassword(credentials.password, upgradedHash),
        true,
      );
      assert.equal(
        (await call("auth/me", "GET", undefined, cookie)).status,
        200,
        "rehash preserves existing independent sessions",
      );
      assert.equal(
        (await call("auth/me", "GET", undefined, upgradedCookie)).status,
        200,
      );
      for (const loginResponse of upgradedLogins) {
        const loginCookie = loginResponse.headers
          .get("set-cookie")!
          .split(";")[0];
        await db.session.deleteMany({
          where: {
            userId: user.id,
            tokenHash: sessionDigest(
              loginCookie.slice(loginCookie.indexOf("=") + 1),
            ),
          },
        });
      }
      const stored = await db.session.findFirst({ where: { userId: user.id } });
      assert.equal(stored.tokenHash.length, 64);
      assert.notEqual(stored.tokenHash, cookie.split("=")[1]);
      const second = await call("auth/register", "POST", {
        email: emails[1],
        password: "integration-password-456",
        username: `other_${suffix}`,
      });
      const secondCookie = second.headers.get("set-cookie")!.split(";")[0];
      const maker = await db.manufacturer.create({
        data: {
          id: `maker_${suffix}`,
          slug: `maker_${suffix}`,
          name: `Test maker ${suffix}`,
          devices: {
            create: {
              id: `device_${suffix}`,
              slug: `device_${suffix}`,
              name: "Test device",
              codename: "test",
              isDemo: false,
              variants: {
                create: {
                  id: `variant_${suffix}`,
                  modelNumber: "TEST-1",
                  region: "Test region",
                  androidVersions: [],
                },
              },
            },
          },
        },
      });
      await db.androidBase.create({
        data: {
          id: `test-base-${suffix}`,
          name: "Test base metadata",
          androidVersion: "test-only",
          sourceRepository: "https://example.com/test-base",
          sourceRef: "test-only",
          documentationUrl: "https://example.com/test-base",
          reviewedAt: new Date(),
        },
      });
      const bases = await (await call("android-bases")).json();
      assert.ok(
        bases.items.some(
          (base: { id: string; buildSupported: boolean }) =>
            base.id === `test-base-${suffix}` && base.buildSupported === false,
        ),
      );
      const devices = await (
        await call(`devices?q=TEST-1&manufacturerId=${maker.id}`)
      ).json();
      assert.equal(devices.items.length, 1);
      assert.equal(devices.items[0].supportStatus, "UNKNOWN");
      const projectInput = {
        ...defaultConfiguration,
        description: "Persist this description",
        variantId: `variant_${suffix}`,
        base: `test-base-${suffix}`,
      };
      assert.equal((await call("projects", "POST", projectInput)).status, 401);
      assert.equal(
        (
          await call(
            "projects",
            "POST",
            { ...projectInput, variantId: "missing-variant" },
            cookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            "projects",
            "POST",
            { ...projectInput, base: "invented-base" },
            cookie,
          )
        ).status,
        400,
      );
      const created = await call("projects", "POST", projectInput, cookie);
      assert.equal(created.status, 201);
      const project = await created.json();
      assert.equal(
        (await call(`projects/${project.id}`, "GET", undefined, secondCookie))
          .status,
        404,
      );
      assert.equal(
        (
          await call(
            `projects/${project.id}`,
            "PATCH",
            { configuration: defaultConfiguration, revision: 1 },
            secondCookie,
          )
        ).status,
        404,
      );
      const changed = {
        ...projectInput,
        name: "Persistent ROM",
        description: "Updated description",
      };
      assert.equal(
        (
          await call(
            `projects/${project.id}`,
            "PATCH",
            { configuration: changed, revision: 1 },
            cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            `projects/${project.id}`,
            "PATCH",
            { configuration: changed, revision: 1 },
            cookie,
          )
        ).status,
        409,
      );
      const saved = await (
        await call(`projects/${project.id}`, "GET", undefined, cookie)
      ).json();
      assert.equal(saved.configuration.name, "Persistent ROM");
      assert.equal(saved.configuration.description, "Updated description");
      assert.equal(saved.configuration.base, projectInput.base);
      assert.equal(saved.deviceVariant.modelNumber, "TEST-1");
      assert.equal(saved.compatibility.status, "UNKNOWN");
      const ownList = await (
        await call("projects", "GET", undefined, cookie)
      ).json();
      assert.ok(
        ownList.items.some((item: { id: string }) => item.id === project.id),
      );
      const otherList = await (
        await call("projects", "GET", undefined, secondCookie)
      ).json();
      assert.equal(
        otherList.items.some((item: { id: string }) => item.id === project.id),
        false,
      );
      const revisions = await (
        await call(`projects/${project.id}/revisions`, "GET", undefined, cookie)
      ).json();
      assert.equal(revisions.items.length, 2);
      assert.equal(
        (
          await (
            await call(`projects/${project.id}/validate`, "POST", {}, cookie)
          ).json()
        ).status,
        "UNKNOWN",
      );
      assert.equal(
        (await call(`projects/${project.id}/builds`, "POST", {}, cookie))
          .status,
        503,
      );
      assert.equal(
        (await call(`projects/${project.id}/builds`, "POST", {}, secondCookie))
          .status,
        404,
      );
      await db.device.update({
        where: { id: `device_${suffix}` },
        data: { deprecatedAt: new Date() },
      });
      assert.equal(
        (await call("projects", "POST", projectInput, cookie)).status,
        400,
      );
      const legacyConfiguration = {
        ...projectInput,
        base: "legacy-preexisting-base",
        name: "Preserve legacy selection",
      };
      const legacyProject = await db.rOMProject.create({
        data: {
          ownerId: user.id,
          configuration: legacyConfiguration,
          revisions: {
            create: { number: 1, configuration: legacyConfiguration },
          },
        },
      });
      const legacyRead = await (
        await call(`projects/${legacyProject.id}`, "GET", undefined, cookie)
      ).json();
      assert.ok(legacyRead.deviceVariant.device.deprecatedAt);
      assert.equal(legacyRead.configuration.base, "legacy-preexisting-base");
      const legacySaved = await call(
        `projects/${legacyProject.id}`,
        "PATCH",
        {
          revision: 1,
          configuration: {
            ...legacyConfiguration,
            description: "Metadata remains editable",
          },
        },
        cookie,
      );
      assert.equal(legacySaved.status, 200);
      const legacyData = await legacySaved.json();
      assert.equal(legacyData.configuration.variantId, projectInput.variantId);
      assert.equal(legacyData.configuration.base, "legacy-preexisting-base");
      const concurrent = await Promise.all([
        call(
          `projects/${project.id}`,
          "PATCH",
          { configuration: { ...changed, name: "Concurrent A" }, revision: 2 },
          cookie,
        ),
        call(
          `projects/${project.id}`,
          "PATCH",
          { configuration: { ...changed, name: "Concurrent B" }, revision: 2 },
          cookie,
        ),
      ]);
      assert.deepEqual(
        concurrent.map((response) => response.status).sort(),
        [200, 409],
      );
      const persisted = await db.rOMProject.findUniqueOrThrow({
        where: { id: project.id },
      });
      assert.equal(persisted.revision, 3);
      const snapshots = await db.configurationRevision.findMany({
        where: { projectId: project.id },
        orderBy: { number: "asc" },
      });
      assert.deepEqual(
        snapshots.map((snapshot: { number: number }) => snapshot.number),
        [1, 2, 3],
      );
      assert.deepEqual(snapshots[2].configuration, persisted.configuration);
      await call(`auth/sessions/${stored.id}`, "DELETE", {}, secondCookie);
      assert.equal(
        (await call("auth/me", "GET", undefined, cookie)).status,
        200,
        "another account must not revoke this session",
      );
      assert.equal(
        (
          await call("auth/login", "POST", {
            ...credentials,
            password: "wrong-password-123",
          })
        ).status,
        401,
      );
      const login = await call("auth/login", "POST", credentials, cookie);
      assert.equal(login.status, 201);
      assert.ok(
        (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
          .passwordHash === upgradedHash,
        "current-policy login must not rewrite the password hash",
      );
      const newCookie = login.headers.get("set-cookie")!.split(";")[0];
      assert.notEqual(newCookie, cookie);
      assert.equal(
        (await call("auth/me", "GET", undefined, cookie)).status,
        401,
        "login rotates the presented token",
      );
      const list = await (
        await call("auth/sessions", "GET", undefined, newCookie)
      ).json();
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0].tokenHash, undefined);
      await call(`auth/sessions/${list.items[0].id}`, "DELETE", {}, newCookie);
      assert.equal(
        (await call("auth/me", "GET", undefined, newCookie)).status,
        401,
      );
      const secondUser = await db.user.findUniqueOrThrow({
        where: { email: emails[1] },
      });
      await db.session.updateMany({
        where: { userId: secondUser.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      assert.equal(
        (await call("auth/me", "GET", undefined, secondCookie)).status,
        401,
      );
      await call("auth/logout", "POST", {}, secondCookie);
      assert.equal(
        (await call("auth/me", "GET", undefined, secondCookie)).status,
        401,
      );
      assert.equal(
        (await call("legacy/catalog-projects?limit=999")).status,
        400,
      );
      const catalog = await (
        await call("legacy/catalog-projects?kind=ROM&limit=2")
      ).json();
      assert.ok(catalog.items.length <= 2);
      assert.ok(catalog.items.every((p: { kind: string }) => p.kind === "ROM"));
      assert.equal(
        (await call("legacy/catalog-projects/does-not-exist")).status,
        404,
      );
      const deviceCatalog = await (await call("devices?limit=50")).json();
      assert.ok(Array.isArray(deviceCatalog.items));
      assert.ok(
        deviceCatalog.items.every(
          (device: { isDemo: boolean; deprecatedAt: string | null }) =>
            !device.isDemo && !device.deprecatedAt,
        ),
      );
      assert.ok(
        deviceCatalog.items.some(
          (device: {
            codename: string;
            variants: { modelNumber: string; buildSupportStatus: string }[];
          }) =>
            device.codename === "mojito" &&
            device.variants.some(
              (variant) =>
                variant.modelNumber === "M2101K7AG" &&
                variant.buildSupportStatus === "NOT_VERIFIED",
            ),
        ),
      );
      const docs = await fetch("http://localhost:4101/api/docs-json");
      assert.equal(docs.status, 200);
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 61; attempt++)
        statuses.push((await call("health")).status);
      assert.ok(
        statuses.includes(429),
        "per-handler/IP throttling must reject excess requests",
      );
    } finally {
      child.kill("SIGTERM");
      await db.auditLog.deleteMany({
        where: { actor: { email: { in: emails } } },
      });
      await db.user.deleteMany({ where: { email: { in: emails } } });
      await db.androidBase.deleteMany({ where: { id: `test-base-${suffix}` } });
      await db.device.deleteMany({ where: { id: `device_${suffix}` } });
      await db.manufacturer.deleteMany({ where: { id: `maker_${suffix}` } });
      await db.$disconnect();
    }
  },
);

test(
  "catalog seeding is idempotent and preserves legacy project/device identities",
  { timeout: 30000 },
  async () => {
    const db = new PrismaClient();
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `catalog_preserve_${suffix}@example.com`;
    try {
      await db.manufacturer.upsert({
        where: { name: "Atlas Mobile" },
        update: {},
        create: {
          id: "demo-atlas-maker",
          name: "Atlas Mobile",
          slug: "demo-atlas",
        },
      });
      const maker = await db.manufacturer.findUniqueOrThrow({
        where: { name: "Atlas Mobile" },
      });
      await db.device.upsert({
        where: { id: "demo-atlas" },
        update: {},
        create: {
          id: "demo-atlas",
          slug: "atlas-one",
          name: "Atlas One",
          codename: "atlas",
          manufacturerId: maker.id,
          isDemo: true,
        },
      });
      await db.deviceVariant.upsert({
        where: { id: "demo-atlas-variant" },
        update: {},
        create: {
          id: "demo-atlas-variant",
          deviceId: "demo-atlas",
          modelNumber: "AT-100",
          region: "Global",
          androidVersions: [],
        },
      });
      const user = await db.user.create({
        data: { email, username: `keep_${suffix}` },
      });
      const configuration = {
        ...defaultConfiguration,
        name: "Do not reassign this draft",
        variantId: "demo-atlas-variant",
        base: "legacy-base-selection",
      };
      const project = await db.rOMProject.create({
        data: {
          ownerId: user.id,
          configuration,
          revisions: { create: { number: 1, configuration } },
        },
      });
      const before = await db.rOMProject.findUnique({
        where: { id: project.id },
        include: { revisions: true },
      });
      await seedCatalog(db);
      const deviceSnapshot = await db.device.findMany({
        orderBy: { id: "asc" },
        include: { variants: { orderBy: { id: "asc" } } },
      });
      const baseSnapshot = await db.androidBase.findMany({
        orderBy: { id: "asc" },
      });
      await seedCatalog(db);
      assert.deepEqual(
        await db.device.findMany({
          orderBy: { id: "asc" },
          include: { variants: { orderBy: { id: "asc" } } },
        }),
        deviceSnapshot,
      );
      assert.deepEqual(
        await db.androidBase.findMany({ orderBy: { id: "asc" } }),
        baseSnapshot,
      );
      assert.deepEqual(
        await db.rOMProject.findUnique({
          where: { id: project.id },
          include: { revisions: true },
        }),
        before,
      );
      assert.ok(await db.user.findUnique({ where: { id: user.id } }));
      const legacy = await db.device.findUniqueOrThrow({
        where: { id: "demo-atlas" },
        include: { variants: true },
      });
      assert.ok(legacy.deprecatedAt);
      assert.ok(
        legacy.variants.every(
          (variant: { catalogStatus: string; buildSupportStatus: string }) =>
            variant.catalogStatus === "UNVERIFIED" &&
            variant.buildSupportStatus === "NOT_VERIFIED",
        ),
      );
      assert.equal(
        await db.deviceVariant.count({ where: { catalogStatus: "CATALOGED" } }),
        11,
      );
      assert.equal(
        await db.androidBase.count({
          where: {
            id: { in: ["aosp-16-r4", "lineageos-23.2"] },
            availability: "SOURCE_AVAILABLE",
            buildSupportStatus: "NOT_VERIFIED",
          },
        }),
        2,
      );
    } finally {
      await db.user.deleteMany({ where: { email } });
      await db.$disconnect();
    }
  },
);

test("unexpected errors retain request correlation without exposing sensitive details", (context) => {
  const log = context.mock.method(console, "error", () => {});
  let status: number | undefined;
  let body: unknown;
  const reply = {
    status(value: number) {
      status = value;
      return this;
    },
    send(value: unknown) {
      body = value;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ id: "audit-request-123" }),
    }),
  };
  new (requireApi("./dist/app.js").Errors)().catch(
    new Error("sensitive-database-password-marker"),
    host,
  );
  assert.equal(status, 500);
  assert.deepEqual(body, {
    error: {
      status: 500,
      message: "An unexpected error occurred.",
      requestId: "audit-request-123",
    },
  });
  assert.deepEqual(JSON.parse(log.mock.calls[0].arguments[0]), {
    event: "request.error",
    requestId: "audit-request-123",
    error: "Error",
  });
  assert.equal(
    JSON.stringify(body).includes("sensitive-database-password-marker"),
    false,
  );
});

test(
  "password upgrades use atomic comparison and preserve a newer password",
  { timeout: 30000 },
  async () => {
    const db = new PrismaClient();
    const suffix = randomBytes(12).toString("hex");
    const email = `password_upgrade_${suffix}@example.com`;
    try {
      const password = randomBytes(24).toString("base64url");
      const salt = randomBytes(16).toString("hex");
      const legacy = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
      const user = await db.user.create({
        data: { email, username: `pw_${suffix}`, passwordHash: legacy },
      });
      const results = await Promise.all([
        upgradePasswordHash(db, user.id, password, legacy),
        upgradePasswordHash(db, user.id, password, legacy),
      ]);
      assert.deepEqual(results.sort(), ["superseded", "upgraded"]);
      let saved = (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash;
      assert.equal(await verifyPassword(password, saved), true);
      assert.equal(passwordNeedsRehash(saved), false);
      assert.equal(
        await upgradePasswordHash(db, user.id, password, saved),
        "current",
      );
      const newerPassword = randomBytes(24).toString("base64url");
      const newerHash = await hashPassword(newerPassword);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newerHash },
      });
      assert.equal(
        await upgradePasswordHash(db, user.id, password, legacy),
        "superseded",
      );
      saved = (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash;
      assert.ok(
        saved === newerHash,
        "stale upgrade must preserve the newer password hash",
      );
      assert.equal(await verifyPassword(newerPassword, saved), true);
      assert.equal(await verifyPassword(password, saved), false);
    } finally {
      await db.user.deleteMany({ where: { email } });
      await db.$disconnect();
    }
  },
);

test(
  "registration atomically commits user/session/audit and rolls back injected failures and duplicate races",
  { timeout: 30000 },
  async () => {
    const { NestFactory } = requireApi("@nestjs/core");
    const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
    const { AppModule, Database, Errors } = requireApi("./dist/app.js");
    const app = await NestFactory.create(
      AppModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    await app.register(requireApi("@fastify/cookie"));
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new Errors());
    const db = app.get(Database);
    const transaction = db.$transaction.bind(db);
    const suffix = randomBytes(8).toString("hex");
    const emails = ["old", "new", "duplicate", "race", "race-a", "race-b"].map(
      (name) => `b2_${name}_${suffix}@example.com`,
    );
    const input = {
      email: emails[1],
      username: `b2_${suffix}`,
      password: randomBytes(24).toString("base64url"),
    };
    let fault:
      "session-before" | "session-after" | "audit" | "before-commit" | null =
      null;
    let observedUserId: string | undefined;
    // Intercept only this application's transaction client, retaining real PostgreSQL
    // writes/rollback. No triggers, schema changes or production test switches.
    db.$transaction = (
      run: (tx: typeof db) => Promise<unknown>,
      options: unknown,
    ) =>
      transaction(async (tx: typeof db) => {
        const wrapped = new Proxy(tx, {
          get(target, key) {
            if (key !== "session" && key !== "auditLog")
              return Reflect.get(target, key);
            const delegate = Reflect.get(target, key);
            return new Proxy(delegate, {
              get(model, operation) {
                if (operation !== "create" || !fault)
                  return Reflect.get(model, operation);
                return async (args: unknown) => {
                  const pendingUser = await tx.user.findUnique({
                    where: { email: input.email },
                  });
                  assert.ok(
                    pendingUser,
                    "the user must exist inside the pending transaction",
                  );
                  observedUserId = pendingUser.id;
                  if (key === "session" && fault === "session-before")
                    throw new Error("private-registration-fault-marker");
                  if (key === "auditLog" && fault === "audit") {
                    assert.equal(
                      await tx.session.count({
                        where: { userId: pendingUser.id },
                      }),
                      1,
                    );
                    throw new Error("private-registration-fault-marker");
                  }
                  const result = await Reflect.get(model, operation).call(
                    model,
                    args,
                  );
                  if (key === "session" && fault === "session-after")
                    throw new Error("private-registration-fault-marker");
                  return result;
                };
              },
            });
          },
        });
        const result = await run(wrapped);
        if (fault === "before-commit") {
          assert.equal(
            await tx.session.count({ where: { userId: observedUserId } }),
            1,
          );
          assert.equal(
            await tx.auditLog.count({ where: { actorId: observedUserId } }),
            1,
          );
          throw new Error("private-registration-fault-marker");
        }
        return result;
      }, options);
    try {
      await app.init();
      const http = app.getHttpAdapter().getInstance();
      await http.ready();
      const oldHash = await hashPassword(randomBytes(24).toString("base64url"));
      const prior = await db.user.create({
        data: {
          email: emails[0],
          username: `old_${suffix}`,
          passwordHash: oldHash,
        },
      });
      const oldToken = randomBytes(32).toString("base64url");
      const oldSession = await db.session.create({
        data: {
          userId: prior.id,
          tokenHash: sessionDigest(oldToken),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const oldCookie = `romhub_session=${oldToken}`;
      async function request(path: string, payload?: unknown, cookie?: string) {
        return http.inject({
          method: payload === undefined ? "GET" : "POST",
          url: `/api/v1/${path}`,
          headers: {
            origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
            ...(payload === undefined
              ? {}
              : { "content-type": "application/json" }),
            ...(cookie ? { cookie } : {}),
          },
          ...(payload === undefined ? {} : { payload }),
        });
      }
      for (const stage of [
        "session-before",
        "session-after",
        "audit",
        "before-commit",
      ] as const) {
        fault = stage;
        observedUserId = undefined;
        const failed = await request("auth/register", input, oldCookie);
        assert.equal(failed.statusCode, 500);
        assert.equal(failed.headers["set-cookie"], undefined);
        assert.equal(
          failed.json().error.message,
          "An unexpected error occurred.",
        );
        assert.ok(failed.json().error.requestId);
        assert.equal(
          failed.body.includes("private-registration-fault-marker"),
          false,
        );
        assert.ok(observedUserId, "fault must occur after user insertion");
        assert.equal(await db.user.count({ where: { email: input.email } }), 0);
        assert.equal(
          await db.session.count({ where: { userId: observedUserId } }),
          0,
        );
        assert.equal(
          await db.auditLog.count({ where: { actorId: observedUserId } }),
          0,
        );
        assert.ok(
          await db.session.findUnique({ where: { id: oldSession.id } }),
          "failed registration must restore the presented session",
        );
        assert.equal(
          (await request("auth/me", undefined, oldCookie)).statusCode,
          200,
        );
        assert.ok(
          (await db.user.findUniqueOrThrow({ where: { id: prior.id } }))
            .passwordHash === oldHash,
        );
      }
      fault = null;
      const registered = await request("auth/register", input, oldCookie);
      assert.equal(registered.statusCode, 201);
      const user = registered.json().user;
      assert.equal(user.role, "USER");
      assert.equal(user.passwordHash, undefined);
      const cookie = registered.headers["set-cookie"].split(";")[0];
      assert.equal(
        (await request("auth/me", undefined, cookie)).statusCode,
        200,
      );
      assert.equal(await db.session.count({ where: { userId: user.id } }), 1);
      assert.equal(
        await db.auditLog.count({
          where: { actorId: user.id, action: "session.created" },
        }),
        1,
      );
      assert.equal(
        await db.session.count({ where: { id: oldSession.id } }),
        0,
        "successful registration retains presented-token rotation semantics",
      );
      const savedHash = (
        await db.user.findUniqueOrThrow({ where: { id: user.id } })
      ).passwordHash;
      assert.equal(passwordNeedsRehash(savedHash), false);
      assert.equal(await verifyPassword(input.password, savedHash), true);
      for (const duplicate of [
        input,
        { ...input, username: `alt_${suffix}` },
        { ...input, email: emails[2] },
      ]) {
        const response = await request("auth/register", duplicate, cookie);
        assert.equal(response.statusCode, 409);
        assert.equal(response.headers["set-cookie"], undefined);
        assert.equal(
          response.json().error.message,
          "That account or resource already exists.",
        );
      }
      assert.equal(await db.user.count({ where: { email: emails[2] } }), 0);
      assert.equal(await db.session.count({ where: { userId: user.id } }), 1);
      assert.ok(
        (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
          .passwordHash === savedHash,
      );
      assert.equal(
        (await request("auth/me", undefined, cookie)).statusCode,
        200,
      );
      for (const candidates of [
        [
          { ...input, email: emails[3], username: `r_${suffix}` },
          { ...input, email: emails[3], username: `r_${suffix}` },
        ],
        [
          { ...input, email: emails[4], username: `u_${suffix}` },
          { ...input, email: emails[5], username: `u_${suffix}` },
        ],
      ]) {
        const responses = await Promise.all(
          candidates.map((candidate) => request("auth/register", candidate)),
        );
        assert.deepEqual(
          responses.map((response) => response.statusCode).sort(),
          [201, 409],
        );
        assert.equal(
          responses.find((response) => response.statusCode === 409).headers[
            "set-cookie"
          ],
          undefined,
        );
        const winner = responses
          .find((response) => response.statusCode === 201)
          .json().user;
        assert.equal(
          await db.user.count({
            where: {
              email: { in: candidates.map((candidate) => candidate.email) },
            },
          }),
          1,
        );
        assert.equal(
          await db.session.count({ where: { userId: winner.id } }),
          1,
        );
        assert.equal(
          await db.auditLog.count({
            where: { actorId: winner.id, action: "session.created" },
          }),
          1,
        );
      }
    } finally {
      db.$transaction = transaction;
      try {
        await db.auditLog.deleteMany({
          where: { actor: { email: { in: emails } } },
        });
        await db.user.deleteMany({ where: { email: { in: emails } } });
      } finally {
        await app.close();
      }
    }
  },
);
