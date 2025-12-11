import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  // Créer les types de rencontre
  const types = [
    { name: 'GOUDI ALDIOUMA', isReunion: false },
    { name: 'KHADARATOUL DJOUMA', isReunion: false },
    { name: 'RÉUNION BUREAU', isReunion: true },
    { name: 'RÉUNION SECTION', isReunion: true },
    { name: 'TOURE CELLULE FÉMININE', isReunion: false },
    { name: 'ÉCOLE (DAARA)', isReunion: false },
    { name: 'TOURE MJ', isReunion: false },
    { name: 'TOURNÉ', isReunion: false },
  ];

  console.log('📋 Création des types de rencontre...');
  for (const type of types) {
    await prisma.rencontreType.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    });
  }
  console.log(`✅ ${types.length} types de rencontre créés`);

  // Créer l'utilisateur LOCALITÉ (Super Admin)
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  
  console.log('👤 Création du compte LOCALITÉ...');
  const localiteUser = await prisma.user.upsert({
    where: { email: 'localite@saytou.test' },
    update: {},
    create: {
      email: 'localite@saytou.test',
      passwordHash,
      role: 'LOCALITE',
      name: 'LOCALITE',
    },
  });
  console.log('✅ Compte LOCALITÉ créé');

  // Créer une sous-localité exemple
  console.log('🏢 Création de sous-localité exemple...');
  const sousLocalite = await prisma.sousLocalite.upsert({
    where: { id: 'sl-example-1' },
    update: {},
    create: {
      id: 'sl-example-1',
      name: 'Sous-Localité Exemple',
      createdById: localiteUser.id,
    },
  });
  console.log('✅ Sous-localité créée');

  // Créer un admin de sous-localité
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  console.log('👤 Création du compte admin sous-localité...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@saytou.test' },
    update: {},
    create: {
      email: 'admin@saytou.test',
      passwordHash: adminPasswordHash,
      role: 'SOUS_LOCALITE_ADMIN',
      name: 'Admin Sous-Localité',
      sousLocaliteId: sousLocalite.id,
    },
  });
  console.log('✅ Compte admin créé');

  // Créer une section exemple
  console.log('📍 Création de section exemple...');
  const section = await prisma.section.upsert({
    where: { id: 'sec-example-1' },
    update: {},
    create: {
      id: 'sec-example-1',
      name: 'Section A',
      sousLocaliteId: sousLocalite.id,
      createdById: adminUser.id,
    },
  });
  console.log('✅ Section créée');

  // Créer un utilisateur de section
  const userPasswordHash = await bcrypt.hash('User123!', 10);
  console.log('👤 Création du compte utilisateur section...');
  await prisma.user.upsert({
    where: { email: 'user@saytou.test' },
    update: {
      sectionId: section.id,
      sousLocaliteId: sousLocalite.id,
      role: 'SECTION_USER',
    },
    create: {
      email: 'user@saytou.test',
      passwordHash: userPasswordHash,
      role: 'SECTION_USER',
      name: 'Utilisateur Section',
      sousLocaliteId: sousLocalite.id,
      sectionId: section.id,
    },
  });
  console.log('✅ Compte utilisateur créé');

  console.log('\n🎉 Seed terminé avec succès!\n');
  console.log('📧 Comptes créés:');
  console.log('   - localite@saytou.test / ChangeMe123! (LOCALITÉ)');
  console.log('   - admin@saytou.test / Admin123! (SOUS_LOCALITE_ADMIN)');
  console.log('   - user@saytou.test / User123! (SECTION_USER)');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
