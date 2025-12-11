import prisma from './dist/utils/prisma.js';

async function fixSectionUser() {
  try {
    console.log('🔍 Vérification de l\'utilisateur section@test.com...');
    
    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: 'section@test.com' },
      include: { section: true }
    });

    if (!user) {
      console.log('❌ Utilisateur section@test.com non trouvé');
      return;
    }

    console.log('👤 Utilisateur trouvé:', {
      email: user.email,
      role: user.role,
      sectionId: user.sectionId,
      section: user.section?.name || 'Aucune'
    });

    if (user.sectionId) {
      console.log('✅ L\'utilisateur a déjà une section assignée:', user.section.name);
      return;
    }

    // Récupérer la première section disponible
    console.log('\n🔍 Recherche d\'une section disponible...');
    const section = await prisma.section.findFirst();
    
    if (!section) {
      console.log('❌ Aucune section trouvée dans la base de données');
      console.log('💡 Créez d\'abord une section via l\'interface ou Prisma Studio');
      return;
    }

    console.log('📍 Section trouvée:', section.name);

    // Mettre à jour l'utilisateur
    console.log('\n🔄 Attribution de la section à l\'utilisateur...');
    const updatedUser = await prisma.user.update({
      where: { email: 'section@test.com' },
      data: { sectionId: section.id },
      include: { section: true }
    });

    console.log('\n✅ Section assignée avec succès !');
    console.log('📧 Utilisateur:', updatedUser.email);
    console.log('📍 Section:', updatedUser.section.name);
    console.log('\n🎉 Vous pouvez maintenant rafraîchir la page frontend !');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSectionUser();
