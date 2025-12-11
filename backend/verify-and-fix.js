import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('   VÉRIFICATION ET CORRECTION COMPLÈTE');
  console.log('========================================\n');
  
  try {
    // 1. Vérifier l'utilisateur
    console.log('[1/5] Vérification de l\'utilisateur...');
    const user = await prisma.user.findUnique({
      where: { email: 'localite@saytou.test' },
      include: {
        section: true,
        sousLocalite: true
      }
    });
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }
    
    console.log('✓ Utilisateur trouvé:');
    console.log('  - Email:', user.email);
    console.log('  - Rôle:', user.role);
    console.log('  - Section ID:', user.sectionId || 'AUCUN');
    console.log('  - Sous-Localité ID:', user.sousLocaliteId || 'AUCUN');
    
    // 2. Vérifier la structure (Localité -> Sous-Localité -> Section)
    console.log('\n[2/5] Vérification de la structure organisationnelle...');
    
    let localite = await prisma.localite.findFirst();
    if (!localite) {
      console.log('⚠️  Aucune localité trouvée, création...');
      localite = await prisma.localite.create({
        data: {
          name: 'La Localité de Mbour',
          createdById: user.id
        }
      });
      console.log('✓ Localité créée:', localite.name);
    } else {
      console.log('✓ Localité existante:', localite.name);
    }
    
    let sousLocalite = await prisma.sousLocalite.findFirst({
      where: { localiteId: localite.id }
    });
    
    if (!sousLocalite) {
      console.log('⚠️  Aucune sous-localité trouvée, création...');
      sousLocalite = await prisma.sousLocalite.create({
        data: {
          name: 'Sous-Localité Exemple',
          localiteId: localite.id,
          createdById: user.id
        }
      });
      console.log('✓ Sous-Localité créée:', sousLocalite.name);
    } else {
      console.log('✓ Sous-Localité existante:', sousLocalite.name);
    }
    
    let section = await prisma.section.findFirst({
      where: { sousLocaliteId: sousLocalite.id }
    });
    
    if (!section) {
      console.log('⚠️  Aucune section trouvée, création...');
      section = await prisma.section.create({
        data: {
          name: 'Section A',
          sousLocaliteId: sousLocalite.id,
          createdById: user.id
        }
      });
      console.log('✓ Section créée:', section.name);
    } else {
      console.log('✓ Section existante:', section.name);
    }
    
    // 3. Mettre à jour l'utilisateur
    console.log('\n[3/5] Mise à jour de l\'utilisateur...');
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'SECTION_USER',
        sectionId: section.id,
        sousLocaliteId: sousLocalite.id
      }
    });
    
    console.log('✓ Utilisateur mis à jour:');
    console.log('  - Rôle:', updatedUser.role);
    console.log('  - Section ID:', updatedUser.sectionId);
    console.log('  - Sous-Localité ID:', updatedUser.sousLocaliteId);
    
    // 4. Vérifier le modèle Membre
    console.log('\n[4/5] Vérification du modèle Membre...');
    
    const membresCount = await prisma.membre.count({
      where: { sectionId: section.id }
    });
    
    console.log('✓ Membres dans cette section:', membresCount);
    
    // 5. Tester la requête API
    console.log('\n[5/5] Test de la requête...');
    
    const membres = await prisma.membre.findMany({
      where: { sectionId: section.id },
      include: {
        section: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    console.log('✓ Requête réussie, membres trouvés:', membres.length);
    
    console.log('\n========================================');
    console.log('   ✅ VÉRIFICATION TERMINÉE');
    console.log('========================================');
    console.log('\nRésumé:');
    console.log('- Localité:', localite.name);
    console.log('- Sous-Localité:', sousLocalite.name);
    console.log('- Section:', section.name);
    console.log('- Utilisateur: SECTION_USER');
    console.log('- Membres:', membresCount);
    console.log('\nVous pouvez maintenant:');
    console.log('1. Fermer toutes les fenêtres du navigateur');
    console.log('2. Redémarrer le serveur avec RESTART.bat');
    console.log('3. Se reconnecter avec: localite@saytou.test / ChangeMe123!');
    console.log('4. Aller sur la page Membres');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
