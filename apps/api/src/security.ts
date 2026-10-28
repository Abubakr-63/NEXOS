import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  type ScryptOptions,
} from "node:crypto";
function derive(
  password: string,
  salt: string,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

// OWASP's 32 MiB scrypt profile. Never reinterpret an existing format's costs.
const currentPolicy = {
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
} as const;
const legacyPolicy = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
} as const;
const currentPrefix = "scrypt:v1:N=32768,r=8,p=3:";
const legacyFormat = /^scrypt:([0-9a-f]{32}):([0-9a-f]{128})$/;
const currentFormat =
  /^scrypt:v1:N=32768,r=8,p=3:([0-9a-f]{32}):([0-9a-f]{128})$/;

function parsePasswordHash(stored: string) {
  // Fixed allowlist: malformed/unknown versions or attacker-selected KDF costs
  // never reach scrypt. Hex decoding must not silently truncate malformed data.
  const current = currentFormat.exec(stored);
  if (current && current[0] === stored)
    return { salt: current[1], digest: current[2], legacy: false };
  const legacy = legacyFormat.exec(stored);
  if (legacy && legacy[0] === stored)
    return { salt: legacy[1], digest: legacy[2], legacy: true };
  return null;
}

// Public dummy record, not a credential. Unknown accounts pay the current KDF cost.
export const dummyPasswordHash = `${currentPrefix}${"0".repeat(32)}:${"0".repeat(128)}`;
export const sessionDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  // Salt remains the UTF-8 hex string used by the original implementation.
  const hash = await derive(password, salt, currentPolicy);
  return `${currentPrefix}${salt}:${hash.toString("hex")}`;
}

export function passwordNeedsRehash(stored: string) {
  return parsePasswordHash(stored)?.legacy === true;
}

export async function verifyPassword(password: string, stored: string) {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  const expected = Buffer.from(parsed.digest, "hex");
  const actual = await derive(
    password,
    parsed.salt,
    parsed.legacy ? legacyPolicy : currentPolicy,
  );
  return timingSafeEqual(actual, expected);
}
