-- AlterTable
ALTER TABLE "rencontres" ADD COLUMN     "lieu_membre_id" TEXT,
ADD COLUMN     "lieu_texte" TEXT;

-- CreateIndex
CREATE INDEX "rencontres_lieu_membre_id_idx" ON "rencontres"("lieu_membre_id");

-- AddForeignKey
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_lieu_membre_id_fkey" FOREIGN KEY ("lieu_membre_id") REFERENCES "membres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
