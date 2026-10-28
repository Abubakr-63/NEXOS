import { isIP } from "node:net";

export class StartupConfigurationError extends Error {}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function validateEnvironment() {
  const mode = process.env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(mode))
    throw new StartupConfigurationError("NODE_ENV must be development, test or production.");
  if (!process.env.DATABASE_URL)
    throw new StartupConfigurationError(
      "DATABASE_URL is missing. Configure the workspace .env or run pnpm db:local:start.",
    );
  try {
    const database = new URL(process.env.DATABASE_URL);
    if (
      !["postgres:", "postgresql:"].includes(database.protocol) ||
      !database.hostname ||
      !database.pathname ||
      database.pathname === "/"
    )
      throw new Error();
  } catch {
    throw new StartupConfigurationError(
      "DATABASE_URL must be a valid PostgreSQL URL. Its value is not logged.",
    );
  }
  const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  try {
    const parsed = new URL(origin);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password
    )
      throw new Error();
  } catch {
    throw new StartupConfigurationError(
      "WEB_ORIGIN must be the exact browser origin, without a path or trailing slash.",
    );
  }
  // Exact IPs only: no broad networks, hostnames, boolean trust or hop counts.
  const proxies = process.env.TRUSTED_PROXY_IPS?.trim();
  const trustedProxies = proxies ? proxies.split(",").map((ip) => ip.trim()) : [];
  if (trustedProxies.some((ip) => !isIP(ip) || ip === "0.0.0.0" || ip === "::"))
    throw new StartupConfigurationError("TRUSTED_PROXY_IPS must contain comma-separated exact proxy IP addresses.");
  if (mode === "production" && (!process.env.WEB_ORIGIN || !origin.startsWith("https://")))
    throw new StartupConfigurationError("Production requires an explicit HTTPS WEB_ORIGIN.");
  if (mode === "production" && trustedProxies.length === 0)
    throw new StartupConfigurationError("Production requires explicit TRUSTED_PROXY_IPS for the HTTPS-terminating proxy path.");
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new StartupConfigurationError(
      "PORT must be an integer between 1 and 65535.",
    );
  return { origin, port, trustProxy: trustedProxies.length ? trustedProxies : false as const };
}
