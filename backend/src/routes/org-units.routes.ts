import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

const TEMP_PASSWORD_LENGTH = 12;

const isValidDate = (d: Date) => d instanceof Date && !Number.isNaN(d.getTime());

const toIsoDateOnly = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const generateTempPassword = () => {
  return crypto.randomBytes(24).toString('base64url').slice(0, TEMP_PASSWORD_LENGTH);
};

const ORG_UNIT_DEFINITIONS = [
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
  {
    kind: 'COMMISSION' as const,
    code: 'CIPS',
    name: 'Commission Intelligence et de Perception Spirituelle (CIPS)',
    rubrique: 'COMMISSIONS_S1S2' as const,
  },
  { kind: 'COMMISSION' as const, code: 'SA', name: 'Skills Academy (SA)', rubrique: 'COMMISSIONS_S1S2' as const },
  {
    kind: 'COMMISSION' as const,
    code: 'CTC',
    name: 'Commission Trésor et Capacitation (CTC)',
    rubrique: 'COMMISSIONS_S1S2' as const,
  },
  { kind: 'COMMISSION' as const, code: 'CL', name: 'Commission Logistique (CL)', rubrique: 'COMMISSIONS_S1S2' as const },
];

const bootstrapOrgUnitsForLocalite = async (localiteId: string): Promise<{ createdDefinitions: number; createdInstances: number }> => {
  const upserted = [] as { id: string; kind: string; code: string }[];
  for (const d of ORG_UNIT_DEFINITIONS) {
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

  const sectionIds = await getLocaliteScopeSectionIds(localiteId);
  const instanceRows: { definitionId: string; scopeType: any; scopeId: string }[] = [];
  for (const def of upserted) {
    instanceRows.push({ definitionId: def.id, scopeType: 'LOCALITE', scopeId: localiteId });
    for (const sid of sectionIds) {
      instanceRows.push({ definitionId: def.id, scopeType: 'SECTION', scopeId: sid });
    }
  }

  const before = await prisma.orgUnitInstance.count({
    where: {
      OR: [{ scopeType: 'LOCALITE', scopeId: localiteId }, { scopeType: 'SECTION', scopeId: { in: sectionIds } }],
    },
  });

  if (instanceRows.length) {
    await prisma.orgUnitInstance.createMany({
      data: instanceRows,
      skipDuplicates: true,
    });
  }

  const after = await prisma.orgUnitInstance.count({
    where: {
      OR: [{ scopeType: 'LOCALITE', scopeId: localiteId }, { scopeType: 'SECTION', scopeId: { in: sectionIds } }],
    },
  });

  return {
    createdDefinitions: upserted.length,
    createdInstances: Math.max(0, after - before),
  };
};

const getLocaliteScopeSectionIds = async (localiteId: string): Promise<string[]> => {
  const sections = await prisma.section.findMany({
    where: {
      sousLocalite: {
        localiteId,
      },
    },
    select: { id: true },
  });

  return sections.map((s) => s.id);
};

const ensureLocaliteActor = async (req: AuthRequest, res: Response): Promise<string | null> => {
  const jwtLocaliteId = req.user?.localiteId ?? null;
  if (jwtLocaliteId) return jwtLocaliteId;

  // Tolérance: si le token est ancien/incomplet, on déduit la localité depuis la base.
  // Ne s'applique qu'aux comptes LOCALITE.
  if (!req.user || req.user.role !== 'LOCALITE') {
    res.status(403).json({ error: 'Compte LOCALITE non rattaché à une localité' });
    return null;
  }

  const actor = await (prisma.user as any).findUnique({
    where: { id: req.user.userId },
    select: {
      localiteId: true,
      sousLocalite: { select: { localiteId: true } },
      section: { select: { sousLocalite: { select: { localiteId: true } } } },
    },
  });

  const derivedLocaliteId =
    ((actor as any)?.localiteId as string | null | undefined) ??
    ((actor as any)?.sousLocalite?.localiteId as string | null | undefined) ??
    ((actor as any)?.section?.sousLocalite?.localiteId as string | null | undefined) ??
    null;

  if (derivedLocaliteId) {
    req.user.localiteId = derivedLocaliteId;
    return derivedLocaliteId;
  }

  // Auto-rattachement (ultra-guardé): si une seule localité existe, rattacher ce compte LOCALITE à cette localité.
  const localites = await prisma.localite.findMany({ select: { id: true }, take: 2 });
  if (localites.length === 1) {
    const onlyLocaliteId = localites[0]!.id;
    await prisma.user.update({ where: { id: req.user.userId }, data: { localiteId: onlyLocaliteId as any } });
    req.user.localiteId = onlyLocaliteId;
    return onlyLocaliteId;
  }

  res.status(403).json({ error: 'Compte LOCALITE non rattaché à une localité' });
  return null;
};

router.use(authenticate);

const canReadInstance = async (req: AuthRequest, instance: { scopeType: string; scopeId: string }): Promise<boolean> => {
  const user = req.user;
  if (!user) return false;

  if (user.role === 'OWNER') return true;

  if (user.role === 'SECTION_USER') {
    return instance.scopeType === 'SECTION' && !!user.sectionId && instance.scopeId === user.sectionId;
  }

  if (user.role === 'ORG_UNIT_RESP') {
    // Un responsable ne gère que les membres des cellules/commissions de localité auxquelles il est assigné.
    if (instance.scopeType !== 'LOCALITE') return false;
    const assignment = await prisma.orgUnitAssignment.findFirst({
      where: { userId: user.userId, instanceId: (instance as any).id ?? undefined },
      select: { id: true },
    });
    return !!assignment;
  }

  if (user.role === 'SOUS_LOCALITE_ADMIN') {
    if (!user.sousLocaliteId) return false;
    if (instance.scopeType === 'SECTION') {
      const section = await prisma.section.findUnique({ where: { id: instance.scopeId }, select: { sousLocaliteId: true } });
      return !!section && section.sousLocaliteId === user.sousLocaliteId;
    }
    return false;
  }

  if (user.role === 'LOCALITE') {
    const localiteId = user.localiteId ?? null;
    if (!localiteId) return false;
    if (instance.scopeType === 'LOCALITE') return instance.scopeId === localiteId;
    if (instance.scopeType === 'SECTION') {
      const section = await prisma.section.findUnique({
        where: { id: instance.scopeId },
        select: { sousLocalite: { select: { localiteId: true } } },
      });
      return !!section && (section as any).sousLocalite.localiteId === localiteId;
    }
    return false;
  }

  return false;
};

const canManageInstanceMembers = async (req: AuthRequest, instance: { scopeType: string; scopeId: string }): Promise<boolean> => {
  const user = req.user;
  if (!user) return false;
  if (user.role === 'OWNER') return true;

  // Règle: l'utilisateur de section gère les membres de ses cellules/commissions (scope SECTION)
  if (user.role === 'SECTION_USER') {
    return instance.scopeType === 'SECTION' && !!user.sectionId && instance.scopeId === user.sectionId;
  }

  if (user.role === 'ORG_UNIT_RESP') {
    if (instance.scopeType !== 'LOCALITE') return false;
    const assignment = await prisma.orgUnitAssignment.findFirst({
      where: { userId: user.userId, instanceId: (instance as any).id ?? undefined },
      select: { id: true },
    });
    return !!assignment;
  }

  return false;
};

router.get('/instances/:instanceId/pv', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instanceId = String(req.params.instanceId ?? '').trim();
    if (!instanceId) {
      res.status(400).json({ error: 'instanceId requis' });
      return;
    }

    const instance = await prisma.orgUnitInstance.findUnique({ where: { id: instanceId }, select: { id: true, scopeType: true, scopeId: true } });
    if (!instance) {
      res.status(404).json({ error: 'Instance non trouvée' });
      return;
    }

    if (!(await canReadInstance(req, instance as any))) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const pv = await prisma.orgUnitPv.findUnique({ where: { instanceId: instance.id } });
    res.json({ pv: pv ? { id: pv.id, instanceId: pv.instanceId, content: pv.content, updatedAt: pv.updatedAt } : null });
  } catch (error) {
    console.error('Erreur org-units/instances/:instanceId/pv GET:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du PV' });
  }
});

