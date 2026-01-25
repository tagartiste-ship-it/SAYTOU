-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('LOCALITE', 'SOUS_LOCALITE', 'SECTION');

-- AlterTable
ALTER TABLE "rencontres" ADD COLUMN "scope_type" "ScopeType";
ALTER TABLE "rencontres" ADD COLUMN "scope_id" TEXT;

-- Update existing data
UPDATE "rencontres" SET "scope_type" = 'SECTION', "scope_id" = "section_id";

-- Make columns NOT NULL
ALTER TABLE "rencontres" ALTER COLUMN "scope_type" SET NOT NULL;
ALTER TABLE "rencontres" ALTER COLUMN "scope_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "rencontres_scope_type_scope_id_idx" ON "rencontres"("scope_type", "scope_id");
