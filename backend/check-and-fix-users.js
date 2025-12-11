import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Vérification des utilisateurs...\n');

    // Lister tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        email: true,
        name: true,
        role: true,
        sectionId: true,
        sousLocaliteId: true
      }
    });

    console.log('📋 Utilisateurs existants:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role})`);
    });

    // Vérifier si user@saytou.test existe
    const userExists = users.find(u => u.email === 'user@saytou.test');
    
    if (!userExists) {
      console.log('\n❌ user@saytou.test n\'existe pas');
      console.log('🔧 Création du compte user@saytou.test...');

      // Récupérer une section
      const section = await prisma.section.findFirst();
      if (!section) {
        throw new Error('Aucune section trouvée');
      }

      // Créer le compte
      const password = await bcrypt.hash('User123!', 10);
      await prisma.user.create({
        data: {
          email: 'user@saytou.test',
          passwordHash: password,
          name: 'Utilisateur Section',
          role: 'SECTION_USER',
          sectionId: section.id
        }
      });

      console.log('✅ Compte user@saytou.test créé avec succès!');
      console.log('   Email: user@saytou.test');
      console.log('   Mot de passe: User123!');
    } else {
      console.log('\n✅ user@saytou.test existe déjà');
      
      // Mettre à jour le mot de passe au cas où
      const password = await bcrypt.hash('User123!', 10);
      await prisma.user.update({
        where: { email: 'user@saytou.test' },
        data: { passwordHash: password }
      });
      console.log('🔄 Mot de passe réinitialisé: User123!');
    }

    console.log('\n📋 Tous les comptes disponibles:');
    console.log('   1. localite@saytou.test / Change123! (LOCALITE)');
    console.log('   2. admin@saytou.test / Admin123! (SOUS_LOCALITE_ADMIN)');
    console.log('   3. user@saytou.test / User123! (SECTION_USER)');
    console.log('   4. section@test.com / User123! (SECTION_USER)');

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
