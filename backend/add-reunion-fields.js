import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Ajout des champs pour les réunions...');
    
    // Ajouter le champ developpement
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "rencontres" ADD COLUMN IF NOT EXISTS "developpement" TEXT
    `);
    console.log('✓ Champ "developpement" ajouté');
    
    // Ajouter le champ pv_reunion
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "rencontres" ADD COLUMN IF NOT EXISTS "pv_reunion" TEXT
    `);
    console.log('✓ Champ "pv_reunion" ajouté');
    
    console.log('\n✅ Champs ajoutés avec succès !');
    console.log('Les réunions peuvent maintenant avoir :');
    console.log('  - Un espace de développement');
    console.log('  - Un espace de PV de réunion');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