router.get('/instances/:instanceId/eligible-membres', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instanceId = String(req.params.instanceId ?? '').trim();
    const q = String(req.query.q ?? '').trim();
    if (!instanceId) {
      res.status(400).json({ error: 'instanceId requis' });
      return;
    }

    const instance = await prisma.orgUnitInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, scopeType: true, scopeId: true },
    });
    if (!instance) {
      res.status(404).json({ error: 'Instance non trouvée' });
      return;
    }

    // Lecture: mêmes règles que canReadInstance.
    if (!(await canReadInstance(req, instance as any))) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const whereAnd: any[] = [];
    if (instance.scopeType === 'SECTION') {
      whereAnd.push({ sectionId: instance.scopeId });
    } else if (instance.scopeType === 'LOCALITE') {
      whereAnd.push({ section: { sousLocalite: { localiteId: instance.scopeId } } });
    } else {
      res.status(400).json({ error: 'scopeType instance invalide' });
      return;
    }

    if (q) {
      whereAnd.push({
        OR: [
          { prenom: { contains: q, mode: 'insensitive' } },
          { nom: { contains: q, mode: 'insensitive' } },
          { telephone: { contains: q, mode: 'insensitive' } },
          { numeroCNI: { contains: q, mode: 'insensitive' } },
          { numeroCarteElecteur: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const membres = await prisma.membre.findMany({
      where: whereAnd.length ? { AND: whereAnd } : {},
      select: { id: true, prenom: true, nom: true, genre: true, fonction: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      take: 300,
    });

    res.json({ membres });
  } catch (error) {
    console.error('Erreur org-units/instances/:instanceId/eligible-membres:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des membres éligibles' });
  }
});

router.put('/instances/:instanceId/pv', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instanceId = String(req.params.instanceId ?? '').trim();
    const content = (req.body as any)?.content;
    if (!instanceId) {
      res.status(400).json({ error: 'instanceId requis' });
      return;
    }

    const instance = await prisma.orgUnitInstance.findUnique({ where: { id: instanceId }, select: { id: true, scopeType: true, scopeId: true } });
    if (!instance) {
      res.status(404).json({ error: 'Instance non trouvée' });
      return;
    }

    // Droits: SECTION_USER sur sa section, ORG_UNIT_RESP sur sa cellule/commission localité assignée, OWNER partout.
    const canWrite = (await canManageInstanceMembers(req, instance as any)) || (req.user?.role === 'OWNER');
    if (!canWrite) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const pv = await prisma.orgUnitPv.upsert({
      where: { instanceId: instance.id },
      update: { content: content == null ? null : String(content) },
      create: { instanceId: instance.id, content: content == null ? null : String(content) },
    });

    res.json({ pv: { id: pv.id, instanceId: pv.instanceId, content: pv.content, updatedAt: pv.updatedAt } });
  } catch (error) {
    console.error('Erreur org-units/instances/:instanceId/pv PUT:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde du PV' });
  }
});

