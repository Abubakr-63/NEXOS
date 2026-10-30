import { createHmac } from "node:crypto";

// Count admissions, not post-verification failures: concurrent guesses cannot
// all pass a read/check before any of them records its result.
export const ACCOUNT_LOGIN_POLICY = {
  burst: 5,
  refillMs: 60000,
  ttlMs: 900000,
  cooldownMs: 25000,
  recoveryMs: 5000,
  maxAccounts: 10000,
} as const;

export function accountIdentity(email: string, secret: Buffer) {
  // Match loginSchema's existing lowercase transform; no provider-specific rules.
  return createHmac("sha256", secret)
    .update("nexos:login-account:v1\0")
    .update(email.toLowerCase())
    .digest("hex");
}

// Two keys, standalone Redis: one constant-size value per account and a bounded
// active-account index. All admission, capacity, expiry and cooldown decisions
// are made on the primary using its clock. Denials never extend cooldown/TTL.
export const accountLoginScript = `
local clock = redis.call('TIME')
local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
local key, active = KEYS[1], KEYS[2]
local burst, refill, ttl = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local cooldown, recovery, capacity = tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])
local raw = redis.call('GET', key)
local state = raw and cjson.decode(raw) or nil
local credit, last, nextTime, grace
if not state then
  redis.call('ZREMRANGEBYSCORE', active, '-inf', now)
  if redis.call('ZCARD', active) >= capacity then return {2, 1} end
  credit, last, nextTime, grace = burst*refill, now, 0, 0
else
  credit, last, nextTime, grace = tonumber(state[1]), tonumber(state[2]), tonumber(state[3]), tonumber(state[4])
  if not credit or not last or not nextTime or not grace then return redis.error_reply('invalid account limiter state') end
  credit = math.min(burst*refill, credit + math.max(0, now-last))
end
if grace <= now and credit < refill then
  if nextTime == 0 then
    nextTime = now + cooldown
    state[3] = nextTime
    redis.call('SET', key, cjson.encode(state), 'KEEPTTL')
  end
  if now < nextTime then
    return {0, math.max(1, math.ceil(math.min(nextTime-now, refill-credit)/1000))}
  end
  -- A time window, not a single raceable token: attackers cannot take the
  -- victim's only retry slot. This intentionally relaxes the aggregate cap.
  grace = now + recovery
  nextTime = grace + cooldown
end
credit = math.max(0, credit-refill)
-- SET and PX are one command: a later script error cannot leave a newly
-- created account value without expiry (Redis Lua errors do not roll back).
redis.call('SET', key, cjson.encode({credit, now, nextTime, grace}), 'PX', ttl)
redis.call('ZADD', active, now+ttl, key)
redis.call('PEXPIRE', active, ttl)
return {1, 0}
`;
