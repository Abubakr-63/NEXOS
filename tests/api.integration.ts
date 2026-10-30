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
process.env.AUTH_ACCOUNT_HMAC_KEY = randomBytes(32).toString("hex");
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.RATE_LIMIT_NAMESPACE = `nexos:test:integration:${randomBytes(8).toString("hex")}`;
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
      // B6.6: public HTTP validation text/shape must survive the major upgrade.
      const validationCases: Array<[string, string, unknown, string[]]> = [
        [
          "auth/login",
          "POST",
          { email: "bad", password: "short" },
          [
            "email: Invalid email",
            "password: String must contain at least 12 character(s)",
          ],
        ],
        [
          "auth/register",
          "POST",
          {},
          ["email: Required", "username: Required", "password: Required"],
        ],
        [
          "devices?page=abc",
          "GET",
          undefined,
          ["page: Expected number, received nan"],
        ],
        [
          "projects",
          "POST",
          { ...projectInput, name: "" },
          ["name: String must contain at least 1 character(s)"],
        ],
        [
          "projects",
          "POST",
          { ...projectInput, ownerId: "other" },
          [": Unrecognized key(s) in object: 'ownerId'"],
        ],
        [
          "projects",
          "POST",
          { ...projectInput, apps: Array(1000).fill("invalid") },
          ["apps: Array must contain at most 4 element(s)"],
        ],
        [
          `projects/${project.id}`,
          "PATCH",
          {
            configuration: { ...projectInput, apps: ["browser", "browser"] },
            revision: 1,
          },
          ["configuration.apps: Duplicate applications"],
        ],
        [
          `projects/${project.id}`,
          "PATCH",
          { configuration: projectInput, revision: 0 },
          ["revision: Number must be greater than or equal to 1"],
        ],
      ];
      for (const [path, method, body, expected] of validationCases) {
        const response = await call(path, method, body, cookie);
        assert.equal(
          response.status,
          400,
          "validation must remain a client error",
        );
        const payload = await response.json();
        assert.deepEqual(Object.keys(payload.error).sort(), [
          "message",
          "requestId",
          "status",
        ]);
        assert.deepEqual(payload.error.message, expected);
        assert.equal(payload.error.status, 400);
        assert.equal(typeof payload.error.requestId, "string");
      }

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
      for (const [path, method] of [
        [`projects/${project.id}/revisions`, "GET"],
        [`projects/${project.id}/validate`, "POST"],
      ]) {
        const foreign = await call(
          path,
          method,
          method === "POST" ? {} : undefined,
          secondCookie,
        );
        assert.equal(foreign.status, 404);
        assert.equal((await foreign.json()).error.message, "Project not found");
      }
      for (const id of [
        "missing-project",
        encodeURIComponent("' OR 1=1 --"),
        "%00",
        "%2e%2e",
      ]) {
        const response = await call(`projects/${id}`, "GET", undefined, cookie);
        const body = await response.text();
        assert.equal(response.status, id === "%00" ? 400 : 404);
        assert.equal(body.includes("passwordHash"), false);
      }
      for (const id of ["%00", "%01", "%1f", "%7f", "bad%0Aid"]) {
        for (const [suffix, method] of [
          ["", "GET"],
          ["", "PATCH"],
          ["/revisions", "GET"],
          ["/validate", "POST"],
          ["/builds", "POST"],
        ]) {
          const body =
            method === "PATCH"
              ? { configuration: defaultConfiguration, revision: 1 }
              : method === "POST"
                ? {}
                : undefined;
          const invalid = await call(
            `projects/${id}${suffix}`,
            method,
            body,
            cookie,
          );
          assert.equal(invalid.status, 400);
          assert.equal(
            (await invalid.json()).error.message,
            "Invalid project identifier",
          );
          assert.equal(
            (await call(`projects/${id}${suffix}`, method, body)).status,
            401,
            "authentication must still precede identifier validation",
          );
        }
      }
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
      // Start a fresh test-owned account budget for this independent login-error
      // scenario; account-policy enforcement is tested separately below.
      const { accountIdentity } = requireApi("./dist/account-protection.js");
      const Redis = requireApi("ioredis");
      const resetBudget = new Redis(process.env.REDIS_URL);
      try {
        const prefix = `${process.env.RATE_LIMIT_NAMESPACE}:account:v1`;
        const key = `${prefix}:${accountIdentity(credentials.email, Buffer.from(process.env.AUTH_ACCOUNT_HMAC_KEY!, "hex"))}`;
        await resetBudget.del(key);
        await resetBudget.zrem(`${prefix}:active`, key);
      } finally {
        resetBudget.disconnect();
      }
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
      const unknown = await call("auth/login", "POST", {
        ...credentials,
        email: `unknown_${suffix}@example.com`,
      });
      const incorrect = await call("auth/login", "POST", {
        ...credentials,
        password: "incorrect-b5-test-only",
      });
      assert.equal(unknown.status, 401);
      assert.equal(incorrect.status, 401);
      assert.equal(
        (await unknown.json()).error.message,
        (await incorrect.json()).error.message,
      );
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: "scrypt:v999:invalid" },
      });
      const malformed = await call("auth/login", "POST", credentials);
      assert.equal(malformed.status, 401);
      assert.equal(
        (await malformed.json()).error.message,
        "Invalid email or password",
      );
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: upgradedHash },
      });
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
      const bearerMarker = randomBytes(24).toString("base64url");
      await fetch(`${base}/auth/me`, {
        headers: { Cookie: cookie, Authorization: `Bearer ${bearerMarker}` },
      });
      const queryMarkers = Array.from(
        { length: 7 },
        () => `query-only-${randomBytes(16).toString("hex")}`,
      );
      await call(
        `auth/me?password=${queryMarkers[0]}&token=${queryMarkers[1]}&token=${queryMarkers[2]}&%70assword=${queryMarkers[3]}`,
        "GET",
        undefined,
        cookie,
      );
      await call(`does-not-exist?session=${queryMarkers[4]}`);
      await call(`projects/%E0%A4%A?token=${queryMarkers[5]}`);
      await fetch(`${base}/auth/login?password=${queryMarkers[6]}`, {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: '{"password":',
      });
      await delay(30); // Drain child stdout after representative auth/parser requests.
      for (const secret of [
        credentials.password,
        credentials.email,
        process.env.AUTH_ACCOUNT_HMAC_KEY!,
        accountIdentity(
          credentials.email,
          Buffer.from(process.env.AUTH_ACCOUNT_HMAC_KEY!, "hex"),
        ),
        "sensitive-audit-marker",
        bearerMarker,
        ...queryMarkers,
        registered.passwordHash,
        upgradedHash,
        cookie.slice(cookie.indexOf("=") + 1),
        secondCookie.slice(secondCookie.indexOf("=") + 1),
        newCookie.slice(newCookie.indexOf("=") + 1),
      ]) {
        assert.equal(
          output.includes(secret),
          false,
          "supported authentication credentials must not appear in captured API logs",
        );
      }
      const docs = await fetch("http://localhost:4101/api/docs-json");
      assert.equal(docs.status, 200);
      const logs = output.split("\n").flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
      const access = logs.filter((entry) => entry.req);
      assert.ok(access.length > 0);
      assert.ok(access.every((entry) => !entry.req.url.includes("?")));
      assert.ok(
        access.some(
          (entry) =>
            entry.req.url === "/api/v1/auth/me" &&
            entry.req.method === "GET" &&
            entry.reqId &&
            entry.req.remoteAddress,
        ),
      );
      assert.ok(
        logs.some(
          (entry) =>
            entry.res?.statusCode &&
            entry.reqId &&
            typeof entry.responseTime === "number",
        ),
      );
      const swaggerRequire = createRequire(
        requireApi.resolve("@nestjs/swagger/package.json"),
      );
      assert.equal(swaggerRequire("js-yaml/package.json").version, "5.4.1");
      const yamlResponse = await fetch("http://localhost:4101/api/docs-yaml");
      assert.equal(yamlResponse.status, 200);
      assert.deepEqual(
        swaggerRequire("js-yaml").load(await yamlResponse.text()),
        await docs.json(),
      );

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

test(
  "HTTPS production authentication only trusts configured proxy peers and clears matching cookies",
  { timeout: 30000 },
  async () => {
    const { validateEnvironment } = requireApi("./dist/config.js");
    const { NestFactory } = requireApi("@nestjs/core");
    const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
    const { AppModule, Database, Errors } = requireApi("./dist/app.js");
    const keys = ["NODE_ENV", "WEB_ORIGIN", "TRUSTED_PROXY_IPS"];
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "https://nexos.example";
    process.env.TRUSTED_PROXY_IPS = "192.0.2.10";
    // Use the already configured real local Redis URL when enabling production mode.

    let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
    let db: InstanceType<typeof PrismaClient> | undefined;
    const suffix = randomBytes(8).toString("hex");
    const email = `b3_${suffix}@example.com`;
    const input = {
      email,
      username: `b3_${suffix}`,
      password: randomBytes(24).toString("base64url"),
    };
    try {
      const config = validateEnvironment();
      app = await NestFactory.create(
        AppModule,
        new FastifyAdapter({ logger: false, trustProxy: config.trustProxy }),
        { logger: false },
      );
      await app.register(requireApi("@fastify/cookie"));
      app.setGlobalPrefix("api/v1");
      app.useGlobalFilters(new Errors());
      app.enableCors({ origin: config.origin, credentials: true });
      db = app.get(Database);
      await app.init();
      const http = app.getHttpAdapter().getInstance();
      await http.ready();
      async function request(
        path: string,
        method = "GET",
        payload?: unknown,
        cookie?: string,
        remoteAddress = "192.0.2.10",
        proto = "https",
        origin = config.origin,
      ) {
        return http.inject({
          method,
          url: `/api/v1/${path}`,
          remoteAddress,
          headers: {
            origin,
            "content-type": "application/json",
            "x-forwarded-proto": proto,
            "x-forwarded-for": "198.51.100.7",
            "x-forwarded-host": "nexos.example",
            ...(cookie ? { cookie } : {}),
          },
          ...(payload === undefined ? {} : { payload }),
        });
      }
      for (const [peer, proto] of [
        ["192.0.2.11", "https"],
        ["192.0.2.10", "http"],
        ["192.0.2.10", ""],
      ]) {
        const rejected = await request(
          "auth/register",
          "POST",
          input,
          undefined,
          peer,
          proto,
        );
        assert.equal(rejected.statusCode, 403);
        assert.equal(rejected.headers["set-cookie"], undefined);
        assert.equal(await db.user.count({ where: { email } }), 0);
      }
      const registered = await request("auth/register", "POST", input);
      assert.equal(registered.statusCode, 201);
      const header = registered.headers["set-cookie"] as string;
      for (const attribute of [
        "Secure",
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=604800",
      ])
        assert.ok(header.includes(attribute));
      assert.equal(header.includes("Domain="), false);
      const cookie = header.split(";")[0];
      const user = registered.json().user;
      assert.equal(
        (await request("auth/me", "GET", undefined, cookie)).statusCode,
        200,
      );
      assert.equal(
        (await request("auth/me", "GET", undefined, cookie, "192.0.2.11"))
          .statusCode,
        403,
      );
      assert.equal(
        (
          await request(
            "auth/me",
            "GET",
            undefined,
            cookie,
            "192.0.2.10",
            "http",
          )
        ).statusCode,
        403,
      );
      const csrf = await request(
        "auth/logout",
        "POST",
        {},
        cookie,
        "192.0.2.10",
        "https",
        "https://evil.example",
      );
      assert.equal(csrf.statusCode, 403);
      assert.equal(csrf.headers["access-control-allow-origin"], config.origin);
      assert.equal(
        (await request("auth/me", "GET", undefined, cookie)).statusCode,
        200,
      );
      const login = await request(
        "auth/login",
        "POST",
        { email, password: input.password },
        cookie,
      );
      assert.equal(login.statusCode, 201);
      assert.ok(login.headers["set-cookie"].includes("Secure"));
      const loginCookie = login.headers["set-cookie"].split(";")[0];
      assert.equal(
        (await request("auth/me", "GET", undefined, cookie)).statusCode,
        401,
      );
      const sessions = (
        await request("auth/sessions", "GET", undefined, loginCookie)
      ).json().items;
      assert.equal(sessions.length, 1);
      assert.equal(
        (
          await request(
            `auth/sessions/${sessions[0].id}`,
            "DELETE",
            {},
            loginCookie,
          )
        ).statusCode,
        200,
      );
      assert.equal(
        (await request("auth/me", "GET", undefined, loginCookie)).statusCode,
        401,
      );
      const logout = await request("auth/logout", "POST", {}, loginCookie);
      assert.equal(logout.statusCode, 201);
      const clear = logout.headers["set-cookie"] as string;
      for (const attribute of [
        "Secure",
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970",
      ])
        assert.ok(clear.includes(attribute));
      assert.equal(clear.includes("Domain="), false);
      assert.equal(await db.session.count({ where: { userId: user.id } }), 0);
    } finally {
      try {
        if (db) {
          await db.auditLog.deleteMany({ where: { actor: { email } } });
          await db.user.deleteMany({ where: { email } });
        }
      } finally {
        if (app) await app.close();
        for (const key of keys) {
          if (previous[key] === undefined) delete process.env[key];
          else process.env[key] = previous[key];
        }
      }
    }
  },
);

