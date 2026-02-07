-- CreateTable
CREATE TABLE "org_unit_pv_configs" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_pv_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_pv_configs_definition_id_key" ON "org_unit_pv_configs"("definition_id");

-- CreateIndex
CREATE INDEX "org_unit_pv_configs_definition_id_idx" ON "org_unit_pv_configs"("definition_id");

-- AddForeignKey
ALTER TABLE "org_unit_pv_configs" ADD CONSTRAINT "org_unit_pv_configs_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "org_unit_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
