-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('UNVERIFIED', 'CATALOGED');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('UNREVIEWED', 'SOURCE_AVAILABLE');

-- CreateEnum
CREATE TYPE "BuildSupportStatus" AS ENUM ('NOT_VERIFIED');

-- CreateEnum
CREATE TYPE "BaseAvailability" AS ENUM ('SOURCE_AVAILABLE', 'DEPRECATED');

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "deprecatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DeviceVariant" ADD COLUMN     "buildSupportStatus" "BuildSupportStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
ADD COLUMN     "catalogStatus" "CatalogStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hardwareVariant" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "officialSourceUrl" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "sourceCodeUrl" TEXT,
ADD COLUMN     "sourceStatus" "SourceStatus" NOT NULL DEFAULT 'UNREVIEWED';

-- CreateTable
CREATE TABLE "AndroidBase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "androidVersion" TEXT NOT NULL,
    "sourceRepository" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "documentationUrl" TEXT NOT NULL,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" "BaseAvailability" NOT NULL DEFAULT 'SOURCE_AVAILABLE',
    "buildSupportStatus" "BuildSupportStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
    "reviewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AndroidBase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AndroidBase_name_androidVersion_sourceRef_key" ON "AndroidBase"("name", "androidVersion", "sourceRef");

