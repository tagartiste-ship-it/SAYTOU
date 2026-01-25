-- AlterTable
ALTER TABLE "rencontre_types" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "scope_id" TEXT,
ADD COLUMN     "scope_type" "ScopeType";

-- CreateIndex
CREATE INDEX "rencontre_types_scope_type_scope_id_idx" ON "rencontre_types"("scope_type", "scope_id");

-- AddForeignKey
ALTER TABLE "rencontre_types" ADD CONSTRAINT "rencontre_types_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
