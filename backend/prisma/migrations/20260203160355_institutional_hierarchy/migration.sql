-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'OWNER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'COMITE_ADMIN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'ZONE_ADMIN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'CONCLAVE_ADMIN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "comite_id" TEXT,
ADD COLUMN     "conclave_id" TEXT,
ADD COLUMN     "zone_id" TEXT;

-- AlterTable
ALTER TABLE "localites" ADD COLUMN     "comite_id" TEXT;

-- CreateTable
CREATE TABLE "conclaves" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conclaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conclave_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conclaves_name_key" ON "conclaves"("name");

-- CreateIndex
CREATE INDEX "zones_conclave_id_idx" ON "zones"("conclave_id");

-- CreateIndex
CREATE UNIQUE INDEX "zones_conclave_id_name_key" ON "zones"("conclave_id", "name");

-- CreateIndex
CREATE INDEX "comites_zone_id_idx" ON "comites"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "comites_zone_id_name_key" ON "comites"("zone_id", "name");

-- CreateIndex
CREATE INDEX "users_conclave_id_idx" ON "users"("conclave_id");

-- CreateIndex
CREATE INDEX "users_zone_id_idx" ON "users"("zone_id");

-- CreateIndex
CREATE INDEX "users_comite_id_idx" ON "users"("comite_id");

-- CreateIndex
CREATE INDEX "localites_comite_id_idx" ON "localites"("comite_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_conclave_id_fkey" FOREIGN KEY ("conclave_id") REFERENCES "conclaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_comite_id_fkey" FOREIGN KEY ("comite_id") REFERENCES "comites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_conclave_id_fkey" FOREIGN KEY ("conclave_id") REFERENCES "conclaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comites" ADD CONSTRAINT "comites_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localites" ADD CONSTRAINT "localites_comite_id_fkey" FOREIGN KEY ("comite_id") REFERENCES "comites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

