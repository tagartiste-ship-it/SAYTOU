import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

const db = prisma as any;

const PV_FIELD_GROUPS = [
  {
    group: 'Contexte',
    fields: [
      { key: 'type', label: 'Type de rencontre' },
      { key: 'section', label: 'Section' },
      { key: 'date', label: 'Date' },
      { key: 'heureDebut', label: 'Heure début' },
      { key: 'heureFin', label: 'Heure fin' },
      { key: 'lieu', label: 'Lieu' },
    ],
  },
  {
    group: 'Encadrement',
    fields: [
      { key: 'moderateur', label: 'Modérateur' },
      { key: 'moniteur', label: 'Moniteur' },
    ],
  },
  {
    group: 'Contenu',
    fields: [
      { key: 'theme', label: 'Thème' },
      { key: 'ordreDuJour', label: 'Ordre du jour' },
      { key: 'developpement', label: 'Développement' },
      { key: 'pvReunion', label: 'PV réunion' },
      { key: 'observations', label: 'Observations' },
      { key: 'attachments', label: 'Pièces jointes' },
    ],
  },
  {
    group: 'Présences',
    fields: [
      { key: 'presenceHomme', label: 'Présence hommes' },
      { key: 'presenceFemme', label: 'Présence femmes' },
      { key: 'presenceTotale', label: 'Présence totale' },
      { key: 'presents', label: 'Liste des présents' },
      { key: 'absentsCount', label: "Nombre d'absents" },
      { key: 'absents', label: 'Liste des absents' },
      { key: 'effectifSection', label: 'Effectif section' },
      { key: 'tauxPresence', label: 'Taux de présence' },
    ],
  },
] as const;

const PV_FIELD_KEYS = Array.from(new Set(PV_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key))));

router.use(authenticate);
router.use(authorize('OWNER'));

const normalizeName = (value: unknown) => String(value ?? '').trim();

router.get('/conclaves', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conclaves = await db.conclave.findMany({
      include: {
        zones: {
          include: {
            comites: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ conclaves });
  } catch (error) {
    console.error('Erreur récupération conclaves:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des conclaves' });
  }
});

router.get('/org-units/pv-fields', async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ groups: PV_FIELD_GROUPS, keys: PV_FIELD_KEYS });
});

router.get('/org-units/pv-configs', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const definitions = await db.orgUnitDefinition.findMany({
      where: { isActive: true },
      include: { pvConfig: { select: { id: true, fields: true, typeIds: true, updatedAt: true } } },
      orderBy: [{ rubrique: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
    });

    const rows = (definitions || []).map((d: any) => ({
      definition: {
        id: d.id,
        kind: d.kind,
        code: d.code,
        name: d.name,
        rubrique: d.rubrique,
      },
      config: d.pvConfig
        ? { id: d.pvConfig.id, fields: d.pvConfig.fields, typeIds: d.pvConfig.typeIds, updatedAt: d.pvConfig.updatedAt }
        : null,
    }));

    res.json({ rows });
  } catch (error) {
    console.error('Erreur récupération pv configs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des configurations PV' });
  }
});

router.put('/org-units/pv-configs/:definitionId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const definitionId = String(req.params.definitionId ?? '').trim();
    if (!definitionId) {
      res.status(400).json({ error: 'definitionId requis' });
      return;
    }

    const fieldsRaw = (req.body as any)?.fields;
    const fields = Array.isArray(fieldsRaw) ? fieldsRaw.map((x) => String(x).trim()).filter(Boolean) : [];

    const typeIdsRaw = (req.body as any)?.typeIds;
    const typeIds = Array.isArray(typeIdsRaw) ? typeIdsRaw.map((x) => String(x).trim()).filter(Boolean) : [];

    const invalid = fields.filter((k) => !PV_FIELD_KEYS.includes(k as any));
    if (invalid.length) {
      res.status(400).json({ error: `Champs PV invalides: ${invalid.join(', ')}` });
      return;
    }

    const definition = await db.orgUnitDefinition.findUnique({ where: { id: definitionId }, select: { id: true } });
    if (!definition) {
      res.status(404).json({ error: 'Définition non trouvée' });
      return;
    }

    const config = await db.orgUnitPvConfig.upsert({
      where: { definitionId },
      update: { fields, typeIds: typeIds.length ? typeIds : null },
      create: { definitionId, fields, typeIds: typeIds.length ? typeIds : null },
      select: { id: true, definitionId: true, fields: true, typeIds: true, updatedAt: true },
    });

    res.json({ config });
  } catch (error) {
    console.error('Erreur sauvegarde pv config:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de la configuration PV' });
  }
});

