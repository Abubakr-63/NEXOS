const { isIP } = require("node:net");

// host(inet) returns text, rather than Prisma's unsupported native inet value.
const TARGET_QUERY = `SELECT current_database()::text AS database,
  host(inet_server_addr()) AS address, inet_server_port()::integer AS port,
  pg_is_in_recovery() AS recovery`;
const refused = () => {
  throw new Error("Local migration target rejected");
};

function normalizeLoopback(raw) {
  if (typeof raw !== "string" || raw !== raw.trim() || /[%\[\]]/.test(raw))
    return refused();
  const parts = raw.split("/");
  if (parts.length > 2) return refused();
  const family = isIP(parts[0]);
  if (
    !family ||
    (parts.length === 2 && parts[1] !== (family === 4 ? "32" : "128"))
  )
    return refused();
  if (family === 4) return parts[0] === "127.0.0.1" ? parts[0] : refused();
  const canonical = new URL(`http://[${parts[0]}]/`).hostname;
  if (canonical === "[::1]") return "::1";
  if (canonical === "[::ffff:7f00:1]") return "127.0.0.1";
  return refused();
}

function assertLocalConnection(raw, environment) {
  if (
    environment !== "development" ||
    typeof raw !== "string" ||
    raw !== raw.trim()
  )
    return refused();
  // Inspect the literal authority too: URL alone canonicalizes ambiguous 127.1,
  // integer and hexadecimal hosts into an otherwise acceptable address.
  const authority = /^postgres(?:ql)?:\/\/([^/?#]+)\//i.exec(raw)?.[1];
  if (!authority) return refused();
  const endpoint = authority.slice(authority.lastIndexOf("@") + 1);
  const host = /^(\[[^\]]+\]|[^:]+):5433$/.exec(endpoint)?.[1];
  if (!host) return refused();
  const literal = host.startsWith("[") ? host.slice(1, -1) : host;
  if (literal.includes("/") || !isIP(literal)) return refused();
  const address = normalizeLoopback(literal);
  const url = new URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.port !== "5433" ||
    url.pathname !== "/nexos_development" ||
    url.hash
  )
    return refused();
  const params = [...url.searchParams];
  if (
    params.length &&
    !(
      params.length === 1 &&
      params[0][0] === "schema" &&
      params[0][1] === "public"
    )
  )
    return refused();
  return address;
}

function assertLocalMigrationTarget(connection, row, environment) {
  const configuredAddress = assertLocalConnection(connection, environment);
  if (
    !row ||
    row.database !== "nexos_development" ||
    row.port !== 5433 ||
    row.recovery !== false ||
    normalizeLoopback(row.address) !== configuredAddress
  )
    return refused();
  return Object.freeze({
    database: row.database,
    address: normalizeLoopback(row.address),
    port: row.port,
    recovery: false,
  });
}

module.exports = {
  TARGET_QUERY,
  normalizeLoopback,
  assertLocalConnection,
  assertLocalMigrationTarget,
};