test(
  "real Redis limiter shares atomic rolling limits, normalizes identities and expires bounded keys",
  { timeout: 30000 },
  async () => {
    const { RedisAuthLimiter } = requireApi("./dist/rate-limit.js");
    const Redis = requireApi("ioredis");
    const previous = process.env.RATE_LIMIT_NAMESPACE;
    const namespace = `nexos:test:limiter:${randomBytes(8).toString("hex")}`;
    process.env.RATE_LIMIT_NAMESPACE = namespace;
    const first = new RedisAuthLimiter(),
      second = new RedisAuthLimiter();
    const inspect = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 0,
    });
    inspect.on("error", () => {});
    try {
      await Promise.all([first.onModuleInit(), second.onModuleInit()]);
      const results = await Promise.all(
        Array.from({ length: 120 }, (_, index) =>
          (index % 2 ? first : second).consume("login", "198.51.100.10"),
        ),
      );
      assert.equal(results.filter((result) => result.allowed).length, 60);
      assert.equal(results.filter((result) => !result.allowed).length, 60);
      assert.ok(
        results
          .filter((result) => !result.allowed)
          .every((result) => result.retryAfter > 0 && result.retryAfter <= 60),
      );
      const keys = await inspect.keys(`${namespace}:login:*`);
      assert.equal(keys.length, 1);
      assert.match(keys[0], new RegExp(`^${namespace}:login:[0-9a-f]{64}$`));
      assert.equal(await inspect.zcard(keys[0]), 61);
      assert.ok(
        (await inspect.pttl(keys[0])) > 0 &&
          (await inspect.pttl(keys[0])) <= 60000,
      );
      const short = { limit: 1, windowMs: 150, blockMs: 150 };
      assert.equal(
        (await first.consume("register", "192.0.2.8", short)).allowed,
        true,
      );
      assert.equal(
        (await second.consume("register", "::ffff:192.0.2.8", short)).allowed,
        false,
      );
      const shortKeys = await inspect.keys(`${namespace}:register:*`);
      assert.equal(shortKeys.length, 1);
      await delay(200);
      assert.equal(
        await inspect.exists(shortKeys[0]),
        0,
        "expired limiter keys must disappear without cleanup",
      );
      assert.equal(
        (await second.consume("register", "192.0.2.8", short)).allowed,
        true,
      );
      const subnet = { limit: 1, windowMs: 1000, blockMs: 1000 };
      assert.equal(
        (await first.consume("register", "2001:db8:1:2::1", subnet)).allowed,
        true,
      );
      assert.equal(
        (
          await second.consume(
            "register",
            "2001:0db8:0001:0002:0000:0000:0000:0002",
            subnet,
          )
        ).allowed,
        false,
      );
      assert.equal(
        (await second.consume("register", "2001:db8:1:3::1", subnet)).allowed,
        true,
      );
      const rolling = { limit: 2, windowMs: 350, blockMs: 150 };
      assert.equal(
        (await first.consume("login", "198.51.100.11", rolling)).allowed,
        true,
      );
      await delay(250);
      assert.equal(
        (await second.consume("login", "198.51.100.11", rolling)).allowed,
        true,
      );
      await delay(150);
      assert.equal(
        (await first.consume("login", "198.51.100.11", rolling)).allowed,
        true,
      );
      assert.equal(
        (await second.consume("login", "198.51.100.11", rolling)).allowed,
        false,
      );
      await delay(400);
    } finally {
      first.onModuleDestroy();
      second.onModuleDestroy();
      inspect.disconnect();
      if (previous === undefined) delete process.env.RATE_LIMIT_NAMESPACE;
      else process.env.RATE_LIMIT_NAMESPACE = previous;
    }
  },
);

test(
  "two API processes share 429 limits and fail closed through a Redis network outage then recover",
  { timeout: 30000 },
  async () => {
    const { createServer, connect } = await import("node:net");
    const source = new URL(process.env.REDIS_URL!);
    assert.equal(
      source.protocol,
      "redis:",
      "network-fault test requires a local non-TLS Redis test endpoint",
    );
    const sockets = new Set<import("node:net").Socket>();
    const upstreamHost = source.hostname;
    const upstreamPort = Number(source.port || 6379);
    const proxy = createServer((downstream) => {
      const upstream = connect({ host: upstreamHost, port: upstreamPort });
      for (const socket of [downstream, upstream]) {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
        socket.on("error", () => {
          downstream.destroy();
          upstream.destroy();
        });
      }
      downstream.pipe(upstream).pipe(downstream);
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    const port = (proxy.address() as import("node:net").AddressInfo).port;
    source.hostname = "127.0.0.1";
    source.port = String(port);
    const namespace = `nexos:test:process:${randomBytes(8).toString("hex")}`;
    const children = [4102, 4103].map((apiPort) =>
      spawn(process.execPath, ["dist/main.js"], {
        cwd: resolve("apps/api"),
        env: {
          ...process.env,
          NODE_ENV: "test",
          WEB_ORIGIN: "http://localhost:3000",
          PORT: String(apiPort),
          REDIS_URL: source.href,
          RATE_LIMIT_NAMESPACE: namespace,
        },
        stdio: "ignore",
      }),
    );
    async function call(apiPort: number, path: string, method = "GET") {
      return fetch(`http://127.0.0.1:${apiPort}/api/v1/${path}`, {
        method,
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
          "x-forwarded-proto": "https",
        },
        ...(method === "POST" ? { body: "{}" } : {}),
      });
    }
    async function waitReady(apiPort: number) {
      for (let attempt = 0; attempt < 45; attempt++) {
        try {
          if ((await call(apiPort, "ready")).status === 200) return;
        } catch {}
        await delay(100);
      }
      assert.fail("API did not become ready");
    }
    try {
      await Promise.all([waitReady(4102), waitReady(4103)]);
      for (const action of ["login", "register"]) {
        const responses = await Promise.all(
          Array.from({ length: 80 }, (_, i) =>
            call(i % 2 ? 4102 : 4103, `auth/${action}`, "POST"),
          ),
        );
        assert.equal(
          responses.filter((response) => response.status === 400).length,
          60,
        );
        assert.equal(
          responses.filter((response) => response.status === 429).length,
          20,
        );
        const denied = responses.find((response) => response.status === 429)!;
        assert.ok(
          Number(denied.headers.get("retry-after")) > 0 &&
            Number(denied.headers.get("retry-after")) <= 60,
        );
        assert.equal((await denied.json()).error.status, 429);
      }
      await new Promise<void>((resolve) => {
        proxy.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      });
      for (const apiPort of [4102, 4103]) {
        const unavailable = await call(apiPort, "auth/login", "POST");
        assert.equal(unavailable.status, 503);
        assert.equal(unavailable.headers.get("retry-after"), "1");
        assert.equal(
          (await unavailable.json()).error.message,
          "Authentication temporarily unavailable. Try again later.",
        );
        assert.equal(
          (await call(apiPort, "auth/register", "POST")).status,
          503,
        );
        assert.equal((await call(apiPort, "ready")).status, 503);
        assert.equal((await call(apiPort, "health")).status, 200);
        assert.equal((await call(apiPort, "manufacturers")).status, 200);
        assert.equal((await call(apiPort, "auth/logout", "POST")).status, 201);
      }
      await new Promise<void>((resolve) =>
        proxy.listen(port, "127.0.0.1", resolve),
      );
      await Promise.all([waitReady(4102), waitReady(4103)]);
      assert.equal(
        (await call(4102, "auth/login", "POST")).status,
        429,
        "recovery must retain counters stored in Redis",
      );
      assert.equal((await call(4103, "auth/register", "POST")).status, 429);
      // A new process also refuses startup while its required Redis path is down.
      await new Promise<void>((resolve) => {
        proxy.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      });
      const newcomer = spawn(process.execPath, ["dist/main.js"], {
        cwd: resolve("apps/api"),
        env: {
          ...process.env,
          NODE_ENV: "test",
          WEB_ORIGIN: "http://localhost:3000",
          PORT: "4104",
          REDIS_URL: source.href,
          RATE_LIMIT_NAMESPACE: namespace,
        },
        stdio: "pipe",
      });
      let startupOutput = "";
      newcomer.stdout.on("data", (data) => {
        startupOutput += data;
      });
      newcomer.stderr.on("data", (data) => {
        startupOutput += data;
      });
      const code = await new Promise<number | null>((resolve) => {
        const timer = setTimeout(() => {
          newcomer.kill("SIGTERM");
          resolve(null);
        }, 5000);
        newcomer.once("exit", (status) => {
          clearTimeout(timer);
          resolve(status);
        });
      });
      assert.equal(
        code,
        1,
        "an API process must exit unsuccessfully when required Redis cannot be reached",
      );
      assert.ok(
        startupOutput.includes("Authentication Redis startup check failed"),
      );
      assert.equal(startupOutput.includes(source.href), false);
    } finally {
      for (const child of children) child.kill("SIGTERM");
      for (const socket of sockets) socket.destroy();
      if (proxy.listening)
        await new Promise<void>((resolve) => proxy.close(() => resolve()));
    }
  },
);

test(
  "B5 production proxy-derived IPv6 limits cannot be rotated within a /64 and readiness errors stay sanitized",
  { timeout: 30000 },
  async () => {
    const { NestFactory } = requireApi("@nestjs/core");
    const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
    const { AppModule, Database, Errors } = requireApi("./dist/app.js");
    const { validateEnvironment } = requireApi("./dist/config.js");
    const keys = [
      "NODE_ENV",
      "WEB_ORIGIN",
      "TRUSTED_PROXY_IPS",
      "RATE_LIMIT_NAMESPACE",
    ];
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "https://nexos.example";
    process.env.TRUSTED_PROXY_IPS = "192.0.2.10";
    process.env.RATE_LIMIT_NAMESPACE = `nexos:test:b5proxy:${randomBytes(8).toString("hex")}`;
    let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
    try {
      const config = validateEnvironment();
      app = await NestFactory.create(
        AppModule,
        new FastifyAdapter({ logger: false, trustProxy: config.trustProxy }),
        { logger: false },
      );
      await app.register(requireApi("@fastify/cookie"));
      app.setGlobalPrefix("api/v1");
      app.useGlobalFilters(new Errors());
      await app.init();
      const http = app.getHttpAdapter().getInstance();
      await http.ready();
      async function attempt(ip: string) {
        return http.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          remoteAddress: "192.0.2.10",
          headers: {
            origin: config.origin,
            "content-type": "application/json",
            "x-forwarded-proto": "https",
            "x-forwarded-for": ip,
          },
          payload: {},
        });
      }
      const responses = await Promise.all(
        Array.from({ length: 61 }, (_, index) =>
          attempt(`2001:db8:5:1::${(index + 1).toString(16)}`),
        ),
      );
      assert.equal(
        responses.filter((response) => response.statusCode === 400).length,
        60,
      );
      assert.equal(
        responses.filter((response) => response.statusCode === 429).length,
        1,
      );
      assert.equal(
        (await attempt("2001:0db8:0005:0001::ffff")).statusCode,
        429,
      );
      assert.equal(
        (await attempt("2001:db8:5:2::1")).statusCode,
        400,
        "a different client network has an independent bucket",
      );
      const db = app.get(Database),
        query = db.$queryRaw.bind(db);
      try {
        db.$queryRaw = async () => {
          throw new Error("private-postgresql-credential-marker");
        };
        const unavailable = await http.inject({ url: "/api/v1/ready" });
        assert.equal(unavailable.statusCode, 503);
        assert.equal(
          unavailable.body.includes("private-postgresql-credential-marker"),
          false,
        );
        assert.equal(
          unavailable.json().error.message,
          "Required service unavailable",
        );
        assert.equal(
          (await http.inject({ url: "/api/v1/health" })).statusCode,
          200,
        );
      } finally {
        db.$queryRaw = query;
      }
      assert.equal(
        (await http.inject({ url: "/api/v1/ready" })).statusCode,
        200,
      );
    } finally {
      if (app) await app.close();
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  },
);

