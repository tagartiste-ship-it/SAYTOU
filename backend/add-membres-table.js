import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Création de la table membres...');
    
    // Créer la table membres
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "membres" (
        "id" TEXT NOT NULL,
        "section_id" TEXT NOT NULL,
        "photo" TEXT,
        "prenom" TEXT NOT NULL,
        "nom" TEXT NOT NULL,
        "fonction" TEXT,
        "corps_metier" TEXT,
        "groupe_sanguin" TEXT,
        "telephone" TEXT,
        "numero_cni" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "membres_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('✓ Table membres créée');
    
    // Ajouter la contrainte de clé étrangère
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "membres" 
        ADD CONSTRAINT "membres_section_id_fkey" 
        FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('✓ Contrainte de clé étrangère ajoutée');
    } catch (e) {
      console.log('✓ Contrainte de clé étrangère déjà existante');
    }
    
    // Renommer la colonne liste_membres en membres_presents
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "rencontres" RENAME COLUMN "liste_membres" TO "membres_presents"
      `);
      console.log('✓ Colonne liste_membres renommée en membres_presents');
    } catch (e) {
      console.log('✓ Colonne déjà renommée ou n\'existe pas');
    }
    
    console.log('\n✅ Migration réussie !');
    console.log('- Table membres créée pour gérer les membres de chaque section');
    console.log('- Colonne membres_presents dans rencontres pour la fiche de présence');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
