import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function testAPI() {
  console.log('========================================');
  console.log('   TEST API MEMBRES');
  console.log('========================================\n');
  
  try {
    // 1. Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: 'localite@saytou.test' },
      select: {
        id: true,
        email: true,
        role: true,
        sectionId: true,
        sousLocaliteId: true
      }
    });
    
    console.log('1. Utilisateur en base de données:');
    console.log(JSON.stringify(user, null, 2));
    console.log();
    
    // 2. Créer un token comme le ferait l'API
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '24h' }
    );
    
    console.log('2. Token JWT généré:');
    console.log(token.substring(0, 50) + '...');
    console.log();
    
    // 3. Décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    console.log('3. Token décodé:');
    console.log(JSON.stringify(decoded, null, 2));
    console.log();
    
    // 4. Simuler la requête API
    console.log('4. Simulation de la requête GET /api/membres:');
    console.log('   - userId du token:', decoded.userId);
    console.log('   - role du token:', decoded.role);
    
    if (decoded.role === 'SECTION_USER') {
      const userData = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { sectionId: true, email: true, role: true }
      });
      
      console.log('   - userData récupéré:', JSON.stringify(userData, null, 2));
      
      if (!userData?.sectionId) {
        console.log('   ❌ ERREUR: Section non définie');
        console.log('   - userData.sectionId:', userData?.sectionId);
      } else {
        console.log('   ✅ Section trouvée:', userData.sectionId);
        
        const membres = await prisma.membre.findMany({
          where: { sectionId: userData.sectionId },
          include: {
            section: {
              select: { id: true, name: true }
            }
          }
        });
        
        console.log('   ✅ Membres trouvés:', membres.length);
      }
    }
    
    console.log('\n========================================');
    console.log('   FIN DU TEST');
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPI();
