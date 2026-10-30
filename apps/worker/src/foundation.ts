import { createHash } from "node:crypto";
import { isIP } from "node:net";
import {
  Queue,
  Worker,
  UnrecoverableError,
  type ConnectionOptions,
} from "bullmq";
import {
  foundationJobSchema,
  probeResultSchema,
  type FoundationJob,
  type ProbeState,
} from "@rom-hub/contracts";

export const QUEUE_NAME = "romhub-foundation";
export const CAPACITY = 16;
export const CONCURRENCY = 2;
const testPrefix = /^nexos-test-d3-[a-f0-9]{16}$/;
export class ProbeAccessError extends Error {
  constructor() {
    super("Probe not found");
  }
}
export class ProbeCapacityError extends Error {
  constructor() {
    super("Probe capacity exhausted");
  }
}
export class ProbeUnavailableError extends Error {
  constructor() {
    super("Probe service unavailable");
  }
}

export function redisConnection(raw: string, worker = false) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid worker Redis configuration");
  }
  if (
    !["redis:", "rediss:"].includes(url.protocol) ||
    url.search ||
    url.hash ||
    !/^\/(?:\d+)?$/.test(url.pathname || "/")
  )
    throw new Error("Invalid worker Redis configuration");
  const db = Number(url.pathname.slice(1) || 0);
  if (!Number.isSafeInteger(db) || db < 0 || db > 15)
    throw new Error("Invalid worker Redis database");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return {
    host,
    port: Number(url.port || 6379),
    db,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    retryStrategy: (attempt: number) => Math.min(1000, attempt * 50),
    connectTimeout: 2000,
    commandTimeout: worker ? undefined : 2000,
    ...(url.protocol === "rediss:"
      ? {
          tls: {
            rejectUnauthorized: true,
            ...(isIP(host) ? {} : { servername: host }),
          },
        }
      : {}),
  } satisfies ConnectionOptions;
}
async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProbeUnavailableError()), 3000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function waitForQueue(queue: Queue) {
  const client = await bounded(queue.client);
  if (client.status === "ready") return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      client.off("ready", ready);
      client.off("end", end);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const end = () => {
      cleanup();
      reject(new ProbeUnavailableError());
    };
    const timer = setTimeout(end, 3000);
    client.once("ready", ready);
    client.once("end", end);
    if (client.status === "ready") ready();
  });
}
async function closeQueue(queue: Queue) {
  const client = await bounded(queue.client).catch(() => undefined);
  try {
    await queue.close();
  } finally {
    client?.disconnect();
  }
}
function requireTest(prefix: string) {
  if (process.env.NODE_ENV !== "test" || !testPrefix.test(prefix))
    throw new Error("Isolated test environment required");
}
function slotStart(payload: FoundationJob) {
  return (
    createHash("sha256").update(payload.requestId).digest().readUInt32BE(0) %
    CAPACITY
  );
}
const cancelScript = `
local raw = redis.call('HGET', KEYS[1], 'data')
if not raw then return -1 end
local ok, data = pcall(cjson.decode, raw)
if not ok or data.requestId ~= ARGV[2] or data.ownerId ~= ARGV[3] then return -1 end
if redis.call('ZSCORE', KEYS[2], ARGV[1]) or redis.call('ZSCORE', KEYS[3], ARGV[1]) then return 0 end
redis.call('HSET', KEYS[4], ARGV[1], ARGV[2])
return 1
`;