test(
  "B5 Redis namespaces isolate counters and denied requests do not extend block TTL",
  { timeout: 30000 },
  async () => {
    const { RedisAuthLimiter } = requireApi("./dist/rate-limit.js");
    const Redis = requireApi("ioredis");
    const previous = process.env.RATE_LIMIT_NAMESPACE;
    const namespace = `nexos:test:b5ttl:${randomBytes(8).toString("hex")}`;
    process.env.RATE_LIMIT_NAMESPACE = namespace;
    const first = new RedisAuthLimiter();
    process.env.RATE_LIMIT_NAMESPACE = `${namespace}:other`;
    const other = new RedisAuthLimiter();
    const inspect = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 0,
    });
    inspect.on("error", () => {});
    try {
      await Promise.all([first.onModuleInit(), other.onModuleInit()]);
      const policy = { limit: 1, windowMs: 2000, blockMs: 2000 };
      assert.equal(
        (await first.consume("login", "198.51.100.59", policy)).allowed,
        true,
      );
      const blocked = await first.consume("login", "198.51.100.59", policy);
      assert.equal(blocked.allowed, false);
      assert.equal(blocked.retryAfter, 2);
      assert.equal(
        (await other.consume("login", "198.51.100.59", policy)).allowed,
        true,
      );
      const [key] = await inspect.keys(`${namespace}:login:*`);
      const ttl = await inspect.pttl(key);
      await delay(100);
      assert.equal(
        (await first.consume("login", "198.51.100.59", policy)).allowed,
        false,
      );
      assert.ok(
        (await inspect.pttl(key)) < ttl,
        "a denied retry must not restart the block timer",
      );
      assert.equal(
        await inspect.zcard(key),
        2,
        "one accepted hit plus one marker, regardless of denials",
      );
      await delay(2050);
      assert.equal(await inspect.exists(key), 0);
      assert.equal(
        (await first.consume("login", "198.51.100.59", policy)).allowed,
        true,
      );
    } finally {
      first.onModuleDestroy();
      other.onModuleDestroy();
      inspect.disconnect();
      if (previous === undefined) delete process.env.RATE_LIMIT_NAMESPACE;
      else process.env.RATE_LIMIT_NAMESPACE = previous;
    }
  },
);

test(
  "account admission is atomic across Redis clients, bounded, expiring, and cannot extend recovery",
  { timeout: 15000 },
  async () => {
    const { RedisAuthLimiter } = requireApi("./dist/rate-limit.js");
    const { accountIdentity } = requireApi("./dist/account-protection.js");
    const Redis = requireApi("ioredis");
    const previous = process.env.RATE_LIMIT_NAMESPACE;
    const namespace = `nexos:test:account:${randomBytes(8).toString("hex")}`;
    process.env.RATE_LIMIT_NAMESPACE = namespace;
    const first = new RedisAuthLimiter(),
      second = new RedisAuthLimiter();
    const inspect = new Redis(process.env.REDIS_URL);
    const email = `account_${randomBytes(8).toString("hex")}@example.com`;
    const key = `${namespace}:account:v1:${accountIdentity(email, Buffer.from(process.env.AUTH_ACCOUNT_HMAC_KEY!, "hex"))}`;
    const policy = {
      burst: 5,
      refillMs: 60000,
      ttlMs: 2000,
      cooldownMs: 350,
      recoveryMs: 250,
      maxAccounts: 3,
    };
    try {
      await Promise.all([first.onModuleInit(), second.onModuleInit()]);
      const results = await Promise.all(
        Array.from({ length: 40 }, (_, i) =>
          (i % 2 ? first : second).consumeAccount(
            i % 2 ? email : email.toUpperCase(),
            policy,
          ),
        ),
      );
      assert.equal(results.filter((r) => r.allowed).length, 5);
      assert.equal(results.filter((r) => !r.allowed).length, 35);
      assert.ok(
        results
          .filter((r) => !r.allowed)
          .every((r) => r.retryAfter === 1 && !r.capacityExceeded),
      );
      assert.equal(JSON.parse(await inspect.get(key)).length, 4);
      assert.ok(
        (await inspect.pttl(key)) > 0 &&
          (await inspect.pttl(key)) <= policy.ttlMs,
      );
      const deadline = JSON.parse(await inspect.get(key))[2];
      const ttl = await inspect.pttl(key);
      await delay(75);
      for (let i = 0; i < 5; i++)
        assert.equal(
          (await first.consumeAccount(email, policy)).allowed,
          false,
        );
      assert.equal(JSON.parse(await inspect.get(key))[2], deadline);
      assert.ok((await inspect.pttl(key)) < ttl, "denials do not refresh TTL");
      await delay(310);
      // No single raceable recovery token: every simultaneous retry gets a chance.
      const recovered = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          (i % 2 ? first : second).consumeAccount(email, policy),
        ),
      );
      assert.ok(recovered.every((r) => r.allowed));
      const grace = JSON.parse(await inspect.get(key))[3];
      await first.consumeAccount(email, policy);
      assert.equal(
        JSON.parse(await inspect.get(key))[3],
        grace,
        "admitted requests cannot prolong recovery",
      );
      await delay(270);
      assert.equal((await second.consumeAccount(email, policy)).allowed, false);
      // Independent accounts do not share a bucket; storage has a hard active-account cap.
      assert.equal(
        (await first.consumeAccount(`other_${email}`, policy)).allowed,
        true,
      );
      assert.equal(
        (await second.consumeAccount(`third_${email}`, policy)).allowed,
        true,
      );
      assert.equal(
        (await first.consumeAccount(`fourth_${email}`, policy))
          .capacityExceeded,
        true,
      );
      assert.equal(await inspect.zcard(`${namespace}:account:v1:active`), 3);
      assert.equal(
        await inspect.exists(
          `${namespace}:account:v1:${accountIdentity(`fourth_${email}`, Buffer.from(process.env.AUTH_ACCOUNT_HMAC_KEY!, "hex"))}`,
        ),
        0,
      );
      const keys = await inspect.keys(`${namespace}:account:v1:*`);
      assert.equal(keys.length, 4);
      assert.equal(
        JSON.stringify(keys).toLowerCase().includes(email.toLowerCase()),
        false,
      );
      for (const accountKey of keys.filter(
        (k: string) => !k.endsWith(":active"),
      ))
        assert.equal(JSON.parse(await inspect.get(accountKey)).length, 4);
      await delay(2100);
      assert.equal(await inspect.exists(key), 0);
      assert.equal((await second.consumeAccount(email, policy)).allowed, true);
      // Refill uses Redis elapsed time, even when cooldown/recovery are far away.
      const refillPolicy = {
        ...policy,
        burst: 1,
        refillMs: 120,
        cooldownMs: 1000,
      };
      const refillEmail = `refill_${email}`;
      assert.equal(
        (await first.consumeAccount(refillEmail, refillPolicy)).allowed,
        true,
      );
      assert.equal(
        (await first.consumeAccount(refillEmail, refillPolicy)).allowed,
        false,
      );
      await delay(150);
      assert.equal(
        (await second.consumeAccount(refillEmail, refillPolicy)).allowed,
        true,
      );
      second.onModuleDestroy();
      await assert.rejects(() => second.consumeAccount(email));
    } finally {
      first.onModuleDestroy();
      second.onModuleDestroy();
      inspect.disconnect();
      if (previous === undefined) delete process.env.RATE_LIMIT_NAMESPACE;
      else process.env.RATE_LIMIT_NAMESPACE = previous;
    }
  },
);

