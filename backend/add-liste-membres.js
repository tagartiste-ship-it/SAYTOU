import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Ajout du champ liste_membres...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "rencontres" ADD COLUMN IF NOT EXISTS "liste_membres" JSONB
    `);
    console.log('✓ Champ "liste_membres" ajouté');
    
    console.log('\n✅ Migration réussie !');
    console.log('Les rencontres peuvent maintenant avoir une liste de membres présents.');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
