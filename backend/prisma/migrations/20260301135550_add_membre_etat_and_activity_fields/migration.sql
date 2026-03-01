-- CreateEnum
CREATE TYPE "MembreEtat" AS ENUM ('ACTIF', 'VOYAGE', 'MALADE', 'MORT', 'ABANDONNE');

-- AlterTable
ALTER TABLE "membres" ADD COLUMN     "etat" "MembreEtat" NOT NULL DEFAULT 'ACTIF',
ADD COLUMN     "etat_updated_at" TIMESTAMP(3),
ADD COLUMN     "goudi_absence_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_presence_at" TIMESTAMP(3);
