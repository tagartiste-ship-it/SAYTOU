-- CreateEnum
CREATE TYPE "BureauScopeType" AS ENUM ('LOCALITE', 'SOUS_LOCALITE', 'SECTION');

-- CreateEnum
CREATE TYPE "BureauGroupe" AS ENUM ('S1S2', 'S3');

-- CreateEnum
CREATE TYPE "BureauAffectationKind" AS ENUM ('TITULAIRE', 'ADJOINT');

-- CreateEnum
CREATE TYPE "BureauSlotType" AS ENUM ('PRIMARY', 'EXTRA');

-- CreateTable
CREATE TABLE "bureau_postes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope_type" "BureauScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "groupe" "BureauGroupe" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bureau_postes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bureau_affectations" (
    "id" TEXT NOT NULL,
    "poste_id" TEXT NOT NULL,
    "membre_id" TEXT NOT NULL,
    "kind" "BureauAffectationKind" NOT NULL,
    "slot_type" "BureauSlotType" NOT NULL DEFAULT 'EXTRA',
    "slot_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bureau_affectations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bureau_postes_scope_type_scope_id_idx" ON "bureau_postes"("scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "bureau_postes_groupe_idx" ON "bureau_postes"("groupe");

-- CreateIndex
CREATE UNIQUE INDEX "bureau_postes_scope_type_scope_id_groupe_name_key" ON "bureau_postes"("scope_type", "scope_id", "groupe", "name");

-- CreateIndex
CREATE INDEX "bureau_affectations_poste_id_idx" ON "bureau_affectations"("poste_id");

-- CreateIndex
CREATE INDEX "bureau_affectations_membre_id_idx" ON "bureau_affectations"("membre_id");

-- CreateIndex
CREATE UNIQUE INDEX "bureau_affectations_poste_id_kind_slot_type_slot_index_key" ON "bureau_affectations"("poste_id", "kind", "slot_type", "slot_index");

-- AddForeignKey
ALTER TABLE "bureau_affectations" ADD CONSTRAINT "bureau_affectations_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "bureau_postes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bureau_affectations" ADD CONSTRAINT "bureau_affectations_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "membres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