test(
  "login account protection spans two APIs and many trusted networks without account enumeration or session changes",
  { timeout: 45000 },
  async () => {
    const { NestFactory } = requireApi("@nestjs/core");
    const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
    const { AppModule, Database, Errors } = requireApi("./dist/app.js");
    const { accountIdentity } = requireApi("./dist/account-protection.js");
    const { RedisAuthLimiter } = requireApi("./dist/rate-limit.js");
    const Redis = requireApi("ioredis");
    const previous = process.env.RATE_LIMIT_NAMESPACE;
    const namespace = `nexos:test:account:http:${randomBytes(8).toString("hex")}`;
    process.env.RATE_LIMIT_NAMESPACE = namespace;
    const apps: any[] = [];
    const inspect = new Redis(process.env.REDIS_URL);
    const db = new PrismaClient();
    const suffix = randomBytes(8).toString("hex");
    const email = `account_${suffix}@example.com`,
      unknown = `unknown_${suffix}@example.com`;
    const password = randomBytes(24).toString("base64url");
    try {
      for (let i = 0; i < 2; i++) {
        const app = await NestFactory.create(
          AppModule,
          new FastifyAdapter({ logger: false, trustProxy: ["192.0.2.10"] }),
          { logger: false },
        );
        apps.push(app);
        await app.register(requireApi("@fastify/cookie"));
        app.setGlobalPrefix("api/v1");
        app.useGlobalFilters(new Errors());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
      }
      const request = (
        index: number,
        address: number,
        body: unknown,
        path = "auth/login",
        cookie?: string,
        origin = "http://localhost:3000",
      ) =>
        apps[index]
          .getHttpAdapter()
          .getInstance()
          .inject({
            method: path === "auth/me" ? "GET" : "POST",
            url: `/api/v1/${path}`,
            remoteAddress: "192.0.2.10",
            headers: {
              origin,
              "content-type": "application/json",
              "x-forwarded-for": `198.51.100.${address}`,
              ...(cookie ? { cookie } : {}),
            },
            ...(path === "auth/me" ? {} : { payload: body }),
          });
      const registered = await request(
        0,
        1,
        { email, username: `acct_${suffix}`, password },
        "auth/register",
      );
      assert.equal(registered.statusCode, 201);
      const cookie = registered.headers["set-cookie"].split(";")[0];
      assert.equal(
        await inspect.zcard(`${namespace}:account:v1:active`),
        0,
        "registration has no account login budget",
      );
      assert.equal(
        (
          await request(
            0,
            2,
            { email, password },
            "auth/login",
            undefined,
            "http://evil.example",
          )
        ).statusCode,
        403,
      );
      assert.equal(
        (await request(0, 3, { email, password: "short" })).statusCode,
        400,
      );
      assert.equal(
        await inspect.zcard(`${namespace}:account:v1:active`),
        0,
        "invalid origin/input never allocates account keys",
      );
      const responses: any[] = [];
      for (const target of [email, unknown]) {
        for (let i = 0; i < 5; i++) {
          const response = await request(i % 2, 10 + i, {
            email: i % 2 ? target.toUpperCase() : target,
            password: "wrong-test-only-password",
          });
          assert.equal(response.statusCode, 401);
          assert.equal(
            response.json().error.message,
            "Invalid email or password",
          );
        }
        const blocked = await request(1, 40, { email: target, password });
        responses.push(blocked);
        assert.equal(blocked.statusCode, 429);
        assert.ok(
          Number(blocked.headers["retry-after"]) >= 1 &&
            Number(blocked.headers["retry-after"]) <= 25,
        );
        assert.equal(blocked.headers["set-cookie"], undefined);
      }
      assert.equal(
        responses[0].json().error.status,
        responses[1].json().error.status,
      );
      assert.equal(
        responses[0].json().error.message,
        responses[1].json().error.message,
      );
      // Exercise capacity's HTTP mapping against real Redis with a smaller
      // test-only capacity; production thresholds and recovery stay unchanged.
      const capacityLimiter = apps[0].get(RedisAuthLimiter);
      const consume = capacityLimiter.consumeAccount.bind(capacityLimiter);
      capacityLimiter.consumeAccount = (target: string) =>
        consume(target, {
          ...requireApi("./dist/account-protection.js").ACCOUNT_LOGIN_POLICY,
          maxAccounts: 2,
        });
      try {
        const full = await request(0, 41, {
          email: `capacity_${suffix}@example.com`,
          password,
        });
        assert.equal(full.statusCode, 503);
        assert.equal(full.headers["retry-after"], "1");
        assert.equal(
          full.json().error.message,
          "Authentication temporarily unavailable. Try again later.",
        );
      } finally {
        capacityLimiter.consumeAccount = consume;
      }
      assert.equal(
        (await request(1, 50, undefined, "auth/me", cookie)).statusCode,
        200,
        "existing sessions are unaffected",
      );
      const key = `${namespace}:account:v1:${accountIdentity(email, Buffer.from(process.env.AUTH_ACCOUNT_HMAC_KEY!, "hex"))}`;
      const state = JSON.parse(await inspect.get(key));
      // Use the real policy's recovery deadline, not a bypass or shortened HTTP policy.
      await delay(Math.max(0, Number(state[2]) - Date.now()) + 40);
      const recovery = await Promise.all([
        request(0, 51, { email, password: "wrong-test-only-password" }),
        request(1, 52, { email, password }),
        request(0, 53, { email, password: "wrong-test-only-password" }),
      ]);
      assert.deepEqual(
        recovery.map((r) => r.statusCode),
        [401, 201, 401],
      );
      const authenticated = recovery[1].headers["set-cookie"].split(";")[0];
      assert.equal(
        (await request(1, 54, undefined, "auth/me", authenticated)).statusCode,
        200,
      );
      // Account-store failure stays controlled even when IP admission still works.
      await inspect.del(key);
      await inspect.set(key, "test-owned-wrong-type", "PX", 1000);
      const failed = await request(0, 55, { email, password });
      assert.equal(failed.statusCode, 503);
      assert.equal(failed.headers["retry-after"], "1");
      assert.equal(
        failed.json().error.message,
        "Authentication temporarily unavailable. Try again later.",
      );
      assert.equal(JSON.stringify(failed.json()).includes(email), false);
      assert.equal(JSON.stringify(failed.json()).includes("WRONGTYPE"), false);
      assert.equal(failed.headers["set-cookie"], undefined);
      // The shared client is also the one exercised by readiness's account probe.
      assert.ok(apps[0].get(RedisAuthLimiter));
    } finally {
      await Promise.all(apps.map((app) => app.close()));
      inspect.disconnect();
      await db.auditLog.deleteMany({ where: { actor: { email } } });
      await db.user.deleteMany({ where: { email } });
      await db.$disconnect();
      if (previous === undefined) delete process.env.RATE_LIMIT_NAMESPACE;
      else process.env.RATE_LIMIT_NAMESPACE = previous;
    }
  },
);

test(
  "security gate rejects tampered tokens and CSRF variants; NUL boundaries return client errors without mutation",
  { timeout: 20000 },
  async (context) => {
    const { NestFactory } = requireApi("@nestjs/core");
    const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
    const { AppModule, Database, Errors } = requireApi("./dist/app.js");
    const captured: string[] = [];
    context.mock.method(console, "error", (entry: unknown) =>
      captured.push(String(entry)),
    );
    const previous = process.env.RATE_LIMIT_NAMESPACE;
    process.env.RATE_LIMIT_NAMESPACE = `nexos:test:gate:${randomBytes(8).toString("hex")}`;
    const email = `gate_${randomBytes(8).toString("hex")}@example.com`;
    const app = await NestFactory.create(
      AppModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    let db: InstanceType<typeof PrismaClient> | undefined;
    try {
      await app.register(requireApi("@fastify/cookie"));
      app.setGlobalPrefix("api/v1");
      app.useGlobalFilters(new Errors());
      await app.init();
      db = app.get(Database);
      const http = app.getHttpAdapter().getInstance();
      await http.ready();
      const headers = {
        origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
        "content-type": "application/json",
      };
      const registered = await http.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers,
        payload: {
          email,
          username: `gate_${randomBytes(8).toString("hex")}`,
          password: randomBytes(24).toString("base64url"),
        },
      });
      assert.equal(registered.statusCode, 201);
      const cookie = registered.headers["set-cookie"].split(";")[0];
      const token = cookie.slice(cookie.indexOf("=") + 1);
      const fixtureId = registered.json().user.id;
      const count = await db.session.count({ where: { userId: fixtureId } });
      for (const invalid of [
        "",
        "not-a-token",
        `${token}x`,
        token.slice(0, -1),
        randomBytes(32).toString("base64url"),
        "x".repeat(2048),
      ]) {
        const denied = await http.inject({
          url: "/api/v1/auth/me",
          headers: { cookie: `romhub_session=${invalid}` },
        });
        assert.equal(denied.statusCode, 401);
        assert.equal(denied.headers["set-cookie"], undefined);
        assert.equal(JSON.stringify(denied.json()).includes(token), false);
      }
      const bearer = await http.inject({
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(
        bearer.statusCode,
        401,
        "session tokens are accepted only via the established cookie contract",
      );
      for (const origin of [
        undefined,
        "null",
        `${headers.origin}.evil.example`,
        `${headers.origin}, https://evil.example`,
      ]) {
        const requestHeaders: Record<string, string> = {
          cookie,
          "content-type": "application/json",
        };
        if (origin !== undefined) requestHeaders.origin = origin;
        const denied = await http.inject({
          method: "POST",
          url: "/api/v1/auth/logout",
          headers: requestHeaders,
          payload: {},
        });
        assert.equal(denied.statusCode, 403);
        assert.equal(denied.headers["set-cookie"], undefined);
      }
      const badMedia = await http.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { ...headers, cookie, "content-type": "application/jsonp" },
        payload: "{}",
      });
      assert.equal(badMedia.statusCode, 415);
      assert.equal(
        (
          await http.inject({
            url: "/api/v1/admin/audit",
            headers: { cookie, "x-user-role": "ADMIN", "x-user-id": "admin" },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await http.inject({
            url: "/api/v1/projects",
            headers: { cookie, "x-user-id": "other-owner" },
          })
        ).json().items.length,
        0,
      );
      // C1 validates only the actual decoded NUL before PostgreSQL access.
      for (const [method, url, message] of [
        ["DELETE", "/api/v1/auth/sessions/%00", "Invalid session identifier"],
        [
          "GET",
          "/api/v1/legacy/catalog-projects/%00",
          "Invalid catalog project slug",
        ],
        [
          "GET",
          "/api/v1/devices?manufacturerId=%00",
          "Invalid manufacturer identifier",
        ],
      ]) {
        const invalid = await http.inject({
          method,
          url,
          headers: { ...headers, cookie },
          ...(method === "DELETE" ? { payload: {} } : {}),
        });
        assert.equal(invalid.statusCode, 400);
        assert.equal(invalid.json().error.message, message);
        assert.equal(typeof invalid.json().error.requestId, "string");
        for (const sensitive of [
          email,
          token,
          process.env.AUTH_ACCOUNT_HMAC_KEY!,
          "Prisma",
          "SELECT",
          "DATABASE_URL",
        ]) {
          assert.equal(
            invalid.body.includes(sensitive),
            false,
            "residual errors must not disclose credentials or database details",
          );
        }
        assert.equal(invalid.headers["set-cookie"], undefined);
      }
      assert.equal(
        captured.length,
        0,
        "client validation must not be logged as an unexpected server failure",
      );
      for (const entry of captured) {
        const event = JSON.parse(entry);
        assert.deepEqual(Object.keys(event).sort(), [
          "error",
          "event",
          "requestId",
        ]);
        assert.equal(event.event, "request.error");
        for (const sensitive of [
          email,
          token,
          process.env.AUTH_ACCOUNT_HMAC_KEY!,
        ])
          assert.equal(
            entry.includes(sensitive),
            false,
            "error logs must not contain credentials",
          );
      }
      assert.equal(
        await db.session.count({ where: { userId: fixtureId } }),
        count,
      );
      assert.equal(
        (await http.inject({ url: "/api/v1/auth/me", headers: { cookie } }))
          .statusCode,
        200,
      );
      const nonexistent = await http.inject({
        method: "DELETE",
        url: `/api/v1/auth/sessions/missing-${randomBytes(8).toString("hex")}`,
        headers: { ...headers, cookie },
        payload: {},
      });
      assert.equal(nonexistent.statusCode, 200);
      assert.equal(
        await db.session.count({ where: { userId: fixtureId } }),
        count,
      );
      const logout = await http.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { ...headers, cookie },
        payload: {},
      });
      assert.equal(logout.statusCode, 201);
      assert.equal(
        (await http.inject({ url: "/api/v1/auth/me", headers: { cookie } }))
          .statusCode,
        401,
      );
      assert.equal(await db.session.count({ where: { userId: fixtureId } }), 0);
    } finally {
      if (db) {
        await db.auditLog.deleteMany({ where: { actor: { email } } });
        await db.user.deleteMany({ where: { email } });
      }
      await app.close();
      if (previous === undefined) delete process.env.RATE_LIMIT_NAMESPACE;
      else process.env.RATE_LIMIT_NAMESPACE = previous;
    }
  },
);