router.get('/instances/:instanceId/pv/auto', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instanceId = String(req.params.instanceId ?? '').trim();
    const fromRaw = String(req.query.from ?? '').trim();
    const toRaw = String(req.query.to ?? '').trim();
    if (!instanceId) {
      res.status(400).json({ error: 'instanceId requis' });
      return;
    }

    const instance = await prisma.orgUnitInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        definitionId: true,
        definition: { select: { name: true, kind: true, code: true } },
      },
    });
    if (!instance) {
      res.status(404).json({ error: 'Instance non trouvée' });
      return;
    }

    if (!(await canReadInstance(req, instance as any))) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const config = await (prisma as any).orgUnitPvConfig.findUnique({
      where: { definitionId: instance.definitionId },
      select: { fields: true, typeIds: true },
    });

    const selectedFields: string[] = Array.isArray((config as any)?.fields) ? ((config as any).fields as any[]).map(String) : [];
    const typeIds: string[] = Array.isArray((config as any)?.typeIds) ? ((config as any).typeIds as any[]).map(String) : [];

    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (fromRaw && (!from || !isValidDate(from))) {
      res.status(400).json({ error: 'from invalide (ISO date attendu)' });
      return;
    }
    if (toRaw && (!to || !isValidDate(to))) {
      res.status(400).json({ error: 'to invalide (ISO date attendu)' });
      return;
    }

    const sectionIds =
      instance.scopeType === 'SECTION'
        ? [instance.scopeId]
        : instance.scopeType === 'LOCALITE'
          ? await getLocaliteScopeSectionIds(instance.scopeId)
          : [];

    if (!sectionIds.length) {
      res.json({ pvAuto: { meta: { instanceId: instance.id }, sections: [] } });
      return;
    }

    // Option 1: mapping par type. Si aucun type configuré => PV vide.
    if (!typeIds.length) {
      res.json({
        pvAuto: {
          meta: {
            instanceId: instance.id,
            definitionId: instance.definitionId,
            definition: instance.definition,
            from: from ? toIsoDateOnly(from) : null,
            to: to ? toIsoDateOnly(to) : null,
            selectedFields,
            typeIds,
          },
          sections: [],
        },
      });
      return;
    }

    const whereAnd: any[] = [{ sectionId: { in: sectionIds } }, { typeId: { in: typeIds } }];
    if (from) whereAnd.push({ date: { gte: from } });
    if (to) whereAnd.push({ date: { lte: to } });

    const needsMemberLists =
      selectedFields.includes('presents') ||
      selectedFields.includes('absents') ||
      selectedFields.includes('absentsCount') ||
      selectedFields.includes('effectifSection') ||
      selectedFields.includes('tauxPresence');

    const rencontres = await prisma.rencontre.findMany({
      where: whereAnd.length ? { AND: whereAnd } : {},
      select: {
        id: true,
        typeId: true,
        date: true,
        heureDebut: true,
        heureFin: true,
        moderateur: true,
        moniteur: true,
        theme: true,
        ordreDuJour: true,
        developpement: true,
        pvReunion: true,
        observations: true,
        attachments: true,
        presenceHomme: true,
        presenceFemme: true,
        presenceTotale: true,
        membresPresents: true,
        lieuTexte: true,
        lieuMembre: { select: { id: true, prenom: true, nom: true } },
        type: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ sectionId: 'asc' }, { date: 'asc' }, { createdAt: 'asc' }],
    });

    const sectionMembersBySectionId = new Map<string, Array<{ id: string; prenom: string; nom: string }>>();
    if (needsMemberLists) {
      const members = await prisma.membre.findMany({
        where: { sectionId: { in: sectionIds } },
        select: { id: true, prenom: true, nom: true, sectionId: true },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      });
      for (const m of members) {
        const arr = sectionMembersBySectionId.get(m.sectionId) ?? [];
        arr.push({ id: m.id, prenom: m.prenom, nom: m.nom });
        sectionMembersBySectionId.set(m.sectionId, arr);
      }
    }

    const bySectionId = new Map<string, { sectionId: string; sectionName: string; byDate: Map<string, any[]> }>();
    for (const r of rencontres as any[]) {
      const sid = r.section?.id ?? '';
      if (!sid) continue;
      const sectionName = r.section?.name ?? '';
      const dateKey = toIsoDateOnly(new Date(r.date));
      const s = bySectionId.get(sid) ?? { sectionId: sid, sectionName, byDate: new Map<string, any[]>() };
      const arr = s.byDate.get(dateKey) ?? [];
      arr.push(r);
      s.byDate.set(dateKey, arr);
      bySectionId.set(sid, s);
    }

    const buildRencontreRow = (r: any) => {
      const out: any = { id: r.id };

      const lieu = r.lieuTexte
        ? String(r.lieuTexte)
        : r.lieuMembre
          ? `${r.lieuMembre.prenom ?? ''} ${r.lieuMembre.nom ?? ''}`.trim()
          : '';

      const sectionMembers = sectionMembersBySectionId.get(r.section?.id ?? '') ?? [];
      const presentIds = new Set<string>(Array.isArray(r.membresPresents) ? r.membresPresents.map((x: any) => String(x)) : []);
      const presents = sectionMembers.filter((m) => presentIds.has(m.id));
      const absents = sectionMembers.filter((m) => !presentIds.has(m.id));
      const effectif = sectionMembers.length;
      const tauxPresence = effectif > 0 ? Math.round(((presents.length / effectif) * 100) * 100) / 100 : 0;

      for (const k of selectedFields) {
        if (k === 'type') out.type = r.type?.name ?? '';
        else if (k === 'section') out.section = r.section?.name ?? '';
        else if (k === 'date') out.date = toIsoDateOnly(new Date(r.date));
        else if (k === 'heureDebut') out.heureDebut = r.heureDebut ?? '';
        else if (k === 'heureFin') out.heureFin = r.heureFin ?? '';
        else if (k === 'lieu') out.lieu = lieu;
        else if (k === 'moderateur') out.moderateur = r.moderateur ?? '';
        else if (k === 'moniteur') out.moniteur = r.moniteur ?? '';
        else if (k === 'theme') out.theme = r.theme ?? '';
        else if (k === 'ordreDuJour') out.ordreDuJour = r.ordreDuJour ?? null;
        else if (k === 'developpement') out.developpement = r.developpement ?? '';
        else if (k === 'pvReunion') out.pvReunion = r.pvReunion ?? '';
        else if (k === 'observations') out.observations = r.observations ?? '';
        else if (k === 'attachments') out.attachments = r.attachments ?? null;
        else if (k === 'presenceHomme') out.presenceHomme = r.presenceHomme ?? 0;
        else if (k === 'presenceFemme') out.presenceFemme = r.presenceFemme ?? 0;
        else if (k === 'presenceTotale') out.presenceTotale = r.presenceTotale ?? 0;
        else if (k === 'presents') out.presents = presents.map((m) => `${m.prenom ?? ''} ${m.nom ?? ''}`.trim());
        else if (k === 'absents') out.absents = absents.map((m) => `${m.prenom ?? ''} ${m.nom ?? ''}`.trim());
        else if (k === 'absentsCount') out.absentsCount = absents.length;
        else if (k === 'effectifSection') out.effectifSection = effectif;
        else if (k === 'tauxPresence') out.tauxPresence = tauxPresence;
      }

      return out;
    };

    const sections = Array.from(bySectionId.values()).map((s) => {
      const dates = Array.from(s.byDate.entries()).map(([date, rs]) => ({
        date,
        rencontres: (rs || []).map(buildRencontreRow),
      }));
      return { sectionId: s.sectionId, sectionName: s.sectionName, dates };
    });

    res.json({
      pvAuto: {
        meta: {
          instanceId: instance.id,
          definitionId: instance.definitionId,
          definition: instance.definition,
          from: from ? toIsoDateOnly(from) : null,
          to: to ? toIsoDateOnly(to) : null,
          selectedFields,
          typeIds,
        },
        sections,
      },
    });
  } catch (error) {
    console.error('Erreur org-units/instances/:instanceId/pv/auto GET:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PV automatique' });
  }
});

