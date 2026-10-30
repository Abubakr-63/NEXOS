import { createHash, randomUUID } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  type DurableBuildJob,
  type DurableBuildAttempt,
} from "@prisma/client";
export { PrismaClient };
import { romConfigurationSchema } from "@rom-hub/contracts";
import {
  CUTTLEFISH,
  targetDigest,
  LIMITS,
  progressStages,
  type Progress,
} from "../executor/policy";
import {
  HandoffError,
  type CheckRecord,
  type Grant,
} from "../executor/attempt-store";
import type { ExecutionAuthority } from "../executor/coordinator";

export const D5 = Object.freeze({
  maxDispatchAttempts: 8,
  maxGenerations: 8,
  dispatchLeaseMs: 5000,
  maxActive: 16,
  maxOwnerActive: 4,
});
const active = ["PREPARING", "RUNNING"] as const;
const terminal = ["CHECKED", "FAILED", "CANCELLED"] as const;
type Tx = Prisma.TransactionClient;
type Row = DurableBuildJob & { currentAttempt: DurableBuildAttempt | null };
type Proof = {
  kind: "ISOLATION_PREFLIGHT";
  eligible: true;
  configurationDigest: string;
  targetDigest: string;
  evidenceDigest: string;
  validUntil: Date;
};
export type ReadinessPolicy = (input: {
  targetId: string;
  configurationDigest: string;
  configuration: unknown;
  now: Date;
}) => Proof | null;
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const uuid = (id: string) => {
  if (
    typeof id !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      id,
    )
  )
    throw new HandoffError("INVALID_ID");
  return id;
};
const identity = (id: string) => {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new HandoffError("INVALID_ID");
  return id;
};
export async function databaseNow(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}
async function globalLock(tx: Tx) {
  await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(45105001)`;
}
export async function lockedJob(tx: Tx, id: string): Promise<Row> {
  uuid(id);
  await tx.$queryRaw`SELECT "id" FROM "DurableBuildJob" WHERE "id"=${id}::uuid FOR UPDATE`;
  const job = await tx.durableBuildJob.findUnique({
    where: { id },
    include: { currentAttempt: true },
  });
  if (!job) throw new HandoffError("NOT_FOUND");
  return job;
}
export async function transaction<T>(
  db: PrismaClient,
  operation: (tx: Tx) => Promise<T>,
): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 5000,
      });
    } catch (error) {
      if (
        n < 3 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      ) {
        await new Promise((yes) => setTimeout(yes, 20 * (n + 1)));
        continue;
      }
      if (error instanceof HandoffError) throw error;
      throw new HandoffError("DATABASE_UNAVAILABLE");
    }
  }
}
function view(job: Row): CheckRecord {
  return {
    slot: 0,
    requestId: job.id,
    ownerId: job.ownerId,
    revisionId: job.revisionId,
    digest: job.requestDigest,
    targetDigest: job.targetDigest,
    state: job.state,
    attemptId: job.currentAttemptId,
    fence: job.fence,
    attempts: job.attemptCount,
    leaseUntil: job.currentAttempt?.leaseUntil.getTime() ?? 0,
    deadline: job.currentAttempt?.deadline.getTime() ?? 0,
    cancelRequested: !!job.cancelRequestedAt,
    stage: job.stage,
    failure: job.failureCode,
    compiled: false,
  };
}
async function validGrant(tx: Tx, grant: Grant, workerId: string) {
  const job = await lockedJob(tx, grant.requestId);
  const now = await databaseNow(tx);
  if (
    !active.includes(job.state as (typeof active)[number]) ||
    job.currentAttemptId !== grant.attemptId ||
    job.fence !== grant.fence ||
    !job.currentAttempt ||
    job.currentAttempt.jobId !== job.id ||
    job.currentAttempt.fence !== job.fence ||
    job.currentAttempt.number !== job.attemptCount ||
    !active.includes(job.currentAttempt.state as (typeof active)[number]) ||
    job.currentAttempt.workerId !== workerId ||
    job.currentAttempt.leaseUntil <= now
  )
    throw new HandoffError("FENCED");
  return { job, now, attempt: job.currentAttempt };
}
export class DurableJobs {
  constructor(
    readonly db: PrismaClient,
    private readonly readiness: ReadinessPolicy = () => null,
    private readonly hooks?: { afterJobCreated?: () => Promise<void> },
  ) {
    if (
      hooks &&
      (process.env.NODE_ENV !== "test" ||
        !/^\/nexos_d5_test_[a-f0-9]{8}$/.test(
          new URL(process.env.DATABASE_URL ?? "invalid:").pathname,
        ))
    )
      throw new HandoffError("TEST_ISOLATION_REQUIRED");
  }
  async admit(actorId: string, raw: unknown) {
    identity(actorId);
    if (
      !raw ||
      typeof raw !== "object" ||
      Object.keys(raw).sort().join() !==
        "idempotencyKey,projectId,revisionId,targetId"
    )
      throw new HandoffError("INVALID_REQUEST");
    const input = raw as {
      projectId: string;
      revisionId: string;
      targetId: string;
      idempotencyKey: string;
    };
    identity(input.projectId);
    identity(input.revisionId);
    if (
      input.targetId !== CUTTLEFISH.candidateId ||
      typeof input.idempotencyKey !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(input.idempotencyKey)
    )
      throw new HandoffError("INVALID_REQUEST");
    return transaction(this.db, async (tx) => {
      await globalLock(tx);
      const revision = await tx.configurationRevision.findFirst({
        where: {
          id: input.revisionId,
          projectId: input.projectId,
          project: { ownerId: actorId },
        },
      });
      if (!revision) throw new HandoffError("NOT_FOUND");
      let configuration: ReturnType<typeof romConfigurationSchema.parse>;
      try {
        configuration = romConfigurationSchema.parse(revision.configuration);
      } catch {
        throw new HandoffError("INVALID_CONFIGURATION");
      }
      const configurationDigest = digest(configuration);
      const requestDigest = digest([
        input.projectId,
        input.revisionId,
        input.targetId,
        configurationDigest,
      ]);
      const old = await tx.durableBuildJob.findUnique({
        where: {
          ownerId_idempotencyKey: {
            ownerId: actorId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (old) {
        if (old.requestDigest !== requestDigest)
          throw new HandoffError("CONFLICT");
        return old;
      }
      const now = await databaseNow(tx);
      const proof = this.readiness({
        targetId: input.targetId,
        configurationDigest,
        configuration,
        now,
      });
      if (
        !proof ||
        proof.kind !== "ISOLATION_PREFLIGHT" ||
        proof.eligible !== true ||
        proof.configurationDigest !== configurationDigest ||
        proof.targetDigest !== targetDigest(CUTTLEFISH) ||
        !/^[a-f0-9]{64}$/.test(proof.evidenceDigest) ||
        !(proof.validUntil instanceof Date) ||
        !Number.isFinite(proof.validUntil.getTime()) ||
        proof.validUntil <= now ||
        proof.validUntil.getTime() > now.getTime() + 86400000
      )
        throw new HandoffError("BUILD_UNAVAILABLE");
      const states = [
        "QUEUED",
        "PREPARING",
        "RUNNING",
        "RECOVERY_REQUIRED",
      ] as const;
      if (
        (await tx.durableBuildJob.count({
          where: { state: { in: [...states] } },
        })) >= D5.maxActive ||
        (await tx.durableBuildJob.count({
          where: { ownerId: actorId, state: { in: [...states] } },
        })) >= D5.maxOwnerActive
      )
        throw new HandoffError("CAPACITY");
      const job = await tx.durableBuildJob.create({
        data: {
          ownerId: actorId,
          projectId: input.projectId,
          revisionId: input.revisionId,
          targetId: input.targetId,
          idempotencyKey: input.idempotencyKey,
          requestDigest,
          configurationDigest,
          targetDigest: proof.targetDigest,
          readinessDigest: proof.evidenceDigest,
          readinessValidUntil: proof.validUntil,
          configuration: configuration as Prisma.InputJsonValue,
        },
      });
      await this.hooks?.afterJobCreated?.();
      await tx.durableBuildOutbox.create({
        data: { jobId: job.id, generation: 0 },
      });
      await tx.auditLog.create({
        data: { actorId, action: "build.preflight.admitted", targetId: job.id },
      });
      return job;
    });
  }
  async owned(actorId: string, id: string) {
    identity(actorId);
    uuid(id);
    const job = await this.db.durableBuildJob.findFirst({
      where: { id, ownerId: actorId },
      include: { currentAttempt: true },
    });
    if (!job) throw new HandoffError("NOT_FOUND");
    return job;
  }
  async cancel(actorId: string, id: string) {
    identity(actorId);
    return transaction(this.db, async (tx) => {
      const job = await lockedJob(tx, id);
      if (job.ownerId !== actorId) throw new HandoffError("NOT_FOUND");
      if (terminal.includes(job.state as (typeof terminal)[number])) return job;
      const now = await databaseNow(tx);
      return tx.durableBuildJob.update({
        where: { id },
        data: {
          cancelRequestedAt: job.cancelRequestedAt ?? now,
          ...(job.state === "QUEUED"
            ? { state: "CANCELLED", finishedAt: now }
            : {}),
        },
      });
    });
  }
  authority(
    id: string,
    generation: number,
    workerId: string,
  ): ExecutionAuthority {
    uuid(id);
    identity(workerId);
    const scope = (grant: Grant) => {
      if (grant.requestId !== id || grant.slot !== 0)
        throw new HandoffError("FENCED");
    };
    const mutate = async (
      grant: Grant,
      operation: (
        tx: Tx,
        row: Awaited<ReturnType<typeof validGrant>>,
      ) => Promise<void>,
    ) => {
      scope(grant);
      return transaction(this.db, async (tx) => {
        const row = await validGrant(tx, grant, workerId);
        await operation(tx, row);
        return view(await lockedJob(tx, id));
      });
    };
    return {
      timings: LIMITS,
      claim: async () => {
        const claimed = await transaction(this.db, async (tx) => {
          await globalLock(tx);
          const job = await lockedJob(tx, id);
          const now = await databaseNow(tx);
          if (job.state !== "QUEUED" || job.deliveryGeneration !== generation)
            throw new HandoffError("NOT_QUEUED");
          if (job.cancelRequestedAt) throw new HandoffError("NOT_QUEUED");
          let invalid: string | null =
            job.readinessValidUntil <= now ? "READINESS_EXPIRED" : null;
          try {
            if (
              job.kind !== "ISOLATION_PREFLIGHT" ||
              job.compiled ||
              job.targetId !== CUTTLEFISH.candidateId ||
              job.targetDigest !== targetDigest(CUTTLEFISH) ||
              digest(romConfigurationSchema.parse(job.configuration)) !==
                job.configurationDigest
            )
              invalid = "INVALID_CONFIGURATION";
          } catch {
            invalid = "INVALID_CONFIGURATION";
          }
          if (invalid) {
            await tx.durableBuildJob.update({
              where: { id },
              data: { state: "FAILED", failureCode: invalid, finishedAt: now },
            });
            return view(await lockedJob(tx, id));
          }
          if (
            await tx.durableBuildJob.count({
              where: {
                state: { in: ["PREPARING", "RUNNING", "RECOVERY_REQUIRED"] },
              },
            })
          )
            throw new HandoffError("BUSY");
          if (job.attemptCount >= job.maxAttempts)
            throw new HandoffError("ATTEMPTS_EXHAUSTED");
          const attempt = await tx.durableBuildAttempt.create({
            data: {
              jobId: id,
              number: job.attemptCount + 1,
              fence: job.fence + 1,
              workerId,
              state: "PREPARING",
              leaseUntil: new Date(
                Math.min(
                  now.getTime() + LIMITS.leaseMs,
                  job.readinessValidUntil.getTime() + LIMITS.cleanupMs,
                ),
              ),
              deadline: new Date(
                Math.min(
                  now.getTime() + LIMITS.timeoutMs,
                  job.readinessValidUntil.getTime(),
                ),
              ),
            },
          });
          await tx.durableBuildJob.update({
            where: { id },
            data: {
              state: "PREPARING",
              currentAttemptId: attempt.id,
              fence: attempt.fence,
              attemptCount: attempt.number,
              stage: 0,
              startedAt: job.startedAt ?? now,
              failureCode: null,
            },
          });
          return view(await lockedJob(tx, id));
        });
        if (claimed.state !== "PREPARING") throw new HandoffError("NOT_QUEUED");
        return claimed;
      },
      renew: (grant) =>
        mutate(grant, async (tx, { now, attempt }) => {
          await tx.durableBuildAttempt.update({
            where: { id: attempt.id },
            data: {
              leaseUntil: new Date(
                Math.min(
                  now.getTime() + LIMITS.leaseMs,
                  attempt.deadline.getTime() + LIMITS.cleanupMs,
                ),
              ),
            },
          });
        }),
      progress: (grant, stage: Progress) =>
        mutate(grant, async (tx, { job, now, attempt }) => {
          const next = progressStages.indexOf(stage) + 1;
          if (next !== job.stage + 1 || attempt.deadline <= now)
            throw new HandoffError("TRANSITION");
          await tx.durableBuildJob.update({
            where: { id },
            data: { stage: next, ...(next === 3 ? { state: "RUNNING" } : {}) },
          });
          if (next === 3)
            await tx.durableBuildAttempt.update({
              where: { id: attempt.id },
              data: { state: "RUNNING" },
            });
        }),
      finish: (grant, requested, confirmed, failure = null) =>
        mutate(grant, async (tx, { job, now, attempt }) => {
          if (!confirmed) throw new HandoffError("CLEANUP_REQUIRED");
          if (
            !terminal.includes(requested as (typeof terminal)[number]) ||
            (requested === "CHECKED" &&
              (job.stage !== 3 || attempt.deadline <= now))
          )
            throw new HandoffError("TRANSITION");
          const state = job.cancelRequestedAt ? "CANCELLED" : requested;
          await tx.durableBuildAttempt.update({
            where: { id: attempt.id },
            data: {
              state,
              failureCode: state === "CANCELLED" ? null : failure,
              finishedAt: now,
              cleanupConfirmedAt: now,
            },
          });
          await tx.durableBuildJob.update({
            where: { id },
            data: {
              state,
              failureCode: state === "CANCELLED" ? null : failure,
              finishedAt: now,
            },
          });
        }),
      quarantine: async (grant) => {
        scope(grant);
        return transaction(this.db, async (tx) => {
          const job = await lockedJob(tx, id);
          if (
            !active.includes(job.state as (typeof active)[number]) ||
            job.currentAttemptId !== grant.attemptId ||
            job.fence !== grant.fence ||
            job.currentAttempt?.workerId !== workerId
          )
            throw new HandoffError("FENCED");
          await tx.durableBuildAttempt.update({
            where: { id: grant.attemptId },
            data: {
              state: "RECOVERY_REQUIRED",
              failureCode: "CLEANUP_UNCONFIRMED",
            },
          });
          await tx.durableBuildJob.update({
            where: { id },
            data: {
              state: "RECOVERY_REQUIRED",
              failureCode: "CLEANUP_UNCONFIRMED",
            },
          });
          return view(await lockedJob(tx, id));
        });
      },
      recover: async () =>
        transaction(this.db, async (tx) => {
          const job = await lockedJob(tx, id);
          const now = await databaseNow(tx);
          if (
            active.includes(job.state as (typeof active)[number]) &&
            job.currentAttempt &&
            job.currentAttempt.leaseUntil <= now
          ) {
            await tx.durableBuildAttempt.update({
              where: { id: job.currentAttempt.id },
              data: {
                state: "RECOVERY_REQUIRED",
                failureCode: "LEASE_EXPIRED",
              },
            });
            await tx.durableBuildJob.update({
              where: { id },
              data: {
                state: "RECOVERY_REQUIRED",
                failureCode: "LEASE_EXPIRED",
              },
            });
          }
          return view(await lockedJob(tx, id));
        }),
      recovered: async (grant, confirmed) => {
        scope(grant);
        return transaction(this.db, async (tx) => {
          const job = await lockedJob(tx, id);
          const now = await databaseNow(tx);
          if (
            job.state !== "RECOVERY_REQUIRED" ||
            job.currentAttemptId !== grant.attemptId ||
            job.fence !== grant.fence
          )
            throw new HandoffError("FENCED");
          if (!confirmed) throw new HandoffError("CLEANUP_REQUIRED");
          const state = job.cancelRequestedAt
            ? "CANCELLED"
            : job.attemptCount >= job.maxAttempts ||
                job.deliveryGeneration >= D5.maxGenerations
              ? "FAILED"
              : "QUEUED";
          await tx.durableBuildAttempt.update({
            where: { id: grant.attemptId },
            data: {
              state: "FAILED",
              failureCode: "LEASE_EXPIRED",
              finishedAt: now,
              cleanupConfirmedAt: now,
            },
          });
          await tx.durableBuildJob.update({
            where: { id },
            data: {
              state,
              failureCode:
                state === "FAILED"
                  ? job.deliveryGeneration >= D5.maxGenerations
                    ? "DELIVERY_EXHAUSTED"
                    : "ATTEMPTS_EXHAUSTED"
                  : null,
              ...(state === "QUEUED"
                ? { deliveryGeneration: { increment: 1 }, stage: 0 }
                : { finishedAt: now }),
            },
          });
          if (state === "QUEUED")
            await tx.durableBuildOutbox.create({
              data: { jobId: id, generation: job.deliveryGeneration + 1 },
            });
          return view(await lockedJob(tx, id));
        });
      },
    };
  }
}
