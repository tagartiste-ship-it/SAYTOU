-- AlterTable
ALTER TABLE "membres" ADD COLUMN     "date_naissance" TIMESTAMP(3),
ADD COLUMN     "numero_carte_electeur" TEXT;

-- AlterTable
ALTER TABLE "rencontre_types" ADD COLUMN     "tranche_age_id" TEXT;

-- CreateTable
CREATE TABLE "tranches_age" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age_min" INTEGER NOT NULL,
    "age_max" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tranches_age_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tranches_age_name_key" ON "tranches_age"("name");

-- CreateIndex
CREATE INDEX "tranches_age_order_idx" ON "tranches_age"("order");

-- CreateIndex
CREATE INDEX "rencontre_types_tranche_age_id_idx" ON "rencontre_types"("tranche_age_id");

-- AddForeignKey
ALTER TABLE "rencontre_types" ADD CONSTRAINT "rencontre_types_tranche_age_id_fkey" FOREIGN KEY ("tranche_age_id") REFERENCES "tranches_age"("id") ON DELETE SET NULL ON UPDATE CASCADE;
