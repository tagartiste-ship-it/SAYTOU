import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Application de la migration...');
    
    // Créer la table localites
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "localites" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "localites_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('✓ Table localites créée');
    
    // Créer l'index unique
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "localites_name_key" ON "localites"("name")
    `);
    console.log('✓ Index créé');
    
    // Insérer la localité de Mbour
    await prisma.$executeRawUnsafe(`
      INSERT INTO "localites" ("id", "name", "created_at", "updated_at")
      SELECT gen_random_uuid(), 'La Localité de Mbour', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM "localites" WHERE "name" = 'La Localité de Mbour')
    `);
    console.log('✓ Localité de Mbour insérée');
    
    // Ajouter la colonne localite_id
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sous_localites" ADD COLUMN IF NOT EXISTS "localite_id" TEXT
    `);
    console.log('✓ Colonne localite_id ajoutée');
    
    // Lier les sous-localités existantes
    await prisma.$executeRawUnsafe(`
      UPDATE "sous_localites" 
      SET "localite_id" = (SELECT "id" FROM "localites" WHERE "name" = 'La Localité de Mbour')
      WHERE "localite_id" IS NULL
    `);
    console.log('✓ Sous-localités liées à Mbour');
    
    // Rendre NOT NULL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sous_localites" ALTER COLUMN "localite_id" SET NOT NULL
    `);
    console.log('✓ Colonne localite_id définie comme NOT NULL');
    
    // Ajouter la contrainte de clé étrangère
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "sous_localites" 
        ADD CONSTRAINT "sous_localites_localite_id_fkey" 
        FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('✓ Contrainte de clé étrangère ajoutée');
    } catch (e) {
      console.log('✓ Contrainte de clé étrangère déjà existante');
    }
    
    console.log('\n✅ Migration appliquée avec succès !');
    console.log('La localité "La Localité de Mbour" a été créée et liée aux sous-localités.');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
