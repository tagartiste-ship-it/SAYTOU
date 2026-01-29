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
router.get('/corps-metiers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    let sectionId = '';
    if (user.role === 'SECTION_USER') {
      if (!user.sectionId) {
        res.status(403).json({ error: 'Section non définie pour cet utilisateur' });
        return;
      }
      sectionId = user.sectionId;
    } else {
      sectionId = String(req.query.sectionId ?? '').trim();
      if (!sectionId) {
        res.status(400).json({ error: 'sectionId requis' });
        return;
      }
    }

    const rows = await prisma.membre.findMany({
      where: {
        sectionId,
        corpsMetier: {
          not: null,
        },
      },
      distinct: ['corpsMetier'],
      select: {
        corpsMetier: true,
      },
      orderBy: {
        corpsMetier: 'asc',
      },
    });

    const corpsMetiers = (rows as any[])
      .map((r) => String(r.corpsMetier ?? '').trim())
      .filter((v) => v);

    res.json({ corpsMetiers });
  } catch (error: any) {
    console.error('Erreur récupération corps de métier:', error);
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
    const limit = Math.min(1000, Math.max(1, Number(String(req.query.limit ?? '1000')) || 1000));
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
          select: { sousLocalite: { select: { localiteId: true } } },
        });

        const localiteId = creatorUser?.sousLocalite?.localiteId;
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

    const [total, membres] = await Promise.all([
      prisma.membre.count({ where }),
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
