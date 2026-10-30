import { Queue, Worker, UnrecoverableError } from "bullmq";
import { randomUUID } from "node:crypto";
import { redisConnection } from "../foundation";
import { runPreflight, type PreflightTransport } from "../executor/coordinator";
import { HandoffError } from "../executor/attempt-store";
import { DurableJobs } from "./jobs";
import { type Delivery, type DeliveryPort, deliveryId } from "./outbox";
import { recoverPreflight } from "../executor/coordinator";
import { databaseNow } from "./jobs";

export const DURABLE_QUEUE = "romhub-durable-preflight";
export function parseDelivery(raw: unknown): Delivery {
  if (
    !raw ||
    typeof raw !== "object" ||
    Object.keys(raw).sort().join() !== "generation,jobId,kind,version"
  )
    throw new HandoffError("INVALID_DELIVERY");
  const p = raw as Delivery;
  if (
    p.version !== 1 ||
    p.kind !== "ISOLATION_PREFLIGHT" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      p.jobId,
    ) ||
    !Number.isInteger(p.generation) ||
    p.generation < 0 ||
    p.generation > 8
  )
    throw new HandoffError("INVALID_DELIVERY");
  return p;
}
export function createDurableQueue(redis: string, prefix: string) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(prefix))
    throw new HandoffError("INVALID_NAMESPACE");
  const queue = new Queue(DURABLE_QUEUE, {
    prefix,
    connection: redisConnection(redis),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 500 },
      removeOnComplete: false,
      removeOnFail: false,
    },
    streams: { events: { maxLen: 128 } },
  });
  queue.on("error", () => {});
  const port: DeliveryPort = {
    async add(id, raw) {
      const message = parseDelivery(raw);
      await queue.add("preflight", message, { jobId: id });
    },
    async state(id) {
      const job = await queue.getJob(id);
      return job ? await job.getState() : null;
    },
  };
  return {
    queue,
    port,
    redis,
    prefix,
    async ready() {
      await queue.waitUntilReady();
      await queue.setGlobalConcurrency(1);
    },
    async close() {
      const client = await queue.client;
      try {
        await queue.close();
      } catch {
        // QUIT can fail during an outage; disconnect still releases the client.
      } finally {
        client.disconnect();
      }
    },
  };
}
/** Explicit service factory only: no new entrypoint/production activation. */
export function createDurableWorker(
  broker: ReturnType<typeof createDurableQueue>,
  jobs: DurableJobs,
  transport: PreflightTransport,
  log: (record: { event: string }) => void = () => {},
  onFatal?: () => void,
  testHooks?: { lockDuration: number; stalledInterval: number },
) {
  if (
    testHooks &&
    (process.env.NODE_ENV !== "test" ||
      !/^nexos-d5-test-[a-f0-9]{16}$/.test(broker.prefix) ||
      !/^\/nexos_d5_test_[a-f0-9]{8}$/.test(
        new URL(process.env.DATABASE_URL ?? "invalid:").pathname,
      ) ||
      Object.keys(testHooks).sort().join() !== "lockDuration,stalledInterval" ||
      ![testHooks.lockDuration, testHooks.stalledInterval].every(
        (value) => Number.isInteger(value) && value >= 250 && value <= 30000,
      ))
  )
    throw new HandoffError("TEST_ISOLATION_REQUIRED");
  const workerId = `durable-worker-${randomUUID()}`;
  const worker = new Worker(
    DURABLE_QUEUE,
    async (delivery) => {
      let message: Delivery;
      try {
        message = parseDelivery(delivery.data);
        if (
          delivery.name !== "preflight" ||
          delivery.id !== deliveryId(message.jobId, message.generation) ||
          (delivery.opts.attempts ?? 1) > 3
        )
          throw new Error();
      } catch {
        throw new UnrecoverableError("Unsupported durable delivery");
      }
      try {
        const job = await jobs.db.durableBuildJob.findUnique({
          where: { id: message.jobId },
        });
        if (
          !job ||
          job.state !== "QUEUED" ||
          job.deliveryGeneration !== message.generation
        )
          return { compiled: false, ignored: true };
        return await runPreflight(
          jobs.authority(job.id, message.generation, workerId),
          { slot: 0, requestId: job.id },
          transport,
        );
      } catch (error) {
        if (error instanceof HandoffError && error.code === "NOT_QUEUED")
          return { compiled: false, ignored: true };
        throw new Error("Durable delivery unavailable");
      }
    },
    {
      connection: redisConnection(broker.redis, true),
      prefix: broker.prefix,
      autorun: false,
      concurrency: 1,
      maxStalledCount: 1,
      lockDuration: testHooks?.lockDuration ?? 30000,
      stalledInterval: testHooks?.stalledInterval ?? 30000,
    },
  );
  worker.on("error", () => log({ event: "durable.worker_error" }));
  worker.on("failed", () => log({ event: "durable.delivery_failed" }));
  let closing: Promise<void> | undefined;
  return {
    worker,
    async ready() {
      try {
        await Promise.all([
          jobs.db.durableBuildJob.findFirst({ select: { id: true } }),
          jobs.db.durableBuildAttempt.findFirst({ select: { id: true } }),
          jobs.db.durableBuildOutbox.findFirst({ select: { id: true } }),
        ]);
      } catch {
        throw new HandoffError("DATABASE_UNAVAILABLE");
      }
      await broker.ready();
      await worker.waitUntilReady();
      if (closing) throw new HandoffError("CLOSING");
      if (!worker.isRunning()) void worker.run().then(stopped, stopped);
      function stopped() {
        if (!closing) {
          if (onFatal) onFatal();
          else log({ event: "durable.worker_stopped" });
        }
      }
    },
    close() {
      return (closing ??= worker.close());
    },
  };
}

export async function recoverExpiredJobs(
  jobs: DurableJobs,
  transport: PreflightTransport,
  limit = 4,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 16)
    throw new HandoffError("INVALID_LIMITS");
  const now = await databaseNow(jobs.db);
  const rows = await jobs.db.durableBuildJob.findMany({
    where: {
      OR: [
        { state: "RECOVERY_REQUIRED" },
        {
          state: { in: ["PREPARING", "RUNNING"] },
          currentAttempt: { is: { leaseUntil: { lte: now } } },
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  let recovered = 0;
  for (const row of rows) {
    try {
      await recoverPreflight(
        jobs.authority(row.id, row.deliveryGeneration, "durable-reconciler"),
        { slot: 0, requestId: row.id },
        transport,
      );
      recovered++;
    } catch {
      /* Reservation remains held; monitoring exposes the unrecovered record. */
    }
  }
  return { inspected: rows.length, recovered };
}
