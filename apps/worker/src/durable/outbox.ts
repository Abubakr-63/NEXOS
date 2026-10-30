import { randomUUID } from "node:crypto";
import { type PrismaClient, type DurableBuildOutbox } from "@prisma/client";
import { databaseNow, transaction, lockedJob, D5 } from "./jobs";
import { HandoffError } from "../executor/attempt-store";

export type Delivery = {
  version: 1;
  kind: "ISOLATION_PREFLIGHT";
  jobId: string;
  generation: number;
};
export const deliveryId = (jobId: string, generation: number) =>
  `${jobId}-g${generation}`;
export interface DeliveryPort {
  add(id: string, message: Delivery): Promise<void>;
  state(id: string): Promise<string | null>;
}
export const backoffMs = (attempt: number) =>
  Math.min(30000, 250 * 2 ** Math.min(7, Math.max(0, attempt - 1)));
export class OutboxDispatcher {
  constructor(
    readonly db: PrismaClient,
    readonly delivery: DeliveryPort,
  ) {}
  async claim() {
    return transaction(this.db, async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "DurableBuildOutbox" WHERE ("state"='PENDING' AND "nextAttemptAt" <= clock_timestamp()) OR ("state"='DISPATCHING' AND "dispatchLeaseUntil" <= clock_timestamp()) ORDER BY "createdAt", "id" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows.length) return null;
      const row = await tx.durableBuildOutbox.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
      const now = await databaseNow(tx);
      if (row.attempts >= D5.maxDispatchAttempts) {
        await tx.durableBuildOutbox.update({
          where: { id: row.id },
          data: {
            state: "DEAD",
            deadAt: now,
            failureCode: "DELIVERY_EXHAUSTED",
            dispatchToken: null,
            dispatchLeaseUntil: null,
          },
        });
        await tx.durableBuildJob.updateMany({
          where: {
            id: row.jobId,
            state: "QUEUED",
            deliveryGeneration: row.generation,
          },
          data: {
            state: "FAILED",
            failureCode: "DELIVERY_EXHAUSTED",
            finishedAt: now,
          },
        });
        return null;
      }
      return tx.durableBuildOutbox.update({
        where: { id: row.id },
        data: {
          state: "DISPATCHING",
          dispatchToken: randomUUID(),
          dispatchLeaseUntil: new Date(now.getTime() + D5.dispatchLeaseMs),
          lastAttemptAt: now,
          attempts: { increment: 1 },
        },
      });
    });
  }
  async acknowledge(row: DurableBuildOutbox, sent: boolean) {
    return transaction(this.db, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DurableBuildOutbox" WHERE "id"=${row.id}::uuid FOR UPDATE`;
      const current = await tx.durableBuildOutbox.findUniqueOrThrow({
        where: { id: row.id },
      });
      const now = await databaseNow(tx);
      if (
        current.state !== "DISPATCHING" ||
        current.dispatchToken !== row.dispatchToken ||
        !current.dispatchLeaseUntil ||
        current.dispatchLeaseUntil <= now
      )
        return false;
      const dead = !sent && current.attempts >= D5.maxDispatchAttempts;
      await tx.durableBuildOutbox.update({
        where: { id: row.id },
        data: {
          state: sent ? "SENT" : dead ? "DEAD" : "PENDING",
          dispatchToken: null,
          dispatchLeaseUntil: null,
          sentAt: sent ? now : null,
          deadAt: dead ? now : null,
          failureCode: sent
            ? null
            : dead
              ? "DELIVERY_EXHAUSTED"
              : "REDIS_UNAVAILABLE",
          nextAttemptAt: new Date(now.getTime() + backoffMs(current.attempts)),
        },
      });
      if (dead)
        await tx.durableBuildJob.updateMany({
          where: {
            id: row.jobId,
            state: "QUEUED",
            deliveryGeneration: row.generation,
          },
          data: {
            state: "FAILED",
            failureCode: "DELIVERY_EXHAUSTED",
            finishedAt: now,
          },
        });
      return true;
    });
  }
  async dispatchOnce() {
    const row = await this.claim();
    if (!row) return false;
    // Payload is derived from committed identity; no stored/user shell or environment.
    try {
      await this.delivery.add(deliveryId(row.jobId, row.generation), {
        version: 1,
        kind: "ISOLATION_PREFLIGHT",
        jobId: row.jobId,
        generation: row.generation,
      });
    } catch {
      await this.acknowledge(row, false);
      return true;
    }
    await this.acknowledge(row, true);
    return true;
  }
  async repairDelivery(id: string) {
    const old = await this.db.durableBuildJob.findUnique({ where: { id } });
    if (!old || old.state !== "QUEUED") return false;
    const outbox = await this.db.durableBuildOutbox.findUnique({
      where: {
        jobId_generation: { jobId: id, generation: old.deliveryGeneration },
      },
    });
    if (outbox?.state !== "SENT") return false;
    let state: string | null;
    try {
      state = await this.delivery.state(deliveryId(id, old.deliveryGeneration));
    } catch {
      throw new HandoffError("DELIVERY_UNAVAILABLE");
    }
    if (state !== null && !["completed", "failed", "unknown"].includes(state))
      return false;
    return transaction(this.db, async (tx) => {
      const job = await lockedJob(tx, id);
      if (
        job.state !== "QUEUED" ||
        job.deliveryGeneration !== old.deliveryGeneration
      )
        return false;
      const now = await databaseNow(tx);
      if (job.deliveryGeneration >= D5.maxGenerations) {
        await tx.durableBuildJob.update({
          where: { id },
          data: {
            state: "FAILED",
            failureCode: "DELIVERY_EXHAUSTED",
            finishedAt: now,
          },
        });
        return false;
      }
      await tx.durableBuildJob.update({
        where: { id },
        data: { deliveryGeneration: { increment: 1 } },
      });
      await tx.durableBuildOutbox.create({
        data: { jobId: id, generation: job.deliveryGeneration + 1 },
      });
      return true;
    });
  }
  async monitor() {
    const now = await databaseNow(this.db);
    const [jobs, outbox, oldest, expiredDispatches, expiredAttempts, dead] =
      await Promise.all([
        this.db.durableBuildJob.groupBy({ by: ["state"], _count: true }),
        this.db.durableBuildOutbox.groupBy({ by: ["state"], _count: true }),
        this.db.durableBuildOutbox.findFirst({
          where: { state: { in: ["PENDING", "DISPATCHING"] } },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
        this.db.durableBuildOutbox.count({
          where: { state: "DISPATCHING", dispatchLeaseUntil: { lte: now } },
        }),
        this.db.durableBuildAttempt.count({
          where: {
            state: { in: ["PREPARING", "RUNNING"] },
            leaseUntil: { lte: now },
          },
        }),
        this.db.durableBuildOutbox.findMany({
          where: { state: "DEAD" },
          take: 20,
          orderBy: { deadAt: "asc" },
          select: { id: true, jobId: true, failureCode: true },
        }),
      ]);
    return {
      jobs,
      outbox,
      oldestPendingAt: oldest?.createdAt ?? null,
      expiredDispatches,
      expiredAttempts,
      dead,
    };
  }
}
