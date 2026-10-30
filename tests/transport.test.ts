import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  validateEnvironment,
  sessionCookieOptions,
  StartupConfigurationError,
} from "../apps/api/src/config";
const requireApi = createRequire(resolve("apps/api/package.json"));
const fastify = requireApi("fastify");
const cookie = requireApi("@fastify/cookie");
const keys = [
  "NODE_ENV",
  "WEB_ORIGIN",
  "DATABASE_URL",
  "PORT",
  "TRUSTED_PROXY_IPS",
  "REDIS_URL",
  "RATE_LIMIT_NAMESPACE",
  "AUTH_ACCOUNT_HMAC_KEY",
] as const;
function environment() {
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  process.env.DATABASE_URL = "postgresql://localhost/test-only";
  process.env.AUTH_ACCOUNT_HMAC_KEY = "ab".repeat(32);
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
  delete process.env.RATE_LIMIT_NAMESPACE;
  process.env.NODE_ENV = "development";
  process.env.WEB_ORIGIN = "http://localhost:3000";
  process.env.PORT = "4000";
  delete process.env.TRUSTED_PROXY_IPS;
  return () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  };
}

test("production requires explicit HTTPS origin, valid mode and narrowly scoped proxy IPs", () => {
  const restore = environment();
  try {
    assert.equal(validateEnvironment().trustProxy, false);
    process.env.NODE_ENV = "prod";
    assert.throws(validateEnvironment, StartupConfigurationError);
    process.env.NODE_ENV = "production";
    assert.throws(validateEnvironment, /HTTPS WEB_ORIGIN/);
    delete process.env.WEB_ORIGIN;
    assert.throws(validateEnvironment, /HTTPS WEB_ORIGIN/);
    process.env.WEB_ORIGIN = "https://nexos.example";
    assert.throws(validateEnvironment, /TRUSTED_PROXY_IPS/);
    for (const value of [
      "true",
      "false",
      "1",
      "*",
      "0.0.0.0/0",
      "::/0",
      "127.0.0.0/8",
      "localhost",
      "0.0.0.0",
      "::",
      "192.0.2.10,",
      "192.0.2.10,invalid",
    ]) {
      process.env.TRUSTED_PROXY_IPS = value;
      assert.throws(validateEnvironment, StartupConfigurationError);
    }
    process.env.TRUSTED_PROXY_IPS = "192.0.2.10, 2001:db8::10";
    assert.deepEqual(validateEnvironment().trustProxy, [
      "192.0.2.10",
      "2001:db8::10",
    ]);
  } finally {
    restore();
  }
});

test("cookie creation and deletion share host-only HttpOnly/Lax/Path settings in both modes", async () => {
  const restore = environment();
  try {
    for (const mode of ["development", "production"]) {
      process.env.NODE_ENV = mode;
      const server = fastify();
      try {
        await server.register(cookie);
        server.get(
          "/set",
          (
            _req: unknown,
            reply: {
              setCookie: (
                name: string,
                value: string,
                options: unknown,
              ) => unknown;
            },
          ) => {
            reply.setCookie("romhub_session", "test-only-token", {
              ...sessionCookieOptions(),
              maxAge: 7 * 86400,
            });
            return { ok: true };
          },
        );
        server.get(
          "/clear",
          (
            _req: unknown,
            reply: { clearCookie: (name: string, options: unknown) => unknown },
          ) => {
            reply.clearCookie("romhub_session", sessionCookieOptions());
            return { ok: true };
          },
        );
        const set = (await server.inject({ url: "/set" })).headers[
          "set-cookie"
        ] as string;
        const clear = (await server.inject({ url: "/clear" })).headers[
          "set-cookie"
        ] as string;
        for (const header of [set, clear]) {
          assert.match(header, /HttpOnly/);
          assert.match(header, /SameSite=Lax/);
          assert.match(header, /Path=\//);
          assert.equal(header.includes("Secure"), mode === "production");
          assert.equal(/Domain=/i.test(header), false);
        }
        assert.match(set, /Max-Age=604800/);
        assert.match(clear, /Max-Age=0/);
        assert.match(clear, /Expires=Thu, 01 Jan 1970/);
      } finally {
        await server.close();
      }
    }
  } finally {
    restore();
  }
});

test("forwarded protocol, host and IP are ignored unless the socket peer is explicitly trusted", async () => {
  const restore = environment();
  try {
    for (const configured of [false, true]) {
      if (configured) process.env.TRUSTED_PROXY_IPS = "192.0.2.10";
      const config = validateEnvironment();
      const server = fastify({ trustProxy: config.trustProxy });
      try {
        server.get(
          "/probe",
          (req: { ip: string; protocol: string; hostname: string }) => ({
            ip: req.ip,
            protocol: req.protocol,
            hostname: req.hostname,
          }),
        );
        for (const peer of ["192.0.2.10", "192.0.2.11"]) {
          const response = await server.inject({
            url: "/probe",
            remoteAddress: peer,
            headers: {
              host: "internal.example",
              "x-forwarded-for": "198.51.100.7",
              "x-forwarded-proto": "https",
              "x-forwarded-host": "nexos.example",
              forwarded: "for=203.0.113.9;proto=http;host=spoof.example",
            },
          });
          assert.deepEqual(
            response.json(),
            configured && peer === "192.0.2.10"
              ? {
                  ip: "198.51.100.7",
                  protocol: "https",
                  hostname: "nexos.example",
                }
              : { ip: peer, protocol: "http", hostname: "internal.example" },
          );
        }
        // Stop the XFF walk at the first untrusted hop, rather than trusting a
        // forged leftmost address merely because the immediate peer is allowed.
        if (configured) {
          const chain = await server.inject({
            url: "/probe",
            remoteAddress: "192.0.2.10",
            headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.7" },
          });
          assert.equal(chain.json().ip, "198.51.100.7");
        }
      } finally {
        await server.close();
      }
    }
  } finally {
    restore();
  }
});