router.get('/instances/me', authorize('SECTION_USER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.sectionId) {
      res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
      return;
    }

    const kind = String(req.query.kind ?? '').trim().toUpperCase();
    if (kind && kind !== 'CELLULE' && kind !== 'COMMISSION') {
      res.status(400).json({ error: 'kind invalide (CELLULE ou COMMISSION)' });
      return;
    }

    const instances = await prisma.orgUnitInstance.findMany({
      where: {
        isVisible: true,
        scopeType: 'SECTION',
        scopeId: user.sectionId,
        ...(kind ? { definition: { kind: kind as any } } : {}),
      },
      include: {
        definition: true,
        members: {
          include: {
            membre: {
              select: {
                id: true,
                prenom: true,
                nom: true,
                genre: true,
                fonction: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: [{ definition: { rubrique: 'asc' } }, { definition: { kind: 'asc' } }, { definition: { name: 'asc' } }],
    });

    res.json({ instances });
  } catch (error) {
    console.error('Erreur org-units/instances/me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des instances (section)' });
  }
});

router.get('/instances/:instanceId/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instanceId = String(req.params.instanceId ?? '').trim();
    if (!instanceId) {
      res.status(400).json({ error: 'instanceId requis' });
      return;
    }

    const instance = await prisma.orgUnitInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        definitionId: true,
        definition: { select: { kind: true, code: true } },
      },
    });
    if (!instance) {
      res.status(404).json({ error: 'Instance non trouvée' });
      return;
    }

    if (!(await canReadInstance(req, instance as any))) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const baseSelect = {
      id: true,
      createdAt: true,
      membre: {
        select: {
          id: true,
          prenom: true,
          nom: true,
          genre: true,
          fonction: true,
          telephone: true,
          section: { select: { id: true, name: true } },
        },
      },
    } as const;

    // Par défaut: membres liés à l'instance.
    let members = await prisma.orgUnitMember.findMany({
      where: { instanceId: instance.id },
      select: baseSelect,
      orderBy: [{ createdAt: 'asc' }],
    });

    // Si instance LOCALITE: inclure aussi les membres ajoutés sur les instances SECTION de la même localité (même definition).
    if (instance.scopeType === 'LOCALITE') {
      const defKind = (instance as any)?.definition?.kind ?? null;
      const defCode = (instance as any)?.definition?.code ?? null;

      const sectionInstanceIds = await prisma.orgUnitInstance.findMany({
        where: {
          isVisible: true,
          ...(defKind && defCode
            ? { definition: { kind: defKind, code: defCode } }
            : { definitionId: instance.definitionId }),
          scopeType: 'SECTION',
          scopeId: { in: await getLocaliteScopeSectionIds(instance.scopeId) },
        },
        select: { id: true },
      });

      const ids = sectionInstanceIds.map((x) => x.id);
      if (ids.length) {
        const sectionMembers = await prisma.orgUnitMember.findMany({
          where: { instanceId: { in: ids } },
          select: baseSelect,
          orderBy: [{ createdAt: 'asc' }],
        });

        const byMembreId = new Map<string, any>();
        for (const row of [...members, ...sectionMembers]) {
          const mid = row?.membre?.id;
          if (!mid) continue;
          if (!byMembreId.has(mid)) byMembreId.set(mid, row);
        }
        members = Array.from(byMembreId.values());
      }
    }

    // Enrichissement: statut Titulaire/Adjoint (via BureauAffectation) pour cette instance.
    // On ne renvoie que le(s) kind(s) trouvé(s) par membre.
    const membreIds = Array.from(
      new Set(
        members
          .map((m) => (m as any)?.membre?.id as string | undefined)
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
      )
    );

    const bureauKindsByMembreId = new Map<string, Set<string>>();
    if (membreIds.length) {
      const affectations = await prisma.bureauAffectation.findMany({
        where: {
          membreId: { in: membreIds },
          poste: {
            scopeType: 'ORG_UNIT_INSTANCE',
            scopeId: instance.id,
          },
        },
        select: {
          membreId: true,
          kind: true,
        },
      });

      for (const a of affectations) {
        const set = bureauKindsByMembreId.get(a.membreId) ?? new Set<string>();
        set.add(String(a.kind));
        bureauKindsByMembreId.set(a.membreId, set);
      }
    }

    const enrichedMembers = members.map((row: any) => {
      const mid = row?.membre?.id as string | undefined;
      const kinds = mid ? Array.from(bureauKindsByMembreId.get(mid) ?? []) : [];
      return {
        ...row,
        bureauKinds: kinds,
      };
    });

    res.json({ members: enrichedMembers });
  } catch (error) {
    console.error('Erreur org-units/instances/:instanceId/members:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des membres' });
  }
});