router.post('/conclaves', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = normalizeName(req.body?.name);

    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }

    const existing = await db.conclave.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing) {
      res.status(400).json({ error: 'Un conclave avec ce nom existe déjà' });
      return;
    }

    const conclave = await db.conclave.create({
      data: { name },
    });

    res.status(201).json({ message: 'Conclave créé avec succès', conclave });
  } catch (error) {
    console.error('Erreur création conclave:', error);
    res.status(500).json({ error: 'Erreur lors de la création du conclave' });
  }
});

router.put('/conclaves/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const name = normalizeName(req.body?.name);

    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }

    const existing = await db.conclave.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        NOT: { id },
      },
      select: { id: true },
    });

    if (existing) {
      res.status(400).json({ error: 'Un conclave avec ce nom existe déjà' });
      return;
    }

    const conclave = await db.conclave.update({
      where: { id },
      data: { name },
    });

    res.json({ message: 'Conclave modifié avec succès', conclave });
  } catch (error) {
    console.error('Erreur modification conclave:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du conclave' });
  }
});

router.delete('/conclaves/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await db.conclave.delete({ where: { id } });

    res.json({ message: 'Conclave supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression conclave:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du conclave' });
  }
});

router.get('/zones', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conclaveId = typeof req.query.conclaveId === 'string' ? req.query.conclaveId : '';

    const zones = await db.zone.findMany({
      where: conclaveId ? { conclaveId } : {},
      include: {
        conclave: true,
        comites: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ zones });
  } catch (error) {
    console.error('Erreur récupération zones:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des zones' });
  }
});

router.post('/zones', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = normalizeName(req.body?.name);
    const conclaveId = String(req.body?.conclaveId ?? '').trim();

    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }

    if (!conclaveId) {
      res.status(400).json({ error: 'conclaveId requis' });
      return;
    }

    const conclave = await db.conclave.findUnique({ where: { id: conclaveId }, select: { id: true } });
    if (!conclave) {
      res.status(400).json({ error: 'conclaveId invalide' });
      return;
    }

    const existing = await db.zone.findFirst({
      where: {
        conclaveId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existing) {
      res.status(400).json({ error: 'Une zone avec ce nom existe déjà dans ce conclave' });
      return;
    }

    const zone = await db.zone.create({
      data: { name, conclaveId },
      include: { conclave: true },
    });

    res.status(201).json({ message: 'Zone créée avec succès', zone });
  } catch (error) {
    console.error('Erreur création zone:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la zone' });
  }
});

router.put('/zones/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const name = normalizeName(req.body?.name);
    const conclaveId = String(req.body?.conclaveId ?? '').trim();

    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }

    if (!conclaveId) {
      res.status(400).json({ error: 'conclaveId requis' });
      return;
    }

    const conclave = await db.conclave.findUnique({ where: { id: conclaveId }, select: { id: true } });
    if (!conclave) {
      res.status(400).json({ error: 'conclaveId invalide' });
      return;
    }

    const existing = await db.zone.findFirst({
      where: {
        conclaveId,
        name: { equals: name, mode: 'insensitive' },
        NOT: { id },
      },
      select: { id: true },
    });

    if (existing) {
      res.status(400).json({ error: 'Une zone avec ce nom existe déjà dans ce conclave' });
      return;
    }

    const zone = await db.zone.update({
      where: { id },
      data: { name, conclaveId },
      include: { conclave: true },
    });

    res.json({ message: 'Zone modifiée avec succès', zone });
  } catch (error) {
    console.error('Erreur modification zone:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de la zone' });
  }
});

router.delete('/zones/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await db.zone.delete({ where: { id } });

    res.json({ message: 'Zone supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression zone:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la zone' });
  }
});

router.get('/comites', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const zoneId = typeof req.query.zoneId === 'string' ? req.query.zoneId : '';

    const comites = await db.comite.findMany({
      where: zoneId ? { zoneId } : {},
      include: {
        zone: {
          include: {
            conclave: true,
          },
        },
        localites: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ comites });
  } catch (error) {
    console.error('Erreur récupération comites:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des comites' });
  }
});

