import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Configuration complète des données de test...\n');

    // 1. Créer ou récupérer la localité
    let localite = await prisma.localite.findFirst();
    if (!localite) {
      localite = await prisma.localite.create({
        data: {
          name: 'Dakar'
        }
      });
      console.log('✅ Localité créée:', localite.name);
    } else {
      console.log('✅ Localité existante:', localite.name);
    }

    // 2. Créer le compte LOCALITE s'il n'existe pas
    let localiteUser = await prisma.user.findUnique({
      where: { email: 'localite@saytou.test' }
    });
    
    if (!localiteUser) {
      const localitePassword = await bcrypt.hash('Change123!', 10);
      localiteUser = await prisma.user.create({
        data: {
          email: 'localite@saytou.test',
          passwordHash: localitePassword,
          name: 'Admin Localité',
          role: 'LOCALITE'
        }
      });
      console.log('✅ Compte LOCALITE créé');
    } else {
      console.log('✅ Compte LOCALITE existant');
    }

    // 3. Créer ou récupérer la sous-localité
    let sousLocalite = await prisma.sousLocalite.findFirst({
      where: { localiteId: localite.id }
    });
    
    if (!sousLocalite) {
      sousLocalite = await prisma.sousLocalite.create({
        data: {
          name: 'Sous-Localité Exemple',
          localiteId: localite.id,
          createdById: localiteUser.id
        }
      });
      console.log('✅ Sous-localité créée:', sousLocalite.name);
    } else {
      console.log('✅ Sous-localité existante:', sousLocalite.name);
    }

    // 4. Supprimer et recréer le compte SOUS_LOCALITE_ADMIN
    await prisma.user.deleteMany({
      where: { email: 'admin@saytou.test' }
    });
    
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
    console.log('✅ Compte SOUS_LOCALITE_ADMIN créé');

    // 5. Créer ou récupérer la section
    let section = await prisma.section.findFirst({
      where: { sousLocaliteId: sousLocalite.id }
    });
    
    if (!section) {
      section = await prisma.section.create({
        data: {
          name: 'Section Exemple',
          sousLocaliteId: sousLocalite.id,
          createdById: admin.id
        }
      });
      console.log('✅ Section créée:', section.name);
    } else {
      console.log('✅ Section existante:', section.name);
    }

    // 6. Supprimer et recréer le compte SECTION_USER
    await prisma.user.deleteMany({
      where: { email: 'section@test.com' }
    });
    
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
    console.log('✅ Compte SECTION_USER créé');

    console.log('\n🎉 Configuration terminée avec succès!\n');
    console.log('📋 Comptes disponibles:');
    console.log('   1. localite@saytou.test / Change123! (LOCALITE)');
    console.log('   2. admin@saytou.test / Admin123! (SOUS_LOCALITE_ADMIN)');
    console.log('   3. section@test.com / User123! (SECTION_USER)\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
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
