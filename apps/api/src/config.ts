import { BlockList, isIP } from "node:net";

// On Render, the TLS-terminating proxy has a dynamic internal address.
// Trust only the immediate private-network hop, never a client-supplied chain.
const renderProxyAddresses = new BlockList();
renderProxyAddresses.addSubnet("10.0.0.0", 8, "ipv4");
renderProxyAddresses.addSubnet("172.16.0.0", 12, "ipv4");
renderProxyAddresses.addSubnet("192.168.0.0", 16, "ipv4");
renderProxyAddresses.addSubnet("100.64.0.0", 10, "ipv4");
renderProxyAddresses.addSubnet("127.0.0.0", 8, "ipv4");
renderProxyAddresses.addSubnet("fc00::", 7, "ipv6");
renderProxyAddresses.addSubnet("::1", 128, "ipv6");

export class StartupConfigurationError extends Error {}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function redisSettings() {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  try {
    const parsed = new URL(url);
    decodeURIComponent(parsed.username);
    decodeURIComponent(parsed.password);
    if (
      !["redis:", "rediss:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      (parsed.pathname !== "" &&
        parsed.pathname !== "/" &&
        !/^\/\d+$/.test(parsed.pathname)) ||
      parsed.search ||
      parsed.hash ||
      (process.env.NODE_ENV === "production" && !process.env.REDIS_URL)
    )
      throw new Error();
  } catch {
    throw new StartupConfigurationError(
      "REDIS_URL must be a valid redis/rediss URL and explicitly configured in production.",
    );
  }
  const namespace =
    process.env.RATE_LIMIT_NAMESPACE ?? "nexos:ratelimit:auth:v1";
  if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(namespace))
    throw new StartupConfigurationError(
      "RATE_LIMIT_NAMESPACE must be 1-80 letters, numbers, colons, underscores or hyphens.",
    );
  return { url, namespace };
}

export function accountProtectionSettings() {
  const key = process.env.AUTH_ACCOUNT_HMAC_KEY;
  if (!key || !/^[a-fA-F0-9]{64}$/.test(key))
    throw new StartupConfigurationError(
      "AUTH_ACCOUNT_HMAC_KEY must be a shared, randomly generated 32-byte hex secret for all API instances.",
    );
  return { secret: Buffer.from(key, "hex") };
}

export function validateEnvironment() {
  const mode = process.env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(mode))
    throw new StartupConfigurationError(
      "NODE_ENV must be development, test or production.",
    );
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
  const trustedProxies = proxies
    ? proxies.split(",").map((ip) => ip.trim())
    : [];
  if (trustedProxies.some((ip) => !isIP(ip) || ip === "0.0.0.0" || ip === "::"))
    throw new StartupConfigurationError(
      "TRUSTED_PROXY_IPS must contain comma-separated exact proxy IP addresses.",
    );
  if (
    mode === "production" &&
    (!process.env.WEB_ORIGIN || !origin.startsWith("https://"))
  )
    throw new StartupConfigurationError(
      "Production requires an explicit HTTPS WEB_ORIGIN.",
    );
  if (mode === "production" && trustedProxies.length === 0 && process.env.RENDER !== "true")
    throw new StartupConfigurationError(
      "Production requires explicit TRUSTED_PROXY_IPS for the HTTPS-terminating proxy path.",
    );
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new StartupConfigurationError(
      "PORT must be an integer between 1 and 65535.",
    );
  redisSettings();
  accountProtectionSettings();
  return {
    origin,
    port,
    trustProxy: trustedProxies.length
      ? trustedProxies
      : process.env.RENDER === "true" && mode === "production"
        ? ((address: string, hop: number) =>
            hop === 0 && isIP(address) !== 0 &&
            renderProxyAddresses.check(address, isIP(address) === 4 ? "ipv4" : "ipv6"))
        : (false as const),
  };
}
