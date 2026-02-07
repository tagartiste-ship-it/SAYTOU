-- AlterEnum
ALTER TYPE "BureauScopeType" ADD VALUE 'ORG_UNIT_INSTANCE';

-- CreateTable
CREATE TABLE "org_unit_pvs" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_pvs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_pvs_instance_id_key" ON "org_unit_pvs"("instance_id");

-- CreateIndex
CREATE INDEX "org_unit_pvs_instance_id_idx" ON "org_unit_pvs"("instance_id");

-- AddForeignKey
ALTER TABLE "org_unit_pvs" ADD CONSTRAINT "org_unit_pvs_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "org_unit_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
