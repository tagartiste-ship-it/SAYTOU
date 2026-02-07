-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ORG_UNIT_RESP';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "localite_id" TEXT;

-- CreateIndex
CREATE INDEX "users_localite_id_idx" ON "users"("localite_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_localite_id_fkey" FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