test(
  "C1 rejects decoded NUL at all three boundaries before lookup and preserves auth order and infrastructure errors",
  { timeout: 20000 },
  async (context) => {
    const { NestFactory } = requireApi("@nestjs/core");
    const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
    const { AppModule, Database, Errors } = requireApi("./dist/app.js");
    const { Prisma } = requireApi("@prisma/client");
    const previous = process.env.RATE_LIMIT_NAMESPACE;
    process.env.RATE_LIMIT_NAMESPACE = `nexos:test:c1:${randomBytes(8).toString("hex")}`;
    const email = `c1_${randomBytes(8).toString("hex")}@example.com`;
    const app = await NestFactory.create(
      AppModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    let db: InstanceType<typeof PrismaClient> | undefined;
    const restoreLookups: Array<() => void> = [];
    try {
      await app.register(requireApi("@fastify/cookie"));
      app.setGlobalPrefix("api/v1");
      app.useGlobalFilters(new Errors());
      await app.init();
      db = app.get(Database);
      const http = app.getHttpAdapter().getInstance();
      await http.ready();
      const headers = {
        origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
        "content-type": "application/json",
      };
      const registered = await http.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers,
        payload: {
          email,
          username: `c1_${randomBytes(8).toString("hex")}`,
          password: randomBytes(24).toString("base64url"),
        },
      });
      assert.equal(registered.statusCode, 201);
      const cookie = registered.headers["set-cookie"].split(";")[0];
      const userId = registered.json().user.id;
      const request = (
        method: string,
        url: string,
        token: string | null = cookie,
        origin: string = headers.origin,
      ) =>
        http.inject({
          method,
          url,
          headers: { ...headers, origin, ...(token ? { cookie: token } : {}) },
          ...(method === "DELETE" ? { payload: {} } : {}),
        });
      // Prisma delegate methods are proxy properties without ordinary method
      // descriptors. Assign test-only counted wrappers and restore them explicitly.
      function track(
        delegate: Record<string, (...args: unknown[]) => unknown>,
        name: string,
      ) {
        const original = delegate[name];
        const tracked = context.mock.fn((...args: unknown[]) =>
          Reflect.apply(original, delegate, args),
        );
        delegate[name] = tracked;
        restoreLookups.push(() => {
          delegate[name] = original;
        });
        return tracked;
      }
      const sessionLookup = track(db.session, "deleteMany");
      const slugLookup = track(db.project, "findUnique");
      const deviceLookup = track(db.device, "findMany");
      const deviceCount = track(db.device, "count");
      for (const encoded of ["%00", "missing%00suffix"]) {
        for (const [method, url, message] of [
          [
            "DELETE",
            `/api/v1/auth/sessions/${encoded}`,
            "Invalid session identifier",
          ],
          [
            "GET",
            `/api/v1/legacy/catalog-projects/${encoded}`,
            "Invalid catalog project slug",
          ],
          [
            "GET",
            `/api/v1/devices?manufacturerId=${encoded}`,
            "Invalid manufacturer identifier",
          ],
        ]) {
          const response = await request(method, url);
          assert.equal(response.statusCode, 400);
          assert.equal(response.json().error.status, 400);
          assert.equal(response.json().error.message, message);
          assert.equal(typeof response.json().error.requestId, "string");
          assert.equal(response.headers["set-cookie"], undefined);
        }
      }
      for (const lookup of [
        sessionLookup,
        slugLookup,
        deviceLookup,
        deviceCount,
      ])
        assert.equal(
          lookup.mock.calls.length,
          0,
          "NUL must be rejected before the corresponding database operation",
        );
      assert.equal(
        (await request("DELETE", "/api/v1/auth/sessions/%00", null)).statusCode,
        401,
      );
      assert.equal(
        (
          await request(
            "DELETE",
            "/api/v1/auth/sessions/%00",
            "romhub_session=invalid",
          )
        ).statusCode,
        401,
      );
      assert.equal(
        (
          await request(
            "DELETE",
            "/api/v1/auth/sessions/%00",
            cookie,
            "https://evil.example",
          )
        ).statusCode,
        403,
      );
      // Percent-looking text is not recursively decoded, and existing opaque
      // identifier behavior is preserved instead of requiring a CUID/UUID format.
      assert.equal(
        (await request("DELETE", "/api/v1/auth/sessions/opaque%2500id"))
          .statusCode,
        200,
      );
      assert.equal(
        (
          await request(
            "GET",
            "/api/v1/legacy/catalog-projects/opaque%2500slug",
          )
        ).statusCode,
        404,
      );
      const absent = await request(
        "GET",
        "/api/v1/devices?manufacturerId=opaque%2500id",
      );
      assert.equal(absent.statusCode, 200);
      assert.equal(absent.json().total, 0);
      assert.equal(
        (await request("GET", "/api/v1/projects/%00", null)).statusCode,
        401,
      );
      assert.equal(
        (await request("GET", "/api/v1/projects/%00")).statusCode,
        400,
      );
      // A synthetic database initialization failure on an otherwise valid lookup
      // must stay 503, never be mislabeled as a client input error.
      const failure = new Prisma.PrismaClientInitializationError(
        "c1-sensitive-infrastructure-marker",
        "6.19.0",
        "P1001",
      );
      for (const [lookup, method, url] of [
        [sessionLookup, "DELETE", "/api/v1/auth/sessions/opaque-valid-id"],
        [
          slugLookup,
          "GET",
          "/api/v1/legacy/catalog-projects/opaque-valid-slug",
        ],
        [deviceLookup, "GET", "/api/v1/devices?manufacturerId=opaque-valid-id"],
      ] as const) {
        lookup.mock.mockImplementation(() => {
          throw failure;
        });
        const response = await request(method, url);
        assert.equal(response.statusCode, 503);
        assert.equal(
          response.json().error.message,
          "Database unavailable. Try again later.",
        );
        assert.equal(
          response.body.includes("c1-sensitive-infrastructure-marker"),
          false,
        );
        lookup.mock.restore();
      }
      assert.equal(await db.session.count({ where: { userId } }), 1);
      assert.equal((await request("GET", "/api/v1/auth/me")).statusCode, 200);
    } finally {
      for (const restore of restoreLookups) restore();
      if (db) {
        await db.auditLog.deleteMany({ where: { actor: { email } } });
        await db.user.deleteMany({ where: { email } });
      }
      await app.close();
      if (previous === undefined) delete process.env.RATE_LIMIT_NAMESPACE;
      else process.env.RATE_LIMIT_NAMESPACE = previous;
    }
  },
);