router.post('/instances/:instanceId/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instanceId = String(req.params.instanceId ?? '').trim();
    const membreId = String((req.body as any)?.membreId ?? '').trim();
    if (!instanceId) {
      res.status(400).json({ error: 'instanceId requis' });
      return;
    }
    if (!membreId) {
      res.status(400).json({ error: 'membreId requis' });
      return;
    }

    const instance = await prisma.orgUnitInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, scopeType: true, scopeId: true },
    });
    if (!instance) {
      res.status(404).json({ error: 'Instance non trouvée' });
      return;
    }

    if (!(await canManageInstanceMembers(req, instance as any))) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const membre = await prisma.membre.findUnique({
      where: { id: membreId },
      select: { id: true, sectionId: true, section: { select: { sousLocalite: { select: { localiteId: true } } } } },
    });
    if (!membre) {
      res.status(404).json({ error: 'Membre non trouvé' });
      return;
    }

    if (instance.scopeType === 'SECTION') {
      if (membre.sectionId !== instance.scopeId) {
        res.status(400).json({ error: 'Membre hors scope (section)' });
        return;
      }
    } else if (instance.scopeType === 'LOCALITE') {
      const localiteId = (membre as any)?.section?.sousLocalite?.localiteId ?? null;
      if (!localiteId || localiteId !== instance.scopeId) {
        res.status(400).json({ error: 'Membre hors scope (localité)' });
        return;
      }
    } else {
      res.status(400).json({ error: 'ScopeType instance invalide' });
      return;
    }

    const membership = await prisma.orgUnitMember.upsert({
      where: {
        instanceId_membreId: {
          instanceId: instance.id,
          membreId: membre.id,
        },
      },
      update: {},
      create: {
        instanceId: instance.id,
        membreId: membre.id,
      },
      include: {
        membre: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            genre: true,
            fonction: true,
          },
        },
      },
    });

    res.status(201).json({ membership });
  } catch (error) {
    console.error('Erreur org-units/instances/:instanceId/members POST:', error);
    res.status(500).json({ error: "Erreur lors de l'ajout du membre" });
  }
});

