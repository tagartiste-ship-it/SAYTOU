-- CreateTable
CREATE TABLE "org_unit_members" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "membre_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_unit_members_instance_id_idx" ON "org_unit_members"("instance_id");

-- CreateIndex
CREATE INDEX "org_unit_members_membre_id_idx" ON "org_unit_members"("membre_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_members_instance_id_membre_id_key" ON "org_unit_members"("instance_id", "membre_id");

-- AddForeignKey
ALTER TABLE "org_unit_members" ADD CONSTRAINT "org_unit_members_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "org_unit_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_members" ADD CONSTRAINT "org_unit_members_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "membres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
