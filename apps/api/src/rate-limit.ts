import {
  Injectable,
  Inject,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  ThrottlerGuard,
  ThrottlerException,
  normalizeIp,
} from "@nestjs/throttler";
import Redis from "ioredis";
import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  redisSettings,
  accountProtectionSettings,
  StartupConfigurationError,
} from "./config";
import {
  ACCOUNT_LOGIN_POLICY,
  accountIdentity,
  accountLoginScript,
} from "./account-protection";

export const AUTH_LIMIT = {
  limit: 60,
  windowMs: 60000,
  blockMs: 60000,
} as const;
// One key, Redis clock, at most limit accepted hits plus one block marker.
// A denied request never extends the block or creates another member.
const script = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])
local untilTime = redis.call('ZSCORE', key, 'blocked')
if untilTime then
  if tonumber(untilTime) > now then
    return {0, 0, math.max(1, math.ceil((tonumber(untilTime)-now)/1000))}
  end
  redis.call('DEL', key)
end
redis.call('ZREMRANGEBYSCORE', key, '-inf', now-window)
local count = redis.call('ZCARD', key)
if count >= limit then
  redis.call('ZADD', key, now+block, 'blocked')
  redis.call('PEXPIRE', key, block)
  return {0, 0, math.max(1, math.ceil(block/1000))}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
local first = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
return {1, limit-count-1, math.max(1, math.ceil((tonumber(first[2])+window-now)/1000))}
`;

@Injectable()
export class RedisAuthLimiter implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly namespace: string;
  private readonly accountSecret: Buffer;
  constructor() {
    const settings = redisSettings();
    this.namespace = settings.namespace;
    this.accountSecret = accountProtectionSettings().secret;
    this.redis = new Redis(settings.url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      autoResendUnfulfilledCommands: false,
      connectTimeout: 1000,
      commandTimeout: 1000,
      retryStrategy: (attempt) => Math.min(attempt * 100, 1000),
    });
    // Never emit raw connection errors: they may include deployment credentials.
    this.redis.on("error", () => {});
  }
  async onModuleInit() {
    try {
      await this.redis.connect();
      await this.check();
    } catch {
      this.redis.disconnect();
      throw new StartupConfigurationError(
        "Authentication Redis startup check failed. Check REDIS_URL and Redis availability.",
      );
    }
  }
  onModuleDestroy() {
    this.redis.disconnect();
  }
  async check() {
    // Exercise actual script/write permissions, not just PING. Bounded probe key.
    await this.evaluate(`${this.namespace}:probe`, {
      limit: 1,
      windowMs: 1000,
      blockMs: 1000,
    });
    await this.evaluateAccount(
      `${this.namespace}:account:probe`,
      `${this.namespace}:account:probe:active`,
      {
        burst: 1,
        refillMs: 1000,
        ttlMs: 1000,
        cooldownMs: 500,
        recoveryMs: 100,
        maxAccounts: 1,
      },
    );
  }
  async consumeAccount(
    email: string,
    policy:
      | typeof ACCOUNT_LOGIN_POLICY
      | {
          burst: number;
          refillMs: number;
          ttlMs: number;
          cooldownMs: number;
          recoveryMs: number;
          maxAccounts: number;
        } = ACCOUNT_LOGIN_POLICY,
  ) {
    return this.evaluateAccount(
      `${this.namespace}:account:v1:${accountIdentity(email, this.accountSecret)}`,
      `${this.namespace}:account:v1:active`,
      policy,
    );
  }
  private async evaluateAccount(
    key: string,
    index: string,
    policy: {
      burst: number;
      refillMs: number;
      ttlMs: number;
      cooldownMs: number;
      recoveryMs: number;
      maxAccounts: number;
    },
  ) {
    const result = await this.redis.eval(
      accountLoginScript,
      2,
      key,
      index,
      policy.burst,
      policy.refillMs,
      policy.ttlMs,
      policy.cooldownMs,
      policy.recoveryMs,
      policy.maxAccounts,
    );
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      ![0, 1, 2].includes(result[0]) ||
      !Number.isSafeInteger(result[1]) ||
      result[1] < 0
    )
      throw new Error("Invalid account limiter result");
    return {
      allowed: result[0] === 1,
      capacityExceeded: result[0] === 2,
      retryAfter: result[1] as number,
    };
  }
  private async evaluate(
    key: string,
    policy: { limit: number; windowMs: number; blockMs: number },
  ) {
    const result = await this.redis.eval(
      script,
      1,
      key,
      policy.windowMs,
      policy.limit,
      policy.blockMs,
      randomUUID(),
    );
    if (
      !Array.isArray(result) ||
      result.length !== 3 ||
      result.some((value) => !Number.isSafeInteger(value)) ||
      ![0, 1].includes(result[0]) ||
      result[1] < 0 ||
      result[1] > policy.limit ||
      result[2] < 1
    )
      throw new Error("Invalid limiter result");
    return {
      allowed: result[0] === 1,
      remaining: result[1] as number,
      retryAfter: result[2] as number,
    };
  }
  async consume(
    action: "login" | "register",
    ip: string,
    policy: { limit: number; windowMs: number; blockMs: number } = AUTH_LIMIT,
  ) {
    if (!isIP(ip.split("%")[0])) throw new Error("Invalid client address");
    const identity = createHash("sha256").update(normalizeIp(ip)).digest("hex");
    return this.evaluate(`${this.namespace}:${action}:${identity}`, policy);
  }
}

@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(
    @Inject(RedisAuthLimiter) private readonly shared: RedisAuthLimiter,
    @Inject(ThrottlerGuard) private readonly local: ThrottlerGuard,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const route = req.routeOptions.url;
    const action =
      req.method === "POST" && route === "/api/v1/auth/login"
        ? "login"
        : req.method === "POST" && route === "/api/v1/auth/register"
          ? "register"
          : null;
    if (!action) return this.local.canActivate(context);
    let result;
    try {
      result = await this.shared.consume(action, req.ip);
    } catch {
      reply.header("Retry-After", 1);
      throw new ServiceUnavailableException(
        "Authentication temporarily unavailable. Try again later.",
      );
    }
    reply.header("X-RateLimit-Limit", AUTH_LIMIT.limit);
    reply.header("X-RateLimit-Remaining", result.remaining);
    reply.header("X-RateLimit-Reset", result.retryAfter);
    if (!result.allowed) {
      reply.header("Retry-After", result.retryAfter);
      throw new ThrottlerException();
    }
    return true;
  }
}
