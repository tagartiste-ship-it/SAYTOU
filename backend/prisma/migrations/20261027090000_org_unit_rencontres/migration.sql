ALTER TYPE "ScopeType" ADD VALUE IF NOT EXISTS 'ORG_UNIT';
ALTER TABLE "rencontres" ADD COLUMN "org_unit_instance_id" TEXT;
CREATE INDEX "rencontres_org_unit_instance_id_idx" ON "rencontres"("org_unit_instance_id");
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_org_unit_instance_id_fkey"
  FOREIGN KEY ("org_unit_instance_id") REFERENCES "org_unit_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