/** No public producer. Fixed retained slots impose a hard bound without a check/add race. */
export function createTestProbeController(rawRedis: string, prefix: string) {
  requireTest(prefix);
  const queue = new Queue<FoundationJob>(QUEUE_NAME, {
    connection: redisConnection(rawRedis),
    prefix,
    streams: { events: { maxLen: 128 } },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 100 },
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
  // Queue error events must never print connection strings or job data.
  queue.on("error", () => {});
  const cancellationKey = queue.toKey("d3-cancellations");
  async function owned(id: string, requestId: string, ownerId: string) {
    if (!/^probe-(?:[0-9]|1[0-5])$/.test(id)) throw new ProbeAccessError();
    const job = await queue.getJob(id);
    if (
      !job ||
      job.data.requestId !== requestId ||
      job.data.ownerId !== ownerId
    )
      throw new ProbeAccessError();
    return job;
  }
  return {
    queue,
    async ready() {
      try {
        await waitForQueue(queue);
        await queue.setGlobalConcurrency(CONCURRENCY);
      } catch {
        throw new ProbeUnavailableError();
      }
    },
    async submit(raw: unknown) {
      const payload = foundationJobSchema.parse(raw);
      try {
        for (let offset = 0; offset < CAPACITY; offset++) {
          const id = `probe-${(slotStart(payload) + offset) % CAPACITY}`;
          await queue.add("healthcheck", payload, { jobId: id });
          // BullMQ add returns the submitted data even for an existing ID: read authoritative data.
          const actual = await queue.getJob(id);
          if (!actual) throw new ProbeUnavailableError();
          if (
            actual.data.requestId === payload.requestId &&
            actual.data.ownerId === payload.ownerId
          )
            return { id, requestId: payload.requestId };
          if (actual.data.requestId === payload.requestId)
            throw new ProbeAccessError();
        }
        throw new ProbeCapacityError();
      } catch (error) {
        if (
          error instanceof ProbeAccessError ||
          error instanceof ProbeCapacityError
        )
          throw error;
        throw new ProbeUnavailableError();
      }
    },
    async status(id: string, requestId: string, ownerId: string) {
      try {
        const job = await owned(id, requestId, ownerId);
        const canceled =
          (await (await queue.client).hget(cancellationKey, id)) === requestId;
        const raw = await job.getState();
        let state: ProbeState;
        if (raw === "completed") {
          const result = probeResultSchema.safeParse(job.returnvalue);
          if (!result.success) throw new ProbeUnavailableError();
          state =
            canceled || result.data.status === "canceled"
              ? "canceled"
              : "completed";
        } else if (raw === "failed") state = "failed";
        else if (raw === "active") state = "running";
        else if (
          ["waiting", "delayed", "prioritized", "waiting-children"].includes(
            raw,
          )
        )
          state = "queued";
        else throw new ProbeUnavailableError();
        return {
          kind: "CONNECTIVITY_PROBE" as const,
          compiled: false as const,
          state,
          cancelRequested: canceled,
          submittedAt: job.timestamp,
          startedAt: job.processedOn ?? null,
          finishedAt: job.finishedOn ?? null,
          attemptsMade: job.attemptsMade,
        };
      } catch (error) {
        if (error instanceof ProbeAccessError) throw error;
        throw new ProbeUnavailableError();
      }
    },
    async cancel(id: string, requestId: string, ownerId: string) {
      try {
        await owned(id, requestId, ownerId);
        const client = await queue.client;
        client.defineCommand("nexosD3Cancel", {
          numberOfKeys: 4,
          lua: cancelScript,
        });
        const value = Number(
          await client.runCommand("nexosD3Cancel", [
            queue.toKey(id),
            queue.toKey("completed"),
            queue.toKey("failed"),
            cancellationKey,
            id,
            requestId,
            ownerId,
          ]),
        );
        if (value < 0) throw new ProbeAccessError();
        return { accepted: value === 1 };
      } catch (error) {
        if (error instanceof ProbeAccessError) throw error;
        throw new ProbeUnavailableError();
      }
    },
    async close() {
      await closeQueue(queue);
    },
  };
}

export function createFoundationWorker(
  rawRedis: string,
  options: {
    prefix?: string;
    log?: (record: { event: string }) => void;
    onFatal?: () => void;
    testHooks?: {
      beforeProbe?: (payload: FoundationJob) => Promise<void>;
      lockDuration?: number;
      stalledInterval?: number;
    };
  } = {},
) {
  if (options.testHooks) requireTest(options.prefix ?? "");
  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection(rawRedis),
    prefix: options.prefix,
    streams: { events: { maxLen: 128 } },
  });
  queue.on("error", () => {});
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const parsed = foundationJobSchema.safeParse(job.data);
      if (
        job.name !== "healthcheck" ||
        !parsed.success ||
        !/^probe-(?:[0-9]|1[0-5])$/.test(job.id ?? "")
      )
        throw new UnrecoverableError("Unsupported foundation job");
      const canceled = async () =>
        (await (
          await queue.client
        ).hget(queue.toKey("d3-cancellations"), job.id!)) ===
        parsed.data.requestId;
      try {
        if (await canceled())
          return probeResultSchema.parse({
            kind: "CONNECTIVITY_PROBE",
            compiled: false,
            status: "canceled",
          });
        await options.testHooks?.beforeProbe?.(parsed.data);
        await (await queue.client).hget(queue.toKey("meta"), "version");
        return probeResultSchema.parse({
          kind: "CONNECTIVITY_PROBE",
          compiled: false,
          status: (await canceled()) ? "canceled" : "checked",
        });
      } catch {
        throw new Error("Foundation probe unavailable");
      }
    },
    {
      connection: redisConnection(rawRedis, true),
      prefix: options.prefix,
      concurrency: CONCURRENCY,
      autorun: false,
      maxStalledCount: 1,
      lockDuration: options.testHooks?.lockDuration ?? 30000,
      stalledInterval: options.testHooks?.stalledInterval ?? 30000,
    },
  );
  worker.on("error", () => options.log?.({ event: "worker.error" }));
  worker.on("failed", () => options.log?.({ event: "probe.failed" }));
  worker.on("completed", () => options.log?.({ event: "probe.acknowledged" }));
  let closing: Promise<void> | undefined;
  return {
    worker,
    async ready() {
      if (closing) throw new ProbeUnavailableError();
      await waitForQueue(queue);
      await queue.setGlobalConcurrency(CONCURRENCY);
      await worker.waitUntilReady();
      if (closing) throw new ProbeUnavailableError();
      if (!worker.isRunning()) {
        const stopped = () => {
          if (closing) return;
          if (options.onFatal) options.onFatal();
          else options.log?.({ event: "worker.run_failed" });
        };
        void worker.run().then(stopped, stopped);
      }
    },
    close() {
      return (closing ??= (async () => {
        try {
          await worker.close();
        } finally {
          await closeQueue(queue);
        }
      })());
    },
  };
}
