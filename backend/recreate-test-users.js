import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Recréation des utilisateurs de test...\n');

    // 1. Récupérer la localité, sous-localité et section
    const localite = await prisma.localite.findFirst();
    if (!localite) {
      throw new Error('Aucune localité trouvée');
    }
    console.log('✅ Localité trouvée:', localite.name);

    const sousLocalite = await prisma.sousLocalite.findFirst({
      where: { localiteId: localite.id }
    });
    if (!sousLocalite) {
      throw new Error('Aucune sous-localité trouvée');
    }
    console.log('✅ Sous-localité trouvée:', sousLocalite.name);

    const section = await prisma.section.findFirst({
      where: { sousLocaliteId: sousLocalite.id }
    });
    if (!section) {
      throw new Error('Aucune section trouvée');
    }
    console.log('✅ Section trouvée:', section.name);

    // 2. Supprimer les anciens comptes s'ils existent
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin@saytou.test', 'section@test.com']
        }
      }
    });
    console.log('\n🗑️  Anciens comptes supprimés');

    // 3. Créer le compte SOUS_LOCALITE_ADMIN
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@saytou.test',
        passwordHash: adminPassword,
        name: 'Admin Sous-Localité',
        role: 'SOUS_LOCALITE_ADMIN',
        sousLocaliteId: sousLocalite.id
      }
    });
    console.log('\n✅ Compte SOUS_LOCALITE_ADMIN créé:');
    console.log('   Email: admin@saytou.test');
    console.log('   Mot de passe: Admin123!');
    console.log('   Sous-localité:', sousLocalite.name);

    // 4. Créer le compte SECTION_USER
    const userPassword = await bcrypt.hash('User123!', 10);
    const user = await prisma.user.create({
      data: {
        email: 'section@test.com',
        passwordHash: userPassword,
        name: 'Utilisateur Section',
        role: 'SECTION_USER',
        sectionId: section.id
      }
    });
    console.log('\n✅ Compte SECTION_USER créé:');
    console.log('   Email: section@test.com');
    console.log('   Mot de passe: User123!');
    console.log('   Section:', section.name);

    console.log('\n🎉 Tous les comptes de test ont été recréés avec succès!\n');
    console.log('📋 Résumé des comptes:');
    console.log('   1. localite@saytou.test / Change123! (LOCALITE)');
    console.log('   2. admin@saytou.test / Admin123! (SOUS_LOCALITE_ADMIN)');
    console.log('   3. section@test.com / User123! (SECTION_USER)');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
