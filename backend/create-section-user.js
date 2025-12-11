import prisma from './dist/utils/prisma.js';
import bcrypt from 'bcrypt';

async function createSectionUser() {
  try {
    console.log('🔍 Vérification des sections disponibles...');
    
    // Récupérer la première section
    const section = await prisma.section.findFirst();
    
    if (!section) {
      console.log('❌ Aucune section trouvée');
      console.log('💡 Créez d\'abord une section via l\'interface');
      return;
    }

    console.log('📍 Section trouvée:', section.name);

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: 'section@test.com' }
    });

    if (existingUser) {
      console.log('\n👤 Utilisateur existe déjà');
      
      if (!existingUser.sectionId) {
        console.log('🔄 Mise à jour avec la section...');
        const updated = await prisma.user.update({
          where: { email: 'section@test.com' },
          data: { sectionId: section.id }
        });
        console.log('✅ Section assignée !');
      } else {
        console.log('✅ Section déjà assignée');
      }
      return;
    }

    // Créer l'utilisateur
    console.log('\n🔄 Création de l\'utilisateur section@test.com...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'section@test.com',
        passwordHash: hashedPassword,
        role: 'SECTION_USER',
        name: 'Utilisateur Section',
        sectionId: section.id
      },
      include: { section: true }
    });

    console.log('\n✅ Utilisateur créé avec succès !');
    console.log('📧 Email:', user.email);
    console.log('🔑 Mot de passe: password123');
    console.log('👤 Rôle:', user.role);
    console.log('📍 Section:', user.section.name);
    console.log('\n🎉 Vous pouvez maintenant vous connecter et accéder aux membres !');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createSectionUser();
