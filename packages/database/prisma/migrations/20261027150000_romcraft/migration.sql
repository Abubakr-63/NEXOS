-- CreateTable
CREATE TABLE "ROMProject" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ROMProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationRevision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ROMProject_ownerId_updatedAt_idx" ON "ROMProject"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationRevision_projectId_number_key" ON "ConfigurationRevision"("projectId", "number");

-- AddForeignKey
ALTER TABLE "ROMProject" ADD CONSTRAINT "ROMProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationRevision" ADD CONSTRAINT "ConfigurationRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ROMProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