test("C2 shared wire schemas match real auth, catalog, project and error responses without changing serialization", { timeout: 20000 }, async () => {
  const contracts = await import("../packages/contracts/src");
  const { NestFactory } = requireApi("@nestjs/core");
  const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
  const { AppModule, Database, Errors } = requireApi("./dist/app.js");
  const previous = process.env.RATE_LIMIT_NAMESPACE;
  process.env.RATE_LIMIT_NAMESPACE = `nexos:test:c2:${randomBytes(8).toString("hex")}`;
  const email = `c2_${randomBytes(8).toString("hex")}@example.com`;
  const app = await NestFactory.create(AppModule, new FastifyAdapter({ logger: false }), { logger: false });
  let db: InstanceType<typeof PrismaClient> | undefined;
  try {
    await app.register(requireApi("@fastify/cookie"));
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new Errors());
    await app.init();
    db = app.get(Database);
    const http = app.getHttpAdapter().getInstance();
    await http.ready();
    let cookie: string | undefined;
    const request = (url: string, method = "GET", payload?: unknown) => http.inject({
      method, url: `/api/v1/${url}`, headers: {
        origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
        "content-type": "application/json", ...(cookie ? { cookie } : {}),
      }, ...(payload === undefined ? {} : { payload }),
    });
    function unchanged<T>(schema: { parse: (value: unknown) => T }, response: { json: () => unknown }): T {
      const body = response.json();
      assert.deepEqual(schema.parse(body), body, "shared response schema must not strip, default or transform observed wire data");
      return schema.parse(body);
    }
    const registered = await request("auth/register", "POST", {
      email, username: `c2_${randomBytes(8).toString("hex")}`, password: randomBytes(24).toString("base64url"),
    });
    assert.equal(registered.statusCode, 201);
    unchanged(contracts.authenticationResponseSchema, registered);
    cookie = registered.headers["set-cookie"].split(";")[0];
    unchanged(contracts.authenticationResponseSchema, await request("auth/me"));
    unchanged(contracts.sessionsResponseSchema, await request("auth/sessions"));
    for (const [path, schema] of [
      ["health", contracts.healthResponseSchema], ["ready", contracts.readyResponseSchema],
      ["manufacturers", contracts.manufacturersResponseSchema], ["devices", contracts.devicesResponseSchema],
      ["android-bases", contracts.androidBasesResponseSchema], ["legacy/catalog-projects", contracts.legacyProjectsResponseSchema],
    ] as const) {
      const response = await request(path);
      assert.equal(response.statusCode, 200);
      unchanged<unknown>(schema, response);
    }
    const invalid = await request("projects", "POST", { ...defaultConfiguration, ownerId: "forbidden" });
    assert.equal(invalid.statusCode, 400);
    unchanged(contracts.apiErrorSchema, invalid);
    const created = await request("projects", "POST", defaultConfiguration);
    assert.equal(created.statusCode, 201);
    const project = unchanged(contracts.projectWriteResponseSchema, created);
    assert.equal("deviceVariant" in project, false);
    unchanged(contracts.projectsResponseSchema, await request("projects"));
    unchanged(contracts.projectDetailResponseSchema, await request(`projects/${project.id}`));
    const saved = await request(`projects/${project.id}`, "PATCH", {
      configuration: { ...defaultConfiguration, description: "Contract fixture" }, revision: 1,
    });
    assert.equal(saved.statusCode, 200);
    unchanged(contracts.projectWriteResponseSchema, saved);
    unchanged(contracts.revisionsResponseSchema, await request(`projects/${project.id}/revisions`));
    const validated = await request(`projects/${project.id}/validate`, "POST", {});
    assert.equal(validated.statusCode, 201);
    unchanged(contracts.compatibilityResponseSchema, validated);
    const unavailable = await request(`projects/${project.id}/builds`, "POST", {});
    assert.equal(unavailable.statusCode, 503);
    unchanged(contracts.apiErrorSchema, unavailable);
    // Verify the non-null nested device shape (not CatalogDevice) using existing verified catalog records.
    const catalog = contracts.devicesResponseSchema.parse((await request("devices")).json());
    const variant = catalog.items.flatMap(d => d.variants)[0];
    const bases = contracts.androidBasesResponseSchema.parse((await request("android-bases")).json());
    assert.ok(variant && bases.items[0], "existing source-backed catalog fixtures are required");
    const selected = await request(`projects/${project.id}`, "PATCH", {
      configuration: { ...defaultConfiguration, variantId: variant.id, base: bases.items[0].id }, revision: 2,
    });
    assert.equal(selected.statusCode, 200);
    const detail = unchanged(contracts.projectDetailResponseSchema, await request(`projects/${project.id}`));
    assert.ok(detail.deviceVariant);
    assert.equal("variants" in detail.deviceVariant.device, false);
    assert.ok(detail.androidBase);
    unchanged(contracts.successResponseSchema, await request("auth/logout", "POST", {}));
    const unauthorized = await request("auth/me");
    assert.equal(unauthorized.statusCode, 401);
    unchanged(contracts.apiErrorSchema, unauthorized);
  } finally {
    if (db) {
      await db.auditLog.deleteMany({ where: { actor: { email } } });
      await db.user.deleteMany({ where: { email } });
    }
    await app.close();
    if (previous === undefined) delete process.env.RATE_LIMIT_NAMESPACE;
    else process.env.RATE_LIMIT_NAMESPACE = previous;
  }
});

test("C3 distinguishes invalid persisted configuration from invalid client input without changing auth or writes", { timeout: 20000 }, async (context) => {
  const { NestFactory } = requireApi("@nestjs/core");
  const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
  const { AppModule, Database, Errors } = requireApi("./dist/app.js");
  const contracts = await import("../packages/contracts/src");
  const log = context.mock.method(console, "error", () => {});
  const previous = process.env.RATE_LIMIT_NAMESPACE;
  process.env.RATE_LIMIT_NAMESPACE = `nexos:test:c3:${randomBytes(8).toString("hex")}`;
  const email = `c3_${randomBytes(8).toString("hex")}@example.com`;
  const app = await NestFactory.create(AppModule, new FastifyAdapter({ logger: false }), { logger: false });
  let db: InstanceType<typeof PrismaClient> | undefined;
  try {
    await app.register(requireApi("@fastify/cookie"));
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new Errors());
    await app.init();
    db = app.get(Database);
    const http = app.getHttpAdapter().getInstance();
    await http.ready();
    let cookie: string | undefined;
    const request = (url: string, method = "GET", payload?: unknown, origin = process.env.WEB_ORIGIN ?? "http://localhost:3000") => http.inject({
      method, url: `/api/v1/${url}`, headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      ...(payload === undefined ? {} : { payload }),
    });
    const registered = await request("auth/register", "POST", {
      email, username: `c3_${randomBytes(8).toString("hex")}`, password: randomBytes(24).toString("base64url"),
    });
    assert.equal(registered.statusCode, 201);
    cookie = registered.headers["set-cookie"].split(";")[0];
    for (const path of ["devices", "legacy/catalog-projects"]) {
      for (const encoded of ["%00", "prefix%00suffix"]) {
        const invalidQuery = await request(`${path}?q=${encoded}`);
        assert.equal(invalidQuery.statusCode, 400);
        assert.deepEqual(contracts.apiErrorSchema.parse(invalidQuery.json()).error.message, ["q: Invalid search query"]);
      }
    }
    assert.equal(log.mock.calls.length, 0, "invalid search input is not an internal error");
    for (const field of ["name", "description", "variantId", "base"]) {
      const response = await request("projects", "POST", {...defaultConfiguration,[field]:"prefix\u0000suffix"});
      assert.equal(response.statusCode,400);
      assert.ok(Array.isArray(contracts.apiErrorSchema.parse(response.json()).error.message));
    }
    assert.equal(log.mock.calls.length, 0, "unstorable NUL input must not reach the database");
    const created = await request("projects", "POST", defaultConfiguration);
    assert.equal(created.statusCode, 201);
    const id = created.json().id;
    const corrupted = { internal: "c3-stored-sensitive-marker" };
    await db.rOMProject.update({ where: { id }, data: { configuration: corrupted } });
    for (const [method, path, payload] of [
      ["GET", `projects/${id}`, undefined],
      ["PATCH", `projects/${id}`, { configuration: defaultConfiguration, revision: 1 }],
      ["POST", `projects/${id}/validate`, {}],
      ["POST", `projects/${id}/builds`, {}],
    ] as const) {
      const response = await request(path, method, payload);
      assert.equal(response.statusCode, 500);
      const body = contracts.apiErrorSchema.parse(response.json());
      assert.equal(body.error.message, "An unexpected error occurred.");
      assert.equal(response.body.includes("c3-stored-sensitive-marker"), false);
      assert.equal(response.body.includes("schemaVersion"), false);
      assert.equal(response.headers["retry-after"], undefined);
    }
    assert.equal(log.mock.calls.length, 4);
    for (const call of log.mock.calls) {
      const event = JSON.parse(call.arguments[0]);
      assert.deepEqual(Object.keys(event).sort(), ["error", "event", "requestId"]);
      assert.equal(event.event, "request.error");
      assert.equal(JSON.stringify(event).includes("c3-stored-sensitive-marker"), false);
    }
    const invalid = await request(`projects/${id}`, "PATCH", {configuration:{},revision:1});
    assert.equal(invalid.statusCode, 400);
    assert.ok(Array.isArray(contracts.apiErrorSchema.parse(invalid.json()).error.message));
    assert.equal((await request(`projects/${id}`, "PATCH", {configuration:defaultConfiguration,revision:1}, "https://evil.example")).statusCode,403);
    assert.equal((await request("projects/opaque-not-owned")).statusCode,404);
    const savedCookie = cookie;
    cookie = undefined;
    assert.equal((await request(`projects/${id}`)).statusCode,401);
    cookie = savedCookie;
    assert.equal((await request("auth/me")).statusCode,200);
    const persisted = await db.rOMProject.findUniqueOrThrow({where:{id}});
    assert.deepEqual(persisted.configuration,corrupted);
    assert.equal(persisted.revision,1);
    assert.equal(await db.configurationRevision.count({where:{projectId:id}}),1);
  } finally {
    if(db){
      await db.auditLog.deleteMany({where:{actor:{email}}});
      await db.user.deleteMany({where:{email}});
    }
    await app.close();
    if(previous===undefined)delete process.env.RATE_LIMIT_NAMESPACE;
    else process.env.RATE_LIMIT_NAMESPACE=previous;
  }
});

