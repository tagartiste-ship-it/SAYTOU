import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Vérification et correction des utilisateurs...\n');
    
    // Récupérer l'utilisateur de test
    const user = await prisma.user.findUnique({
      where: { email: 'localite@saytou.test' },
      include: {
        section: true,
        sousLocalite: true
      }
    });
    
    if (!user) {
      console.log('❌ Utilisateur localite@saytou.test non trouvé');
      return;
    }
    
    console.log('Utilisateur actuel:');
    console.log('- Email:', user.email);
    console.log('- Rôle:', user.role);
    console.log('- Section ID:', user.sectionId || 'NON DÉFINI');
    console.log('- Sous-Localité ID:', user.sousLocaliteId || 'NON DÉFINI');
    console.log();
    
    // Si l'utilisateur est SECTION_USER mais n'a pas de section
    if (user.role === 'SECTION_USER' && !user.sectionId) {
      console.log('⚠️  Utilisateur SECTION_USER sans section assignée');
      
      // Récupérer la première section disponible
      const section = await prisma.section.findFirst({
        include: {
          sousLocalite: true
        }
      });
      
      if (section) {
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            sectionId: section.id,
            sousLocaliteId: section.sousLocaliteId
          }
        });
        
        console.log('✅ Section assignée:');
        console.log('- Section:', section.name);
        console.log('- Sous-Localité:', section.sousLocalite.name);
      } else {
        console.log('❌ Aucune section disponible dans la base de données');
        console.log('Création d\'une section de test...');
        
        // Récupérer ou créer une sous-localité
        let sousLocalite = await prisma.sousLocalite.findFirst();
        
        if (!sousLocalite) {
          // Récupérer ou créer une localité
          let localite = await prisma.localite.findFirst();
          
          if (!localite) {
            localite = await prisma.localite.create({
              data: {
                name: 'Localité Test',
                createdById: user.id
              }
            });
            console.log('✅ Localité créée:', localite.name);
          }
          
          sousLocalite = await prisma.sousLocalite.create({
            data: {
              name: 'Sous-Localité Test',
              localiteId: localite.id,
              createdById: user.id
            }
          });
          console.log('✅ Sous-Localité créée:', sousLocalite.name);
        }
        
        // Créer une section
        const newSection = await prisma.section.create({
          data: {
            name: 'Section Test',
            sousLocaliteId: sousLocalite.id,
            createdById: user.id
          }
        });
        console.log('✅ Section créée:', newSection.name);
        
        // Assigner la section à l'utilisateur
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            sectionId: newSection.id,
            sousLocaliteId: sousLocalite.id
          }
        });
        
        console.log('✅ Section assignée à l\'utilisateur');
      }
    } else if (user.role !== 'SECTION_USER') {
      console.log('ℹ️  Utilisateur avec rôle', user.role);
      console.log('Changement du rôle en SECTION_USER...');
      
      // Récupérer ou créer une section
      let section = await prisma.section.findFirst({
        include: {
          sousLocalite: true
        }
      });
      
      if (!section) {
        // Créer la hiérarchie complète
        let localite = await prisma.localite.findFirst();
        if (!localite) {
          localite = await prisma.localite.create({
            data: {
              name: 'Localité Test',
              createdById: user.id
            }
          });
        }
        
        let sousLocalite = await prisma.sousLocalite.findFirst();
        if (!sousLocalite) {
          sousLocalite = await prisma.sousLocalite.create({
            data: {
              name: 'Sous-Localité Test',
              localiteId: localite.id,
              createdById: user.id
            }
          });
        }
        
        section = await prisma.section.create({
          data: {
            name: 'Section Test',
            sousLocaliteId: sousLocalite.id,
            createdById: user.id
          },
          include: {
            sousLocalite: true
          }
        });
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          role: 'SECTION_USER',
          sectionId: section.id,
          sousLocaliteId: section.sousLocaliteId
        }
      });
      
      console.log('✅ Utilisateur mis à jour:');
      console.log('- Rôle: SECTION_USER');
      console.log('- Section:', section.name);
    } else {
      console.log('✅ Utilisateur correctement configuré');
    }
    
    console.log('\n✅ Correction terminée !');
    console.log('Vous pouvez maintenant vous reconnecter à l\'application.');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
