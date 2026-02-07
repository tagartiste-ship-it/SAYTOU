-- CreateEnum
CREATE TYPE "OrgUnitKind" AS ENUM ('CELLULE', 'COMMISSION');

-- CreateEnum
CREATE TYPE "OrgUnitRubrique" AS ENUM ('CELLULES_S3', 'COMMISSIONS_S1S2');

-- CreateEnum
CREATE TYPE "OrgUnitScopeType" AS ENUM ('LOCALITE', 'SECTION');

-- CreateTable
CREATE TABLE "org_unit_definitions" (
    "id" TEXT NOT NULL,
    "kind" "OrgUnitKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rubrique" "OrgUnitRubrique" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_instances" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "scope_type" "OrgUnitScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_assignments" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_unit_definitions_rubrique_idx" ON "org_unit_definitions"("rubrique");

-- CreateIndex
CREATE INDEX "org_unit_definitions_is_active_idx" ON "org_unit_definitions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_definitions_kind_code_key" ON "org_unit_definitions"("kind", "code");

-- CreateIndex
CREATE INDEX "org_unit_instances_definition_id_idx" ON "org_unit_instances"("definition_id");

-- CreateIndex
CREATE INDEX "org_unit_instances_scope_type_idx" ON "org_unit_instances"("scope_type");

-- CreateIndex
CREATE INDEX "org_unit_instances_scope_id_idx" ON "org_unit_instances"("scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_instances_definition_id_scope_type_scope_id_key" ON "org_unit_instances"("definition_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "org_unit_assignments_instance_id_idx" ON "org_unit_assignments"("instance_id");

-- CreateIndex
CREATE INDEX "org_unit_assignments_user_id_idx" ON "org_unit_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_assignments_instance_id_user_id_key" ON "org_unit_assignments"("instance_id", "user_id");

-- AddForeignKey
ALTER TABLE "org_unit_instances" ADD CONSTRAINT "org_unit_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "org_unit_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_assignments" ADD CONSTRAINT "org_unit_assignments_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "org_unit_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_assignments" ADD CONSTRAINT "org_unit_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

