BEGIN;
-- CreateEnum
CREATE TYPE "DurableBuildState" AS ENUM ('QUEUED', 'PREPARING', 'RUNNING', 'CHECKED', 'FAILED', 'CANCELLED', 'RECOVERY_REQUIRED');

-- CreateEnum
CREATE TYPE "DurableOutboxState" AS ENUM ('PENDING', 'DISPATCHING', 'SENT', 'DEAD');

-- CreateTable
CREATE TABLE "DurableBuildJob" (
    "id" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "requestDigest" CHAR(64) NOT NULL,
    "configurationDigest" CHAR(64) NOT NULL,
    "readinessDigest" CHAR(64) NOT NULL,
    "readinessValidUntil" TIMESTAMP(3) NOT NULL,
    "targetDigest" CHAR(64) NOT NULL,
    "targetId" VARCHAR(100) NOT NULL,
    "configuration" JSONB NOT NULL,
    "kind" VARCHAR(32) NOT NULL DEFAULT 'ISOLATION_PREFLIGHT',
    "compiled" BOOLEAN NOT NULL DEFAULT false,
    "state" "DurableBuildState" NOT NULL DEFAULT 'QUEUED',
    "fence" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "deliveryGeneration" INTEGER NOT NULL DEFAULT 0,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "cancelRequestedAt" TIMESTAMP(3),
    "failureCode" VARCHAR(32),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentAttemptId" UUID,

    CONSTRAINT "DurableBuildJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurableBuildAttempt" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "fence" INTEGER NOT NULL,
    "workerId" VARCHAR(100) NOT NULL,
    "state" "DurableBuildState" NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "cleanupConfirmedAt" TIMESTAMP(3),
    "failureCode" VARCHAR(32),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DurableBuildAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurableBuildOutbox" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "state" "DurableOutboxState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchToken" UUID,
    "dispatchLeaseUntil" TIMESTAMP(3),
    "failureCode" VARCHAR(32),
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DurableBuildOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DurableBuildJob_currentAttemptId_key" ON "DurableBuildJob"("currentAttemptId");

-- CreateIndex
CREATE INDEX "DurableBuildJob_ownerId_createdAt_id_idx" ON "DurableBuildJob"("ownerId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "DurableBuildJob_state_updatedAt_idx" ON "DurableBuildJob"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DurableBuildJob_ownerId_idempotencyKey_key" ON "DurableBuildJob"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DurableBuildAttempt_state_leaseUntil_idx" ON "DurableBuildAttempt"("state", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "DurableBuildAttempt_jobId_number_key" ON "DurableBuildAttempt"("jobId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DurableBuildAttempt_jobId_fence_key" ON "DurableBuildAttempt"("jobId", "fence");

-- CreateIndex
CREATE INDEX "DurableBuildOutbox_state_nextAttemptAt_idx" ON "DurableBuildOutbox"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "DurableBuildOutbox_state_dispatchLeaseUntil_idx" ON "DurableBuildOutbox"("state", "dispatchLeaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "DurableBuildOutbox_jobId_generation_key" ON "DurableBuildOutbox"("jobId", "generation");

-- AddForeignKey
ALTER TABLE "DurableBuildJob" ADD CONSTRAINT "DurableBuildJob_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableBuildJob" ADD CONSTRAINT "DurableBuildJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ROMProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableBuildJob" ADD CONSTRAINT "DurableBuildJob_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ConfigurationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableBuildJob" ADD CONSTRAINT "DurableBuildJob_currentAttemptId_fkey" FOREIGN KEY ("currentAttemptId") REFERENCES "DurableBuildAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableBuildAttempt" ADD CONSTRAINT "DurableBuildAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DurableBuildJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableBuildOutbox" ADD CONSTRAINT "DurableBuildOutbox_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DurableBuildJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Additional safety constraints; no existing table is rewritten.
ALTER TABLE "DurableBuildJob" ADD CONSTRAINT "DurableBuildJob_preflight_only" CHECK ("kind" = 'ISOLATION_PREFLIGHT' AND "compiled" = false), ADD CONSTRAINT "DurableBuildJob_bounds" CHECK ("fence" >= 0 AND "attemptCount" >= 0 AND "attemptCount" <= "maxAttempts" AND "maxAttempts" BETWEEN 1 AND 2 AND "deliveryGeneration" BETWEEN 0 AND 8 AND "stage" BETWEEN 0 AND 3);
ALTER TABLE "DurableBuildAttempt" ADD CONSTRAINT "DurableBuildAttempt_bounds" CHECK ("number" BETWEEN 1 AND 2 AND "fence" BETWEEN 1 AND 2 AND "leaseUntil" <= "deadline" + interval '5 seconds');
ALTER TABLE "DurableBuildOutbox" ADD CONSTRAINT "DurableBuildOutbox_bounds" CHECK ("generation" BETWEEN 0 AND 8 AND "attempts" BETWEEN 0 AND 8), ADD CONSTRAINT "DurableBuildOutbox_dispatch_lease" CHECK ("state" <> 'DISPATCHING' OR ("dispatchToken" IS NOT NULL AND "dispatchLeaseUntil" IS NOT NULL));

COMMIT;
