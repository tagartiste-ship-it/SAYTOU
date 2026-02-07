import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  const isProd = process.env.NODE_ENV === 'production';

  // Créer les tranches d'âge (distinctes des Sections)
  const tranchesAge = [
    { name: 'S1', ageMin: 0, ageMax: 12, order: 1, legacyName: '0-12' },
    { name: 'S2', ageMin: 12, ageMax: 18, order: 2, legacyName: '12-18' },
    { name: 'S3', ageMin: 18, ageMax: null as number | null, order: 3, legacyName: '18+' },
  ];

  console.log('📋 Création des tranches d\'âge...');
  for (const tranche of tranchesAge) {
    const existingNew = await prisma.trancheAge.findUnique({ where: { name: tranche.name } });

    if (existingNew) {
      await prisma.trancheAge.update({
        where: { id: existingNew.id },
        data: {
          ageMin: tranche.ageMin,
          ageMax: tranche.ageMax,
          order: tranche.order,
        },
      });
      continue;
    }

    const renamed = await prisma.trancheAge.updateMany({
      where: { name: tranche.legacyName },
      data: {
        name: tranche.name,
        ageMin: tranche.ageMin,
        ageMax: tranche.ageMax,
        order: tranche.order,
      },
    });

    if (renamed.count > 0) continue;

    await prisma.trancheAge.create({
      data: {
        name: tranche.name,
        ageMin: tranche.ageMin,
        ageMax: tranche.ageMax,
        order: tranche.order,
      },
    });
  }
  console.log(`✅ ${tranchesAge.length} tranches d'âge créées`);

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
    const existingType = await prisma.rencontreType.findFirst({
      where: {
        name: type.name,
        scopeType: null,
        scopeId: null,
      },
      select: { id: true },
    });

    if (!existingType) {
      await prisma.rencontreType.create({
        data: type,
      });
    }
  }
  console.log(`✅ ${types.length} types de rencontre créés`);

  // Cellules & Commissions (référentiel institutionnel, réel en DB)
  // Seed idempotent : upsert par (kind, code)
  console.log('🏛️ Seed du référentiel Cellules/Commissions...');
  const orgUnitDefinitions = [
    // CELLULES (S3)
    { kind: 'CELLULE' as const, code: 'CEOI', name: 'CEOI', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'SANTE', name: 'Santé', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'CORPORATIVE', name: 'Corporative', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'SYNERGIE', name: 'Synergie', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'ORGANISATION', name: 'Organisation', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'SECURITE', name: 'Sécurité', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'TECHNIQUE', name: 'Technique', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'PERE_MERE', name: 'Père et Mère', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'ACTION_SOCIALE', name: 'Action Sociale', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'FEMININE', name: 'Féminine', rubrique: 'CELLULES_S3' as const },
    { kind: 'CELLULE' as const, code: 'CSU', name: 'CSU', rubrique: 'CELLULES_S3' as const },
    // COMMISSIONS (S1+S2)
    { kind: 'COMMISSION' as const, code: 'PF', name: 'Point Focal (PF)', rubrique: 'COMMISSIONS_S1S2' as const },
    { kind: 'COMMISSION' as const, code: 'CA', name: 'Commission Administrative (CA)', rubrique: 'COMMISSIONS_S1S2' as const },
    { kind: 'COMMISSION' as const, code: 'CIPS', name: 'Commission Intelligence et de Perception Spirituelle (CIPS)', rubrique: 'COMMISSIONS_S1S2' as const },
    { kind: 'COMMISSION' as const, code: 'SA', name: 'Skills Academy (SA)', rubrique: 'COMMISSIONS_S1S2' as const },
    { kind: 'COMMISSION' as const, code: 'CTC', name: 'Commission Trésor et Capacitation (CTC)', rubrique: 'COMMISSIONS_S1S2' as const },
    { kind: 'COMMISSION' as const, code: 'CL', name: 'Commission Logistique (CL)', rubrique: 'COMMISSIONS_S1S2' as const },
  ];

  const upserted = [] as { id: string; kind: string; code: string }[];
  for (const d of orgUnitDefinitions) {
    const row = await prisma.orgUnitDefinition.upsert({
      where: { kind_code: { kind: d.kind as any, code: d.code } } as any,
      update: {
        name: d.name,
        rubrique: d.rubrique as any,
        isActive: true,
      },
      create: {
        kind: d.kind as any,
        code: d.code,
        name: d.name,
        rubrique: d.rubrique as any,
        isActive: true,
      },
      select: { id: true, kind: true, code: true },
    });
    upserted.push(row);
  }
  console.log(`✅ ${upserted.length} définitions Cellules/Commissions en base`);

  const syncOrgUnitInstances = async () => {
    // Instances auto pour toutes les Localités + Sections (idempotent)
    console.log('🔗 Génération des instances Cellules/Commissions (Localités + Sections)...');
    const [localitesAll, sectionsAll] = await Promise.all([
      prisma.localite.findMany({ select: { id: true } }),
      prisma.section.findMany({ select: { id: true } }),
    ]);

    const instanceRows: { definitionId: string; scopeType: any; scopeId: string }[] = [];
    for (const def of upserted) {
      for (const l of localitesAll) {
        instanceRows.push({ definitionId: def.id, scopeType: 'LOCALITE', scopeId: l.id });
      }
      for (const s of sectionsAll) {
        instanceRows.push({ definitionId: def.id, scopeType: 'SECTION', scopeId: s.id });
      }
    }

    if (instanceRows.length > 0) {
      // Batch insert; skipDuplicates relies on the unique index (definitionId, scopeType, scopeId)
      await prisma.orgUnitInstance.createMany({
        data: instanceRows,
        skipDuplicates: true,
      });
    }
    console.log(`✅ Instances traitées: ${instanceRows.length} (idempotent)`);
  };

  await syncOrgUnitInstances();

  if (isProd) {
    console.log('🔒 Mode production: seed terminé (aucune donnée demo/test créée).');
    return;
  }

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

  // Créer une localité exemple
  console.log('🏛️ Création de localité exemple...');
  const localite = await prisma.localite.upsert({
    where: { name: 'Mbour' },
    update: {},
    create: {
      name: 'Mbour',
    },
  });
  console.log('✅ Localité créée');

  // Rattacher le compte LOCALITÉ à sa localité (scoping)
  await prisma.user.update({
    where: { id: localiteUser.id },
    data: {
      localiteId: localite.id,
    },
  });

  // Créer une sous-localité exemple
  console.log('🏢 Création de sous-localité exemple...');
  const sousLocalite = await prisma.sousLocalite.upsert({
    where: { id: 'sl-example-1' },
    update: {},
    create: {
      id: 'sl-example-1',
      name: 'Sous-Localité Exemple',
      localiteId: localite.id,
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

  // Re-sync des instances après création demo (Mbour + section)
  await syncOrgUnitInstances();

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