router.post('/comites', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = normalizeName(req.body?.name);
    const zoneId = String(req.body?.zoneId ?? '').trim();

    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }

    if (!zoneId) {
      res.status(400).json({ error: 'zoneId requis' });
      return;
    }

    const zone = await db.zone.findUnique({ where: { id: zoneId }, select: { id: true } });
    if (!zone) {
      res.status(400).json({ error: 'zoneId invalide' });
      return;
    }

    const existing = await db.comite.findFirst({
      where: {
        zoneId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existing) {
      res.status(400).json({ error: 'Un comite avec ce nom existe déjà dans cette zone' });
      return;
    }

    const comite = await db.comite.create({
      data: { name, zoneId },
      include: {
        zone: {
          include: {
            conclave: true,
          },
        },
      },
    });

    res.status(201).json({ message: 'Comite créé avec succès', comite });
  } catch (error) {
    console.error('Erreur création comite:', error);
    res.status(500).json({ error: 'Erreur lors de la création du comite' });
  }
});

router.put('/comites/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const name = normalizeName(req.body?.name);
    const zoneId = String(req.body?.zoneId ?? '').trim();

    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }

    if (!zoneId) {
      res.status(400).json({ error: 'zoneId requis' });
      return;
    }

    const zone = await db.zone.findUnique({ where: { id: zoneId }, select: { id: true } });
    if (!zone) {
      res.status(400).json({ error: 'zoneId invalide' });
      return;
    }

    const existing = await db.comite.findFirst({
      where: {
        zoneId,
        name: { equals: name, mode: 'insensitive' },
        NOT: { id },
      },
      select: { id: true },
    });

    if (existing) {
      res.status(400).json({ error: 'Un comite avec ce nom existe déjà dans cette zone' });
      return;
    }

    const comite = await db.comite.update({
      where: { id },
      data: { name, zoneId },
      include: {
        zone: {
          include: {
            conclave: true,
          },
        },
      },
    });

    res.json({ message: 'Comite modifié avec succès', comite });
  } catch (error) {
    console.error('Erreur modification comite:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du comite' });
  }
});

router.delete('/comites/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await db.comite.delete({ where: { id } });

    res.json({ message: 'Comite supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression comite:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du comite' });
  }
});

router.get('/localites', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const localites = await db.localite.findMany({
      include: {
        comite: {
          include: {
            zone: {
              include: {
                conclave: true,
              },
            },
          },
        },
        _count: { select: { sousLocalites: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ localites });
  } catch (error) {
    console.error('Erreur récupération localites:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des localites' });
  }
});

router.put('/localites/:id/comite', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const comiteId = req.body?.comiteId == null ? null : String(req.body?.comiteId).trim();

    if (comiteId) {
      const comite = await db.comite.findUnique({ where: { id: comiteId }, select: { id: true } });
      if (!comite) {
        res.status(400).json({ error: 'comiteId invalide' });
        return;
      }
    }

    const localite = await db.localite.update({
      where: { id },
      data: { comiteId },
      include: {
        comite: {
          include: {
            zone: {
              include: {
                conclave: true,
              },
            },
          },
        },
      },
    });

    res.json({ message: 'Localite rattachée au comite avec succès', localite });
  } catch (error) {
    console.error('Erreur rattachement localite->comite:', error);
    res.status(500).json({ error: 'Erreur lors du rattachement de la localite au comite' });
  }
});

router.get('/sections', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sections = await db.section.findMany({
      include: {
        sousLocalite: {
          include: {
            localite: {
              include: {
                comite: {
                  include: {
                    zone: {
                      include: {
                        conclave: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: { select: { membres: true, rencontres: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ sections });
  } catch (error) {
    console.error('Erreur récupération sections institutions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sections' });
  }
});

router.get('/org-units/definitions', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const definitions = await db.orgUnitDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ rubrique: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
    });

    res.json({ definitions });
  } catch (error) {
    console.error('Erreur récupération org unit definitions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des définitions' });
  }
});

router.get('/org-units/instances', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scopeType = String(req.query.scopeType ?? '').trim().toUpperCase();
    const scopeId = String(req.query.scopeId ?? '').trim();

    if (!scopeId) {
      res.status(400).json({ error: 'scopeId requis' });
      return;
    }

    if (scopeType !== 'LOCALITE' && scopeType !== 'SECTION') {
      res.status(400).json({ error: 'scopeType invalide (LOCALITE ou SECTION)' });
      return;
    }

    const instances = await db.orgUnitInstance.findMany({
      where: { scopeType, scopeId, isVisible: true },
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
              },
            },
          },
          orderBy: [{ positionIndex: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ definition: { rubrique: 'asc' } }, { definition: { kind: 'asc' } }, { definition: { name: 'asc' } }],
    });

    res.json({ scopeType, scopeId, instances });
  } catch (error) {
    console.error('Erreur récupération org unit instances:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des instances' });
  }
});

export default router;
