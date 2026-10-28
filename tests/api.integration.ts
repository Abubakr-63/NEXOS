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
      const stored = await db.session.findFirst({ where: { userId: user.id } });
      assert.equal(stored.tokenHash.length, 64);
      assert.notEqual(stored.tokenHash, cookie.split("=")[1]);
      const second = await call("auth/register", "POST", {
        email: emails[1],
        password: "integration-password-456",
        username: `other_${suffix}`,
      });
      const secondCookie = second.headers.get("set-cookie")!.split(";")[0];
      const created = await call(
        "projects",
        "POST",
        defaultConfiguration,
        cookie,
      );
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
      const changed = { ...defaultConfiguration, name: "Persistent ROM" };
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
      const deviceCatalog = await (await call("devices")).json();
      assert.ok(Array.isArray(deviceCatalog.items));
      const docs = await fetch("http://localhost:4101/api/docs-json");
      assert.equal(docs.status, 200);
    } finally {
      child.kill("SIGTERM");
      await db.auditLog.deleteMany({
        where: { actor: { email: { in: emails } } },
      });
      await db.user.deleteMany({ where: { email: { in: emails } } });
      await db.$disconnect();
    }
  },
);
