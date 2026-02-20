-- AlterTable
ALTER TABLE "rencontres" ALTER COLUMN "section_id" DROP NOT NULL;

-- Drop and recreate FK to ensure ON DELETE SET NULL behavior when a section is removed
ALTER TABLE "rencontres" DROP CONSTRAINT IF EXISTS "rencontres_section_id_fkey";
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
