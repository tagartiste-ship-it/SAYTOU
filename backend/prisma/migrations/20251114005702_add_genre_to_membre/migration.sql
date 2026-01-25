/*
  Warnings:

  - Added the required column `localite_id` to the `sous_localites` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "rencontres" ADD COLUMN     "developpement" TEXT,
ADD COLUMN     "membres_presents" JSONB,
ADD COLUMN     "pv_reunion" TEXT;

-- AlterTable
ALTER TABLE "sous_localites" ADD COLUMN     "localite_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "localites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "localites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membres" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "photo" TEXT,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "genre" TEXT,
    "fonction" TEXT,
    "corps_metier" TEXT,
    "groupe_sanguin" TEXT,
    "telephone" TEXT,
    "numero_cni" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "localites_name_key" ON "localites"("name");

-- AddForeignKey
ALTER TABLE "sous_localites" ADD CONSTRAINT "sous_localites_localite_id_fkey" FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membres" ADD CONSTRAINT "membres_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