test("C4 keyset pagination preserves legacy limits, ties, bounds, ownership and live insert/delete semantics", { timeout: 30000 }, async (context) => {
  const { NestFactory } = requireApi("@nestjs/core");
  const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
  const { AppModule, Database, Errors } = requireApi("./dist/app.js");
  const contracts = await import("../packages/contracts/src");
  const previous = process.env.RATE_LIMIT_NAMESPACE;
  process.env.RATE_LIMIT_NAMESPACE = `nexos:test:c4:${randomBytes(8).toString("hex")}`;
  const suffix=randomBytes(8).toString("hex");
  const emails=[`c4_${suffix}@example.com`,`c4_other_${suffix}@example.com`];
  const app=await NestFactory.create(AppModule,new FastifyAdapter({logger:false}),{logger:false});
  let db: InstanceType<typeof PrismaClient> | undefined;
  const restore: Array<()=>void>=[];
  try {
    await app.register(requireApi("@fastify/cookie"));
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new Errors());
    await app.init();
    db=app.get(Database);
    const http=app.getHttpAdapter().getInstance();await http.ready();
    const origin=process.env.WEB_ORIGIN??"http://localhost:3000";
    let cookie: string | undefined;
    const request=(path:string,method="GET",payload?:unknown)=>http.inject({method,url:`/api/v1/${path}`,headers:{origin,"content-type":"application/json",...(cookie?{cookie}:{})},...(payload===undefined?{}:{payload})});
    const users: Array<{id:string;cookie:string}>=[];
    for(let i=0;i<2;i++){
      const registered=await request("auth/register","POST",{email:emails[i],username:`c4_${i}_${suffix}`,password:randomBytes(24).toString("base64url")});
      assert.equal(registered.statusCode,201);
      users.push({id:registered.json().user.id as string,cookie:registered.headers["set-cookie"].split(";")[0] as string});
    }
    cookie=users[0].cookie;
    assert.deepEqual((await request("projects?pagination=cursor&limit=2")).json(),{items:[],pagination:{limit:2,hasMore:false,nextCursor:null}});
    const date=new Date("2026-01-01T00:00:00.000Z");
    const projectIds=Array.from({length:105},(_,i)=>`c4-${suffix}-${String(i).padStart(3,"0")}`);
    await db.rOMProject.createMany({data:projectIds.map(id=>({id,ownerId:users[0].id,configuration:defaultConfiguration,createdAt:date,updatedAt:date}))});
    const revisionProject=projectIds[0];
    await db.configurationRevision.createMany({data:Array.from({length:55},(_,i)=>({id:`c4-r-${suffix}-${i}`,projectId:revisionProject,number:i+1,configuration:defaultConfiguration,createdAt:date}))});
    await db.session.createMany({data:Array.from({length:105},(_,i)=>({id:`c4-s-${suffix}-${String(i).padStart(3,"0")}`,userId:users[0].id,tokenHash:randomBytes(32).toString("hex"),createdAt:date,expiresAt:new Date(Date.now()+3600000)}))});
    await db.session.create({data:{id:`c4-expired-${suffix}`,userId:users[0].id,tokenHash:randomBytes(32).toString("hex"),createdAt:date,expiresAt:new Date(0)}});
    function track(delegate:Record<string,(...args:unknown[])=>unknown>,name:string){
      const original=delegate[name];
      const fn=context.mock.fn((...args:unknown[])=>Reflect.apply(original,delegate,args));
      delegate[name]=fn;restore.push(()=>{delegate[name]=original;});return fn;
    }
    const projects=track(db.rOMProject,"findMany"), sessions=track(db.session,"findMany"), revisions=track(db.configurationRevision,"findMany"), audits=track(db.auditLog,"findMany");
    const legacy=(await request("projects")).json();
    assert.deepEqual(Object.keys(legacy),["items"]);assert.equal(legacy.items.length,100);
    assert.deepEqual(legacy.items.map((p:{id:string})=>p.id),projectIds.slice().reverse().slice(0,100));
    assert.equal((await request(`projects/${revisionProject}/revisions`)).json().items.length,50);
    const legacySessions=(await request("auth/sessions")).json();
    assert.deepEqual(Object.keys(legacySessions),["items"]);assert.equal(legacySessions.items.length,106);
    assert.equal((await request("projects?limit=invalid&cursor=invalid")).json().items.length,100);
    async function collect(path:string,limit:number,schema:{parse:(value:unknown)=>{items:{id:string}[];pagination:{nextCursor:string|null;hasMore:boolean;limit:number}}},spy:typeof projects){
      const ids:string[]=[];let cursor:string|null=null;
      for(let n=0;n<20;n++){
        const response=await request(`${path}?pagination=cursor&limit=${limit}${cursor?`&cursor=${encodeURIComponent(cursor)}`:""}`);
        assert.equal(response.statusCode,200);
        const body=schema.parse(response.json());
        assert.equal(body.pagination.limit,limit);
        assert.equal(body.pagination.hasMore,body.pagination.nextCursor!==null);
        const args=spy.mock.calls.at(-1)?.arguments[0] as {take:number;skip?:number};
        assert.equal(args.take,limit+1);assert.equal(args.skip,undefined);
        ids.push(...body.items.map(item=>item.id));
        cursor=body.pagination.nextCursor;if(!cursor)break;
        assert.ok(n<19,"bounded test traversal must reach the end");
      }
      assert.equal(new Set(ids).size,ids.length);return ids;
    }
    assert.deepEqual(await collect("projects",30,contracts.paginatedProjectsResponseSchema,projects),projectIds.slice().reverse());
    assert.equal((await collect("auth/sessions",30,contracts.paginatedSessionsResponseSchema,sessions)).length,106);
    const revisionIds=await collect(`projects/${revisionProject}/revisions`,20,contracts.paginatedRevisionsResponseSchema,revisions);
    assert.deepEqual(revisionIds,Array.from({length:55},(_,i)=>`c4-r-${suffix}-${54-i}`));
    const empty=await request(`projects/${projectIds[1]}/revisions?pagination=cursor&limit=2`);
    assert.deepEqual(empty.json(),{items:[],pagination:{limit:2,hasMore:false,nextCursor:null}});
    const first=contracts.paginatedProjectsResponseSchema.parse((await request("projects?pagination=cursor&limit=2")).json());
    const cursor=first.pagination.nextCursor!;
    for(const path of ["projects?pagination=cursor&limit=101","projects?pagination=cursor&limit=0","projects?pagination=cursor&limit=1e2","projects?pagination=cursor&limit=2&limit=3","projects?pagination=cursor&cursor=v1.abc","projects?pagination=offset"])
      assert.equal((await request(path)).statusCode,400);
    assert.equal((await request(`auth/sessions?pagination=cursor&cursor=${cursor}`)).statusCode,400);
    const expired = requireApi("./dist/pagination.js").page(first.items,1,`projects:${users[0].id}`,{expiresAt:Date.now()-1},(row:{id:string;createdAt:string})=>({id:row.id,createdAt:row.createdAt})).pagination.nextCursor;
    assert.equal((await request(`projects?pagination=cursor&cursor=${expired}`)).statusCode,400);
    const revisionFirst=contracts.paginatedRevisionsResponseSchema.parse((await request(`projects/${revisionProject}/revisions?pagination=cursor&limit=2`)).json());
    assert.equal((await request(`projects/${projectIds[1]}/revisions?pagination=cursor&cursor=${revisionFirst.pagination.nextCursor}`)).statusCode,400);

    cookie=users[1].cookie;
    assert.equal((await request(`projects?pagination=cursor&cursor=${cursor}`)).statusCode,400);
    assert.equal((await request(`projects/${revisionProject}/revisions?pagination=cursor&cursor=invalid`)).statusCode,404);
    assert.equal((await request("admin/audit?pagination=cursor&cursor=invalid")).statusCode,403);
    assert.deepEqual((await request("projects?pagination=cursor&ownerId=other")).json().items,[]);
    cookie=undefined;
    assert.equal((await request("projects?pagination=cursor&cursor=invalid")).statusCode,401);
    cookie=users[0].cookie;
    // Updating a future page's project cannot move its immutable cursor sort key.
    await db.rOMProject.update({where:{id:projectIds[80]},data:{configuration:{...defaultConfiguration,description:"Fixture edit"}}});
    // Remove the boundary row and one unseen row; no cursor-anchor lookup is required.
    await db.rOMProject.delete({where:{id:first.items[1].id}});
    await db.rOMProject.delete({where:{id:projectIds[90]}});
    const newer=`c4-new-${suffix}`;
    await db.rOMProject.create({data:{id:newer,ownerId:users[0].id,configuration:defaultConfiguration}});
    const next=contracts.paginatedProjectsResponseSchema.parse((await request(`projects?pagination=cursor&limit=100&cursor=${cursor}`)).json());
    assert.deepEqual(next.items.map(item=>item.id),projectIds.slice(0,103).reverse().filter(id=>id!==projectIds[90]).slice(0,100));
    assert.equal(next.items.some(item=>item.id===newer),false);
    assert.equal(next.items.some(item=>item.id===first.items[0].id),false);
    await db.user.update({where:{id:users[0].id},data:{role:"ADMIN"}});
    const auditIds=Array.from({length:55},(_,i)=>`c4-a-${suffix}-${String(i).padStart(3,"0")}`);
    const auditDate=new Date(Date.now()+60000);
    await db.auditLog.createMany({data:auditIds.map(id=>({id,actorId:users[0].id,action:"c4.test",createdAt:auditDate}))});
    const auditLegacy=(await request("admin/audit")).json();assert.equal(auditLegacy.items.length,50);assert.deepEqual(Object.keys(auditLegacy),["items"]);
    const auditFirst=contracts.paginatedAuditResponseSchema.parse((await request("admin/audit?pagination=cursor&limit=50")).json());
    assert.deepEqual(auditFirst.items.map(item=>item.id),auditIds.slice().reverse().slice(0,50));
    assert.equal((audits.mock.calls.at(-1)?.arguments[0] as {take:number}).take,51);
    const auditNext=contracts.paginatedAuditResponseSchema.parse((await request(`admin/audit?pagination=cursor&limit=50&cursor=${auditFirst.pagination.nextCursor}`)).json());
    assert.deepEqual(auditNext.items.slice(0,5).map(item=>item.id),auditIds.slice(0,5).reverse());
    assert.equal((await request("admin/audit?pagination=cursor&limit=51")).statusCode,400);
    const catalog=contracts.devicesResponseSchema.parse((await request("devices")).json());
    assert.ok(catalog.items[0]);
    const filter=new URLSearchParams({manufacturerId:catalog.items[0].manufacturerId,q:catalog.items[0].codename,limit:"1",page:"1"});
    const filtered=(await request(`devices?${filter}`)).json();
    const ignoredKind=(await request(`devices?${filter}&kind=ROM&unknown=ignored`)).json();
    assert.deepEqual(filtered,ignoredKind);
    assert.ok(filtered.total>=1);
    assert.equal(filtered.items[0].manufacturerId,catalog.items[0].manufacturerId);
    filter.set("page","2");
    const following=(await request(`devices?${filter}`)).json();
    assert.equal(following.total,filtered.total);
    assert.equal(following.items.length,filtered.total>1?1:0);
    assert.equal((await request("devices?page=10001")).statusCode,400);

    assert.equal((await request("auth/me")).statusCode,200);
  } finally {
    for(const fn of restore)fn();
    if(db){await db.auditLog.deleteMany({where:{actor:{email:{in:emails}}}});await db.user.deleteMany({where:{email:{in:emails}}});}
    await app.close();
    if(previous===undefined)delete process.env.RATE_LIMIT_NAMESPACE;else process.env.RATE_LIMIT_NAMESPACE=previous;
  }
});