router.delete('/instances/:instanceId/members/:membreId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instanceId = String(req.params.instanceId ?? '').trim();
    const membreId = String(req.params.membreId ?? '').trim();
    if (!instanceId || !membreId) {
      res.status(400).json({ error: 'instanceId et membreId requis' });
      return;
    }

    const instance = await prisma.orgUnitInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, scopeType: true, scopeId: true },
    });
    if (!instance) {
      res.status(404).json({ error: 'Instance non trouvée' });
      return;
    }

    if (!(await canManageInstanceMembers(req, instance as any))) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    await prisma.orgUnitMember.deleteMany({
      where: {
        instanceId: instance.id,
        membreId,
      },
    });

    res.json({ message: 'Membre retiré' });
  } catch (error) {
    console.error('Erreur org-units/instances/:instanceId/members DELETE:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du membre' });
  }
});

router.get('/me', authorize('ORG_UNIT_RESP'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const assignments = await prisma.orgUnitAssignment.findMany({
      where: { userId },
      include: {
        instance: {
          include: {
            definition: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const localiteScopeIds = Array.from(
      new Set(assignments.filter((a) => a.instance.scopeType === 'LOCALITE').map((a) => a.instance.scopeId))
    );
    const sectionScopeIds = Array.from(
      new Set(assignments.filter((a) => a.instance.scopeType === 'SECTION').map((a) => a.instance.scopeId))
    );

    const [localites, sections] = await Promise.all([
      localiteScopeIds.length
        ? prisma.localite.findMany({ where: { id: { in: localiteScopeIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      sectionScopeIds.length
        ? prisma.section.findMany({ where: { id: { in: sectionScopeIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);

    const localiteNameById = new Map(localites.map((l) => [l.id, l.name] as const));
    const sectionNameById = new Map(sections.map((s) => [s.id, s.name] as const));

    const assignmentsWithScope = assignments.map((a) => {
      const scopeName =
        a.instance.scopeType === 'LOCALITE'
          ? localiteNameById.get(a.instance.scopeId) ?? null
          : sectionNameById.get(a.instance.scopeId) ?? null;

      return {
        ...a,
        instance: {
          ...a.instance,
          scopeName,
        },
      };
    });

    res.json({ assignments: assignmentsWithScope });
  } catch (error) {
    console.error('Erreur org-units/me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de mon institution' });
  }
});

router.get('/instances', authorize('LOCALITE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const localiteId = await ensureLocaliteActor(req, res);
    if (!localiteId) return;

    // Auto-bootstrap (idempotent) si aucune instance n'existe encore pour cette localité.
    const sectionIdsForScope = await getLocaliteScopeSectionIds(localiteId);
    const existingCount = await prisma.orgUnitInstance.count({
      where: {
        OR: [
          { scopeType: 'LOCALITE' as any, scopeId: localiteId },
          ...(sectionIdsForScope.length
            ? [{ scopeType: 'SECTION' as any, scopeId: { in: sectionIdsForScope } }]
            : []),
        ],
      },
    });
    if (existingCount === 0) {
      await bootstrapOrgUnitsForLocalite(localiteId);
    }

    const kind = String(req.query.kind ?? '').trim().toUpperCase();
    const scopeType = String(req.query.scopeType ?? '').trim().toUpperCase();

    if (scopeType && scopeType !== 'LOCALITE' && scopeType !== 'SECTION') {
      res.status(400).json({ error: 'scopeType invalide (LOCALITE ou SECTION)' });
      return;
    }

    if (kind && kind !== 'CELLULE' && kind !== 'COMMISSION') {
      res.status(400).json({ error: 'kind invalide (CELLULE ou COMMISSION)' });
      return;
    }

    const sectionIds = await getLocaliteScopeSectionIds(localiteId);

    const instances = await prisma.orgUnitInstance.findMany({
      where: {
        isVisible: true,
        ...(scopeType
          ? {
              scopeType: scopeType as any,
              ...(scopeType === 'LOCALITE' ? { scopeId: localiteId } : { scopeId: { in: sectionIds } }),
            }
          : {
              OR: [
                { scopeType: 'LOCALITE', scopeId: localiteId },
                { scopeType: 'SECTION', scopeId: { in: sectionIds } },
              ],
            }),
        ...(kind ? { definition: { kind: kind as any } } : {}),
      },
      include: {
        definition: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                localiteId: true,
              },
            },
          },
          orderBy: [{ positionIndex: 'asc' }, { createdAt: 'asc' }],
        },
        members: {
          include: {
            membre: {
              select: {
                id: true,
                prenom: true,
                nom: true,
                genre: true,
                fonction: true,
                section: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: [{ definition: { rubrique: 'asc' } }, { definition: { kind: 'asc' } }, { definition: { name: 'asc' } }],
    });

    res.json({ instances });
  } catch (error) {
    console.error('Erreur org-units/instances:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des instances' });
  }
});

router.post('/bootstrap', authorize('LOCALITE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const localiteId = await ensureLocaliteActor(req, res);
    if (!localiteId) return;

    const result = await bootstrapOrgUnitsForLocalite(localiteId);
    res.json({ message: 'Bootstrap effectué', ...result });
  } catch (error) {
    console.error('Erreur org-units/bootstrap:', error);
    res.status(500).json({ error: 'Erreur lors du bootstrap Cellules/Commissions' });
  }
});

router.get('/owner/instances', authorize('OWNER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instances = await prisma.orgUnitInstance.findMany({
      where: { isVisible: true },
      include: {
        definition: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const localiteIds = Array.from(new Set(instances.filter((i) => i.scopeType === 'LOCALITE').map((i) => i.scopeId)));
    const sectionIds = Array.from(new Set(instances.filter((i) => i.scopeType === 'SECTION').map((i) => i.scopeId)));

    const [localites, sections] = await Promise.all([
      localiteIds.length
        ? prisma.localite.findMany({ where: { id: { in: localiteIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      sectionIds.length
        ? prisma.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);

    const localiteNameById = new Map(localites.map((l) => [l.id, l.name] as const));
    const sectionNameById = new Map(sections.map((s) => [s.id, s.name] as const));

    const instancesWithScope = instances.map((i) => {
      const scopeName =
        i.scopeType === 'LOCALITE'
          ? localiteNameById.get(i.scopeId) ?? null
          : i.scopeType === 'SECTION'
            ? sectionNameById.get(i.scopeId) ?? null
            : null;
      return {
        ...i,
        scopeName,
      };
    });

    res.json({ instances: instancesWithScope });
  } catch (error) {
    console.error('Erreur org-units/owner/instances:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des instances (OWNER)' });
  }
});

router.get('/responsables', authorize('LOCALITE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const localiteId = await ensureLocaliteActor(req, res);
    if (!localiteId) return;

    const users = await (prisma.user as any).findMany({
      where: {
        role: 'ORG_UNIT_RESP',
        localiteId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        localiteId: true,
        mustChangePassword: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  } catch (error) {
    console.error('Erreur org-units/responsables:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des responsables' });
  }
});

router.post('/responsables', authorize('LOCALITE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const localiteId = await ensureLocaliteActor(req, res);
    if (!localiteId) return;

    const email = String((req.body as any)?.email ?? '').trim().toLowerCase();
    const name = String((req.body as any)?.name ?? '').trim();

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Email invalide' });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'Nom requis' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Cet email est déjà utilisé' });
      return;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: 'ORG_UNIT_RESP' as any,
        passwordHash,
        localiteId,
        mustChangePassword: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        localiteId: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    res.status(201).json({ message: 'Compte responsable créé', user, tempPassword });
  } catch (error) {
    console.error('Erreur création responsable:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte responsable' });
  }
});

router.post('/assignments', authorize('LOCALITE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const localiteId = await ensureLocaliteActor(req, res);
    if (!localiteId) return;

    const instanceId = String((req.body as any)?.instanceId ?? '').trim();
    const userId = String((req.body as any)?.userId ?? '').trim();
    const positionIndexRaw = (req.body as any)?.positionIndex;
    const positionIndex = Number.isFinite(positionIndexRaw) ? Number(positionIndexRaw) : 0;

    if (!instanceId || !userId) {
      res.status(400).json({ error: 'instanceId et userId requis' });
      return;
    }

    const [sectionIds, user, instance] = await Promise.all([
      getLocaliteScopeSectionIds(localiteId),
      (prisma.user as any).findUnique({
        where: { id: userId },
        select: { id: true, role: true, localiteId: true },
      }),
      prisma.orgUnitInstance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          scopeType: true,
          scopeId: true,
        },
      }),
    ]);

    if (!user || user.role !== 'ORG_UNIT_RESP') {
      res.status(400).json({ error: 'Utilisateur cible invalide (ORG_UNIT_RESP requis)' });
      return;
    }

    if ((user as any).localiteId !== localiteId) {
      res.status(403).json({ error: 'Responsable hors de votre localité' });
      return;
    }

    if (!instance) {
      res.status(404).json({ error: 'Instance introuvable' });
      return;
    }

    const allowed =
      (instance.scopeType === 'LOCALITE' && instance.scopeId === localiteId) ||
      (instance.scopeType === 'SECTION' && sectionIds.includes(instance.scopeId));

    if (!allowed) {
      res.status(403).json({ error: 'Instance hors de votre scope' });
      return;
    }

    const assignment = await prisma.orgUnitAssignment.upsert({
      where: { instanceId_userId: { instanceId, userId } } as any,
      update: {
        positionIndex,
      },
      create: {
        instanceId,
        userId,
        positionIndex,
      },
      include: {
        instance: {
          include: {
            definition: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            localiteId: true,
          },
        },
      },
    });

    res.status(201).json({ message: 'Assignation enregistrée', assignment });
  } catch (error) {
    console.error('Erreur org-units/assignments:', error);
    res.status(500).json({ error: 'Erreur lors de l’assignation' });
  }
});

router.delete('/assignments', authorize('LOCALITE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const localiteId = await ensureLocaliteActor(req, res);
    if (!localiteId) return;

    const instanceId = String((req.body as any)?.instanceId ?? '').trim();
    const userId = String((req.body as any)?.userId ?? '').trim();

    if (!instanceId || !userId) {
      res.status(400).json({ error: 'instanceId et userId requis' });
      return;
    }

    const [sectionIds, user, instance] = await Promise.all([
      getLocaliteScopeSectionIds(localiteId),
      (prisma.user as any).findUnique({
        where: { id: userId },
        select: { id: true, role: true, localiteId: true },
      }),
      prisma.orgUnitInstance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          scopeType: true,
          scopeId: true,
        },
      }),
    ]);

    if (!user || user.role !== 'ORG_UNIT_RESP') {
      res.status(400).json({ error: 'Utilisateur cible invalide (ORG_UNIT_RESP requis)' });
      return;
    }

    if ((user as any).localiteId !== localiteId) {
      res.status(403).json({ error: 'Responsable hors de votre localité' });
      return;
    }

    if (!instance) {
      res.status(404).json({ error: 'Instance introuvable' });
      return;
    }

    const allowed =
      (instance.scopeType === 'LOCALITE' && instance.scopeId === localiteId) ||
      (instance.scopeType === 'SECTION' && sectionIds.includes(instance.scopeId));

    if (!allowed) {
      res.status(403).json({ error: 'Instance hors de votre scope' });
      return;
    }

    await prisma.orgUnitAssignment.delete({
      where: { instanceId_userId: { instanceId, userId } } as any,
    });

    res.json({ message: 'Désassignation effectuée' });
  } catch (error) {
    console.error('Erreur org-units/assignments delete:', error);
    res.status(500).json({ error: 'Erreur lors de la désassignation' });
  }
});

export default router;
