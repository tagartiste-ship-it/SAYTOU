import { Router, Request, Response } from 'express';
import prismaRaw from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const prisma: any = prismaRaw;

type AgeTranche = 'S1' | 'S2' | 'S3' | null;

const normalizeAgeTranche = (value: unknown): AgeTranche => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'S1' || v === 'S2' || v === 'S3') return v as AgeTranche;
  return null;
};

const computeAge = (dateNaissance?: Date | null): number | null => {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age -= 1;
  }
  if (age < 0) return null;
  return age;
};

const computeAgeTranche = (age: number | null): AgeTranche => {
  if (age === null) return null;
  if (age < 12) return 'S1';
  if (age < 18) return 'S2';
  return 'S3';
};

const parseOptionalDate = (value: unknown) => {
  if (value == null || String(value).trim() === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};

const normalizeLoose = (value: unknown): string => {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }

  return dp[b.length];
};
router.get('/corps-metiers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const sectionIdParam = String(req.query.sectionId ?? '').trim();

    const where: any = {
      corpsMetier: {
        not: null,
      },
    };

    if (user.role === 'SECTION_USER') {
      if (!user.sectionId) {
        res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
        return;
      }
      where.sectionId = user.sectionId;
    } else if (user.role === 'SOUS_LOCALITE_ADMIN') {
      if (!user.sousLocaliteId) {
        res.status(403).json({ error: 'Sous-localité non définie pour cet utilisateur' });
        return;
      }

      if (sectionIdParam) {
        const section = await prisma.section.findUnique({
          where: { id: sectionIdParam },
          select: { sousLocaliteId: true },
        });
        if (!section || section.sousLocaliteId !== user.sousLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
        where.sectionId = sectionIdParam;
      } else {
        where.section = { sousLocaliteId: user.sousLocaliteId };
      }
    } else if (user.role === 'LOCALITE' || user.role === 'ORG_UNIT_RESP') {
      const creatorUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          localiteId: true,
          sousLocalite: { select: { localiteId: true } },
          section: { select: { sousLocalite: { select: { localiteId: true } } } },
        },
      });

      let localiteId =
        (user as any)?.localiteId ??
        (creatorUser as any)?.localiteId ??
        (creatorUser as any)?.sousLocalite?.localiteId ??
        (creatorUser as any)?.section?.sousLocalite?.localiteId ??
        null;
      if (!localiteId) {
        const anySousLocalite = await prisma.sousLocalite.findFirst({
          where: { createdById: user.userId },
          select: { localiteId: true },
          orderBy: { createdAt: 'asc' },
        });
        localiteId = (anySousLocalite as any)?.localiteId ?? null;
      }

      if (!localiteId) {
        res.status(403).json({ error: 'Localité non définie pour cet utilisateur' });
        return;
      }

      if (sectionIdParam) {
        const section = await prisma.section.findUnique({
          where: { id: sectionIdParam },
          select: { sousLocalite: { select: { localiteId: true } } },
        });
        if (!section || (section as any).sousLocalite.localiteId !== localiteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
        where.sectionId = sectionIdParam;
      } else {
        where.section = { sousLocalite: { localiteId } };
      }
    } else {
      if (!sectionIdParam) {
        res.status(400).json({ error: 'sectionId requis' });
        return;
      }
      where.sectionId = sectionIdParam;
    }

    const rows = await prisma.membre.findMany({
      where,
      distinct: ['corpsMetier'],
      select: {
        corpsMetier: true,
      },
      orderBy: {
        corpsMetier: 'asc',
      },
    });

    const rawValues = (rows as any[])
      .map((r) => String(r.corpsMetier ?? '').trim())
      .filter((v) => v);

    // Fusion: mêmes valeurs (casse/accents/espaces) + fautes mineures (distance Levenshtein)
    const countsByRaw = new Map<string, number>();
    for (const v of rawValues) countsByRaw.set(v, (countsByRaw.get(v) ?? 0) + 1);

    const uniqueRaw = Array.from(countsByRaw.keys());

    type Cluster = { key: string; items: Array<{ raw: string; norm: string; count: number }> };
    const clusters: Cluster[] = [];

    const maxDistFor = (s: string) => {
      if (s.length <= 4) return 0;
      if (s.length <= 7) return 1;
      if (s.length <= 12) return 2;
      return 3;
    };

    for (const raw of uniqueRaw) {
      const norm = normalizeLoose(raw);
      if (!norm) continue;

      let found: Cluster | null = null;
      for (const c of clusters) {
        const d = levenshtein(norm, c.key);
        const maxDist = Math.min(maxDistFor(norm), maxDistFor(c.key));
        if (d <= maxDist) {
          found = c;
          break;
        }
      }

      const item = { raw, norm, count: countsByRaw.get(raw) ?? 1 };
      if (found) found.items.push(item);
      else clusters.push({ key: norm, items: [item] });
    }

    const corpsMetiers = clusters
      .map((c) => {
        // Canonique: la variante la plus fréquente, à défaut la plus courte
        const sorted = [...c.items].sort((a, b) => (b.count - a.count) || (a.raw.length - b.raw.length) || a.raw.localeCompare(b.raw));
        return sorted[0]!.raw;
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

    res.json({ corpsMetiers });
  } catch (error: any) {
    console.error('Erreur récupération corps de métier:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/groupes-sanguins', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const sectionIdParam = String(req.query.sectionId ?? '').trim();

    const where: any = {
      groupeSanguin: {
        not: null,
      },
    };

    if (user.role === 'SECTION_USER') {
      if (!user.sectionId) {
        res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
        return;
      }
      where.sectionId = user.sectionId;
    } else if (user.role === 'SOUS_LOCALITE_ADMIN') {
      if (!user.sousLocaliteId) {
        res.status(403).json({ error: 'Sous-localité non définie pour cet utilisateur' });
        return;
      }

      if (sectionIdParam) {
        const section = await prisma.section.findUnique({
          where: { id: sectionIdParam },
          select: { sousLocaliteId: true },
        });
        if (!section || section.sousLocaliteId !== user.sousLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
        where.sectionId = sectionIdParam;
      } else {
        where.section = { sousLocaliteId: user.sousLocaliteId };
      }
    } else if (user.role === 'LOCALITE' || user.role === 'ORG_UNIT_RESP') {
      const creatorUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          localiteId: true,
          sousLocalite: { select: { localiteId: true } },
          section: { select: { sousLocalite: { select: { localiteId: true } } } },
        },
      });

      let localiteId =
        (user as any)?.localiteId ??
        (creatorUser as any)?.localiteId ??
        (creatorUser as any)?.sousLocalite?.localiteId ??
        (creatorUser as any)?.section?.sousLocalite?.localiteId ??
        null;
      if (!localiteId) {
        const anySousLocalite = await prisma.sousLocalite.findFirst({
          where: { createdById: user.userId },
          select: { localiteId: true },
          orderBy: { createdAt: 'asc' },
        });
        localiteId = (anySousLocalite as any)?.localiteId ?? null;
      }

      if (!localiteId) {
        res.status(403).json({ error: 'Localité non définie pour cet utilisateur' });
        return;
      }

      if (sectionIdParam) {
        const section = await prisma.section.findUnique({
          where: { id: sectionIdParam },
          select: { sousLocalite: { select: { localiteId: true } } },
        });
        if (!section || (section as any).sousLocalite.localiteId !== localiteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
        where.sectionId = sectionIdParam;
      } else {
        where.section = { sousLocalite: { localiteId } };
      }
    } else {
      if (!sectionIdParam) {
        res.status(400).json({ error: 'sectionId requis' });
        return;
      }
      where.sectionId = sectionIdParam;
    }

    const rows = await prisma.membre.findMany({
      where,
      distinct: ['groupeSanguin'],
      select: {
        groupeSanguin: true,
      },
      orderBy: {
        groupeSanguin: 'asc',
      },
    });

    const groupesSanguins = (rows as any[])
      .map((r) => String(r.groupeSanguin ?? '').trim())
      .filter((v) => v);

    res.json({ groupesSanguins });
  } catch (error: any) {
    console.error('Erreur récupération groupes sanguins:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/participations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const typeId = String(req.query.typeId ?? '').trim();
    const requestedSectionId = String(req.query.sectionId ?? '').trim();

    let finalSectionId = '';
    if (user.role === 'SECTION_USER') {
      if (!user.sectionId) {
        res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
        return;
      }
      finalSectionId = user.sectionId;
    } else {
      if (!requestedSectionId) {
        res.status(400).json({ error: 'sectionId requis' });
        return;
      }
      finalSectionId = requestedSectionId;
    }

    const membres = await prisma.membre.findMany({
      where: { sectionId: finalSectionId },
      select: {
        id: true,
        prenom: true,
        nom: true,
        genre: true,
        fonction: true,
        sectionId: true,
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });

    if (!typeId) {
      res.json({
        typeId: null,
        sectionId: finalSectionId,
        membres: membres.map((m) => ({ ...m, count: 0, rencontres: [] })),
      });
      return;
    }

    const rencontres = await prisma.rencontre.findMany({
      where: {
        typeId,
        sectionId: finalSectionId,
      },
      select: {
        id: true,
        date: true,
        heureDebut: true,
        heureFin: true,
        moderateur: true,
        moniteur: true,
        theme: true,
        ordreDuJour: true,
        membresPresents: true,
        createdAt: true,
      },
      orderBy: [{ date: 'desc' }],
      take: 200,
    });

    const map = new Map<string, { count: number; rencontres: any[] }>();
    for (const m of membres) {
      map.set(m.id, { count: 0, rencontres: [] });
    }

    for (const r of rencontres as any[]) {
      const presentIds = Array.isArray(r.membresPresents) ? (r.membresPresents as string[]) : [];
      for (const id of presentIds) {
        const entry = map.get(id);
        if (!entry) continue;
        entry.count += 1;
        entry.rencontres.push({
          id: r.id,
          date: r.date,
          heureDebut: r.heureDebut,
          heureFin: r.heureFin,
          moderateur: r.moderateur,
          moniteur: r.moniteur,
          theme: r.theme,
          ordreDuJour: r.ordreDuJour,
        });
      }
    }

    res.json({
      typeId,
      sectionId: finalSectionId,
      membres: membres.map((m) => {
        const entry = map.get(m.id) || { count: 0, rencontres: [] };
        return { ...m, count: entry.count, rencontres: entry.rencontres };
      }),
    });
  } catch (error: any) {
    console.error('Erreur participations membres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer tous les membres d'une section
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    const q = String(req.query.q ?? '').trim();
    const genre = String(req.query.genre ?? '').trim();
    const fonction = String(req.query.fonction ?? '').trim();
    const corpsMetier = String(req.query.corpsMetier ?? '').trim();
    const groupeSanguin = String(req.query.groupeSanguin ?? '').trim();
    const telephone = String(req.query.telephone ?? '').trim();
    const numeroCNI = String(req.query.numeroCNI ?? '').trim();
    const numeroCarteElecteur = String(req.query.numeroCarteElecteur ?? '').trim();
    const statutElecteur = String(req.query.statutElecteur ?? '').trim().toUpperCase();

    const dateAdhesionDebutRaw = String(req.query.dateAdhesionDebut ?? '').trim();
    const dateAdhesionFinRaw = String(req.query.dateAdhesionFin ?? '').trim();

    const page = Math.max(1, Number(String(req.query.page ?? '1')) || 1);
    const maxLimit = user.role === 'LOCALITE' ? 100000 : 1000;
    const defaultLimit = user.role === 'LOCALITE' ? 100000 : 1000;
    const limit = Math.min(maxLimit, Math.max(1, Number(String(req.query.limit ?? String(defaultLimit))) || defaultLimit));
    const skip = (page - 1) * limit;

    // Déterminer la section à filtrer selon le rôle
    const whereAnd: any[] = [];

    if (user.role === 'SECTION_USER') {
      // Pour SECTION_USER, filtrer par sa section depuis le token
      if (!user.sectionId) {
        return res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
      }
      whereAnd.push({ sectionId: user.sectionId });
    } else {
      const sectionIdParam = String(req.query.sectionId ?? '').trim();

      if (user.role === 'SOUS_LOCALITE_ADMIN') {
        const creatorUser = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { sousLocaliteId: true },
        });

        if (!creatorUser?.sousLocaliteId) {
          return res.status(403).json({ error: 'Sous-localité non définie pour cet utilisateur' });
        }

        if (sectionIdParam) {
          const section = await prisma.section.findUnique({
            where: { id: sectionIdParam },
            select: { sousLocaliteId: true },
          });

          if (!section || section.sousLocaliteId !== creatorUser.sousLocaliteId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
          }

          whereAnd.push({ sectionId: sectionIdParam });
        } else {
          whereAnd.push({ section: { sousLocaliteId: creatorUser.sousLocaliteId } });
        }
      } else if (user.role === 'LOCALITE') {
        const creatorUser = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { sousLocaliteId: true, sousLocalite: { select: { localiteId: true } } },
        });

        let localiteId = creatorUser?.sousLocalite?.localiteId ?? null;

        if (!localiteId) {
          const anySousLocalite = await prisma.sousLocalite.findFirst({
            where: { createdById: user.userId },
            select: { localiteId: true },
            orderBy: { createdAt: 'asc' },
          });
          localiteId = anySousLocalite?.localiteId ?? null;
        }

        if (!localiteId) {
          return res.status(403).json({ error: 'Localité non définie pour cet utilisateur' });
        }

        if (sectionIdParam) {
          const section = await prisma.section.findUnique({
            where: { id: sectionIdParam },
            select: { sousLocalite: { select: { localiteId: true } } },
          });

          if (!section || section.sousLocalite.localiteId !== localiteId) {
            return res.status(403).json({ error: 'Accès non autorisé' });
          }

          whereAnd.push({ sectionId: sectionIdParam });
        } else {
          whereAnd.push({ section: { sousLocalite: { localiteId } } });
        }
      } else if (sectionIdParam) {
        whereAnd.push({ sectionId: sectionIdParam });
      }
    }

    // Recherche texte (prénom, nom, téléphone, CNI, carte électeur)
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

    if (genre) whereAnd.push({ genre });
    if (fonction) whereAnd.push({ fonction: { contains: fonction, mode: 'insensitive' } });
    if (corpsMetier) whereAnd.push({ corpsMetier: { contains: corpsMetier, mode: 'insensitive' } });
    if (groupeSanguin) whereAnd.push({ groupeSanguin });
    if (telephone) whereAnd.push({ telephone: { contains: telephone, mode: 'insensitive' } });
    if (numeroCNI) whereAnd.push({ numeroCNI: { contains: numeroCNI, mode: 'insensitive' } });
    if (numeroCarteElecteur) whereAnd.push({ numeroCarteElecteur: { contains: numeroCarteElecteur, mode: 'insensitive' } });

    if (statutElecteur) {
      const now = new Date();
      const date18 = new Date(now);
      date18.setFullYear(now.getFullYear() - 18);
      const date19 = new Date(now);
      date19.setFullYear(now.getFullYear() - 19);

      if (statutElecteur === 'VOTANT') {
        whereAnd.push({ dateNaissance: { lte: date18 } });
        whereAnd.push({ numeroCarteElecteur: { not: null } });
        whereAnd.push({ numeroCarteElecteur: { not: '' } });
      } else if (statutElecteur === 'NON_VOTANT') {
        whereAnd.push({ dateNaissance: { lte: date18 } });
        whereAnd.push({ OR: [{ numeroCarteElecteur: null }, { numeroCarteElecteur: '' }] });
      }
    }

    if (dateAdhesionDebutRaw || dateAdhesionFinRaw) {
      const dateFilter: any = {};
      if (dateAdhesionDebutRaw) {
        const d = new Date(dateAdhesionDebutRaw);
        if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
      }
      if (dateAdhesionFinRaw) {
        const d = new Date(dateAdhesionFinRaw);
        if (!Number.isNaN(d.getTime())) dateFilter.lte = d;
      }
      if (Object.keys(dateFilter).length > 0) whereAnd.push({ dateAdhesion: dateFilter });
    }

    const where = whereAnd.length > 0 ? { AND: whereAnd } : {};

    const whereHommes = whereAnd.length > 0 ? { AND: [...whereAnd, { genre: 'HOMME' }] } : { genre: 'HOMME' };
    const whereFemmes = whereAnd.length > 0 ? { AND: [...whereAnd, { genre: 'FEMME' }] } : { genre: 'FEMME' };

    const [total, totalHommes, totalFemmes, membres] = await Promise.all([
      prisma.membre.count({ where }),
      prisma.membre.count({ where: whereHommes }),
      prisma.membre.count({ where: whereFemmes }),
      prisma.membre.findMany({
        where,
        skip,
        take: limit,
        include: {
          section: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const membresEnrichis = membres.map((m: any) => {
      const age = computeAge(m.dateNaissance);
      const ageTranche = normalizeAgeTranche(m.ageTranche) ?? computeAgeTranche(age);
      return {
        ...m,
        age,
        isEligibleToVote: age !== null ? age >= 18 : ageTranche === 'S3',
        ageTranche,
      };
    });

    res.json({
      membres: membresEnrichis,
      stats: {
        total,
        hommes: totalHommes,
        femmes: totalFemmes,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Erreur récupération membres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const {
      sectionId,
      photo,
      prenom,
      nom,
      genre,
      fonction,
      corpsMetier,
      groupeSanguin,
      telephone,
      numeroCNI,
      adresse,
      dateNaissance,
      ageTranche,
      dateAdhesion,
      numeroCarteElecteur,
      lieuVote,
    } = req.body;

    if (!prenom || !nom) {
      return res.status(400).json({ error: 'Le prénom et le nom sont requis' });
    }

    const numElecteur = String(numeroCarteElecteur ?? '').trim();
    const lieu = String(lieuVote ?? '').trim();
    if (numElecteur && !lieu) {
      return res.status(400).json({ error: 'Lieu de vote requis si le numéro de carte électeur est renseigné' });
    }

    let finalSectionId = sectionId;
    if (user.role === 'SECTION_USER') {
      if (!user.sectionId) {
        return res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
      }
      finalSectionId = user.sectionId;
    } else if (!sectionId) {
      return res.status(400).json({ error: 'Section requise' });
    }

    const normalizedAgeTranche = normalizeAgeTranche(ageTranche);

    const dateNaissanceValue = parseOptionalDate(dateNaissance);
    if (dateNaissanceValue === undefined) return res.status(400).json({ error: 'dateNaissance invalide' });

    const dateAdhesionValue = parseOptionalDate(dateAdhesion);
    if (dateAdhesionValue === undefined) return res.status(400).json({ error: "dateAdhesion invalide" });

    if (!dateNaissanceValue && !normalizedAgeTranche) {
      return res.status(400).json({ error: "ageTranche requise (S1, S2 ou S3)" });
    }

    const membre = await prisma.membre.create({
      data: {
        sectionId: finalSectionId,
        photo,
        prenom,
        nom,
        genre,
        fonction,
        corpsMetier,
        groupeSanguin,
        telephone,
        numeroCNI,
        adresse,
        dateNaissance: dateNaissanceValue,
        ageTranche: normalizedAgeTranche,
        dateAdhesion: dateAdhesionValue,
        numeroCarteElecteur,
        lieuVote,
      },
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const age = computeAge(membre.dateNaissance);
    const computedTranche = computeAgeTranche(age);
    const finalTranche = normalizeAgeTranche(membre.ageTranche) ?? computedTranche;
    res.status(201).json({
      membre: {
        ...membre,
        age,
        isEligibleToVote: age !== null ? age >= 18 : finalTranche === 'S3',
        ageTranche: finalTranche,
      },
    });
  } catch (error: any) {
    console.error('Erreur création membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un membre
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      photo,
      prenom,
      nom,
      genre,
      fonction,
      corpsMetier,
      groupeSanguin,
      telephone,
      numeroCNI,
      adresse,
      dateNaissance,
      ageTranche,
      dateAdhesion,
      numeroCarteElecteur,
      lieuVote,
    } = req.body;
    
    // Validation
    if (!prenom || !nom) {
      return res.status(400).json({ error: 'Le prénom et le nom sont requis' });
    }

    const normalizedAgeTranche = normalizeAgeTranche(ageTranche);

    const dateNaissanceValue = parseOptionalDate(dateNaissance);
    if (dateNaissanceValue === undefined) return res.status(400).json({ error: 'dateNaissance invalide' });

    const dateAdhesionValue = parseOptionalDate(dateAdhesion);
    if (dateAdhesionValue === undefined) return res.status(400).json({ error: 'dateAdhesion invalide' });

    if (!dateNaissanceValue && !normalizedAgeTranche) {
      return res.status(400).json({ error: "ageTranche requise (S1, S2 ou S3)" });
    }

    const membre = await prisma.membre.update({
      where: { id },
      data: {
        photo,
        prenom,
        nom,
        genre,
        fonction,
        corpsMetier,
        groupeSanguin,
        telephone,
        numeroCNI,
        adresse,
        dateNaissance: dateNaissanceValue,
        ageTranche: normalizedAgeTranche,
        dateAdhesion: dateAdhesionValue,
        numeroCarteElecteur: numeroCarteElecteur === undefined ? undefined : numeroCarteElecteur,
        lieuVote: lieuVote === undefined ? undefined : lieuVote,
      },
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    const age = computeAge(membre.dateNaissance);
    const computedTranche = computeAgeTranche(age);
    const finalTranche = normalizeAgeTranche(membre.ageTranche) ?? computedTranche;
    res.json({
      membre: {
        ...membre,
        age,
        isEligibleToVote: age !== null ? age >= 18 : finalTranche === 'S3',
        ageTranche: finalTranche,
      },
    });
  } catch (error: any) {
    console.error('Erreur modification membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un membre
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.membre.delete({
      where: { id }
    });
    
    res.json({ message: 'Membre supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur suppression membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