test("C5 registered routes, live OpenAPI JSON/YAML and actual HTTP contracts remain synchronized", { timeout: 40000 }, async (context) => {
  const { NestFactory } = requireApi("@nestjs/core");
  const { FastifyAdapter } = requireApi("@nestjs/platform-fastify");
  const { SwaggerModule } = requireApi("@nestjs/swagger");
  const { AppModule, Database, Errors } = requireApi("./dist/app.js");
  const { RedisAuthLimiter } = requireApi("./dist/rate-limit.js");
  const { createOpenAPIDocument, operationContracts, schemaSources } = requireApi("./dist/openapi.js") as typeof import("../apps/api/src/openapi");
  const { stableJSON } = requireApi("./dist/export-openapi.js") as {stableJSON:(value:unknown)=>string};
  const { validateSpecification } = await import("./helpers/openapi-validation");
  const { readFileSync } = await import("node:fs");
  const suffix=randomBytes(8).toString("hex");
  const emails=[`c5_${suffix}@example.com`,`c5other_${suffix}@example.com`];
  const password=randomBytes(24).toString("base64url");
  const previous=process.env.RATE_LIMIT_NAMESPACE;
  process.env.RATE_LIMIT_NAMESPACE=`nexos:test:c5:${suffix}`;
  const registeredRoutes=new Set<string>();
  const adapter=new FastifyAdapter({logger:false,bodyLimit:32768});
  adapter.getInstance().addHook("onRoute", (route: {url:string;method:string|string[]}) => {
    if(!route.url.startsWith("/api/v1/"))return;
    for(const method of Array.isArray(route.method)?route.method:[route.method])
      if(!["HEAD","OPTIONS"].includes(method))registeredRoutes.add(`${method.toLowerCase()} ${route.url.replace(/:([^/]+)/g,"{$1}")}`);
  });
  const app=await NestFactory.create(AppModule,adapter,{logger:false});
  let db:InstanceType<typeof PrismaClient>|undefined;
  const legacyId=`c5-legacy-${suffix}`;
  let cookie:string|undefined;
  const covered=new Set<string>();
  try {
    await app.register(requireApi("@fastify/cookie"));
    await app.register(requireApi("@fastify/helmet"));
    app.setGlobalPrefix("api/v1");app.useGlobalFilters(new Errors());
    app.enableCors({origin:process.env.WEB_ORIGIN??"http://localhost:3000",credentials:true});
    const document=createOpenAPIDocument(app);
    SwaggerModule.setup("api/docs",app,document);
    await app.init();db=app.get(Database);
    const http=app.getHttpAdapter().getInstance();await http.ready();
    const json=await http.inject({url:"/api/docs-json"});assert.equal(json.statusCode,200);
    assert.equal(stableJSON(json.json()),readFileSync("docs/api/openapi.json","utf8"));
    const specification=validateSpecification(json.json());
    const expected=operationContracts.map(route=>`${route.method} /api/v1${route.path}`).sort();
    assert.deepEqual([...registeredRoutes].sort(),expected);
    const yamlResponse=await http.inject({url:"/api/docs-yaml"});assert.equal(yamlResponse.statusCode,200);
    const swaggerRequire=createRequire(requireApi.resolve("@nestjs/swagger"));
    assert.deepEqual(swaggerRequire("js-yaml").load(yamlResponse.body),json.json());
    async function call(method:string,template:string,url:string,status:number,payload?:unknown,options:{cookie?:string|null;ip?:string;origin?:string;contentType?:string}={}){
      const selectedCookie=options.cookie===undefined?cookie:options.cookie??undefined;
      const headers={origin:options.origin??process.env.WEB_ORIGIN??"http://localhost:3000","content-type":options.contentType??"application/json",...(selectedCookie?{cookie:selectedCookie}:{})};
      const response=await http.inject({method,url:`/api/v1${url}`,remoteAddress:options.ip??"127.0.0.1",headers,...(payload===undefined?{}:{payload})});
      assert.equal(response.statusCode,status,`${method} ${template} unexpected status`);
      specification.response(method,`/api/v1${template}`,status,response.json());
      const route=operationContracts.find(route=>route.method===method.toLowerCase()&&route.path===template)!;
      covered.add(`${route.method} /api/v1${template}`);
      if(status<300&&route.success){
        const name=(Array.isArray(route.success)?route.success[url.includes("pagination=cursor")?1:0]:route.success) as keyof typeof schemaSources;
        assert.deepEqual(schemaSources[name].schema.parse(response.json()),response.json(),"Wire response changed during shared schema validation");
        if(route.body)specification.request(method,`/api/v1${template}`,payload);
      }
      return response;
    }
    const first=await call("POST","/auth/register","/auth/register",201,{email:emails[0],username:`c5_${suffix}`,password},{cookie:null});
    const firstCookie=first.headers["set-cookie"].split(";")[0];cookie=firstCookie;
    const userId=first.json().user.id;
    const second=await call("POST","/auth/register","/auth/register",201,{email:emails[1],username:`c5other_${suffix}`,password},{cookie:null});
    const otherCookie=second.headers["set-cookie"].split(";")[0];
    await call("POST","/auth/register","/auth/register",409,{email:emails[0],username:`c5_${suffix}`,password},{cookie:null});
    await call("GET","/auth/me","/auth/me",200);
    const logged=await call("POST","/auth/login","/auth/login",201,{email:emails[0],password});
    cookie=logged.headers["set-cookie"].split(";")[0];
    await call("GET","/auth/me","/auth/me",401,undefined,{cookie:firstCookie});
    const extra=await call("POST","/auth/login","/auth/login",201,{email:emails[0],password},{cookie:null});
    const extraCookie=extra.headers["set-cookie"].split(";")[0];
    await call("GET","/auth/sessions","/auth/sessions",200);
    await call("GET","/auth/sessions","/auth/sessions?pagination=cursor&limit=1",200);
    const extraSession=await db.session.findUniqueOrThrow({where:{tokenHash:sessionDigest(extraCookie.slice(extraCookie.indexOf("=")+1))},select:{id:true}});
    await call("DELETE","/auth/sessions/{id}",`/auth/sessions/${extraSession.id}`,200,{});
    await call("GET","/auth/me","/auth/me",401,undefined,{cookie:extraCookie});
    for(const path of ["/health","/ready","/manufacturers","/android-bases","/devices"])
      await call("GET",path,path,200);
    await call("GET","/devices","/devices?manufacturerId=%00",400);
    await call("GET","/devices","/devices?q=%00",400);
    await call("GET","/devices","/devices?page=1.5",400);
    await db.project.create({data:{id:legacyId,slug:legacyId,name:"Synthetic contract fixture",kind:"ROM",description:"Test only",isDemo:true,releases:{create:{version:"test-only",channel:"STABLE",status:"PUBLISHED",changelog:"Synthetic test metadata"}}}});
    await call("GET","/legacy/catalog-projects","/legacy/catalog-projects",200);
    await call("GET","/legacy/catalog-projects/{slug}",`/legacy/catalog-projects/${legacyId}`,200);
    await call("GET","/legacy/catalog-projects/{slug}",`/legacy/catalog-projects/missing-${suffix}`,404);
    await call("GET","/legacy/catalog-projects/{slug}","/legacy/catalog-projects/%00",400);
    await call("GET","/admin/audit","/admin/audit",403);
    await db.user.update({where:{id:userId},data:{role:"ADMIN"}});
    await call("GET","/admin/audit","/admin/audit",200);
    await call("GET","/admin/audit","/admin/audit?pagination=cursor&limit=1",200);
    const created=await call("POST","/projects","/projects",201,defaultConfiguration);
    const id=created.json().id;
    await call("POST","/projects","/projects",201,{...defaultConfiguration,name:"Second synthetic draft"});
    await call("GET","/projects","/projects",200);
    const paginated=await call("GET","/projects","/projects?pagination=cursor&limit=1",200);
    await call("GET","/projects",`/projects?pagination=cursor&limit=1&cursor=${paginated.json().pagination.nextCursor}`,200);
    await call("GET","/projects","/projects?pagination=cursor&cursor=v1.invalid",400);
    await call("GET","/projects/{id}",`/projects/${id}`,200);
    await call("GET","/projects/{id}",`/projects/${id}`,404,undefined,{cookie:otherCookie});
    await call("GET","/projects/{id}","/projects/%00",400);
    await call("GET","/projects/{id}","/projects/%E0%A4%A",400);
    await call("PATCH","/projects/{id}",`/projects/${id}`,400,{configuration:{},revision:1});
    await call("PATCH","/projects/{id}",`/projects/${id}`,403,{configuration:defaultConfiguration,revision:1},{origin:"https://evil.example"});
    await call("PATCH","/projects/{id}",`/projects/${id}`,200,{configuration:defaultConfiguration,revision:1});
    await call("PATCH","/projects/{id}",`/projects/${id}`,409,{configuration:defaultConfiguration,revision:1});
    await call("GET","/projects/{id}/revisions",`/projects/${id}/revisions`,200);
    await call("GET","/projects/{id}/revisions",`/projects/${id}/revisions?pagination=cursor&limit=1`,200);
    await call("POST","/projects/{id}/validate",`/projects/${id}/validate`,201,{});
    await call("POST","/projects/{id}/builds",`/projects/${id}/builds`,503,{});
    // A stored-data fault remains generic500; list JSON stays raw.
    const captured=context.mock.method(console,"error",()=>{});
    await db.rOMProject.update({where:{id},data:{configuration:{internal:"c5-sensitive-storage-marker"}}});
    const internal=await call("GET","/projects/{id}",`/projects/${id}`,500);
    assert.equal(internal.body.includes("c5-sensitive-storage-marker"),false);
    assert.equal(captured.mock.calls.length,1);captured.mock.restore();
    await call("GET","/projects","/projects",200);
    // Isolated real-Redis IP admission: invalid bodies avoid KDF/account changes.
    for(const endpoint of ["login","register"]){
      for(let i=0;i<61;i++){
        const limited=await call("POST",`/auth/${endpoint}`,`/auth/${endpoint}`,i<60?400:429,{}, {cookie:null,ip:endpoint==="login"?"198.51.100.40":"198.51.100.41"});
        if(i===60)assert.ok(Number(limited.headers["retry-after"])>=1);
      }
    }
    const absent=`absent_${suffix}@example.com`;
    for(let i=0;i<6;i++){
      const limited=await call("POST","/auth/login","/auth/login",i<5?401:429,{email:absent,password},{cookie:null,ip:"198.51.100.42"});
      if(i===5)assert.ok(Number(limited.headers["retry-after"])>=1);
    }
    const limiter=app.get(RedisAuthLimiter);
    const fault=context.mock.method(limiter,"consume",async()=>{throw new Error("c5-private-redis-marker");});
    for(const endpoint of ["login","register"]){
      const failed=await call("POST",`/auth/${endpoint}`,`/auth/${endpoint}`,503,{}, {cookie:null,ip:"198.51.100.43"});
      assert.equal(failed.headers["retry-after"],"1");assert.equal(failed.body.includes("c5-private-redis-marker"),false);
    }
    fault.mock.restore();
    const readinessFault=context.mock.method(limiter,"check",async()=>{throw new Error("c5-private-readiness-marker");});
    await call("GET","/ready","/ready",503);readinessFault.mock.restore();
    await call("POST","/auth/logout","/auth/logout",201,{});
    await call("GET","/auth/me","/auth/me",401);

    await call("POST","/auth/logout","/auth/logout",201,"null");
    await call("POST","/auth/logout","/auth/logout",400);
    await call("POST","/auth/logout","/auth/logout",400,"{");
    await call("POST","/auth/logout","/auth/logout",413,"x".repeat(33000));
    await call("POST","/auth/logout","/auth/logout",415,"bytes",{contentType:"application/x-unsupported"});
    assert.deepEqual([...covered].sort(),expected);
  } finally {
    if(db){
      await db.release.deleteMany({where:{projectId:legacyId}});
      await db.project.deleteMany({where:{id:legacyId}});
      await db.auditLog.deleteMany({where:{actor:{email:{in:emails}}}});
      await db.user.deleteMany({where:{email:{in:emails}}});
    }
    await app.close();
    if(previous===undefined)delete process.env.RATE_LIMIT_NAMESPACE;else process.env.RATE_LIMIT_NAMESPACE=previous;
  }
});

test("D2 read-only real catalog assessment preserves unverified physical ROM status", async () => {
  const { assessCatalogDraft } = await import("../apps/api/src/build-targets/physical");
  const db = new PrismaClient();
  try {
    const variants = await db.deviceVariant.findMany({ where: { device: { isDemo: false, deprecatedAt: null } } });
    assert.ok(variants.length > 0);
    for (const variant of variants) {
      const result = await assessCatalogDraft(db, { ...defaultConfiguration, variantId: variant.id });
      assert.equal(result.identityState, "CATALOGED");
      assert.equal(result.sourceTargetVerified, false);
      assert.equal(result.buildEligible, false);
      assert.equal(result.flashEligible, false);
    }
    const unknown = await assessCatalogDraft(db, { ...defaultConfiguration, variantId: "d2-unknown-never-inserted" });
    assert.equal(unknown.identityState, "UNKNOWN");
  } finally { await db.$disconnect(); }
});
