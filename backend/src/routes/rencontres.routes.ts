import express, { Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router: any = express.Router();

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const isWithinEditWindow = (createdAt: Date) => {
  const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  return Date.now() - createdAtMs <= EDIT_WINDOW_MS;
};

/**
 * @swagger
 * /api/rencontres:
 *   post:
 *     summary: Créer une rencontre
 *     tags: [Rencontres]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        typeId,
        sectionId,
        lieuMembreId,
        lieuTexte,
        date,
        heureDebut,
        heureFin,
        moderateur,
        moniteur,
        theme,
        developpement,
        pvReunion,
        ordreDuJour,
        membresPresents,
        presenceHomme,
        presenceFemme,
        observations,
        attachments,
      } = req.body;

      const { userId, role } = req.user!;

      // Validation des champs requis - seul typeId est obligatoire
      if (!typeId) {
        res.status(400).json({ error: 'Le type de rencontre est obligatoire' });
        return;
      }

      // Vérifier que heureFin > heureDebut si les deux sont fournis
      if (heureDebut && heureFin && heureFin <= heureDebut) {
        res.status(400).json({ error: "L'heure de fin doit être supérieure à l'heure de début" });
        return;
      }

      // Vérifier les présences
      const presH = presenceHomme || 0;
      const presF = presenceFemme || 0;
      if (presH < 0 || presF < 0) {
        res.status(400).json({ error: 'Les présences ne peuvent pas être négatives' });
        return;
      }

      // Déterminer le scope et la section selon le rôle
      let scopeType: 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION';
      let scopeId: string;
      let finalSectionId = sectionId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          localiteId: true,
          sectionId: true,
          sousLocaliteId: true,
          sousLocalite: { select: { localiteId: true } },
          section: { select: { sousLocalite: { select: { localiteId: true } } } },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      if (role === 'SECTION_USER') {
        if (!user.sectionId) {
          res.status(400).json({ error: 'Votre compte n\'est pas associé à une section' });
          return;
        }
        // SECTION crée uniquement pour sa section
        scopeType = 'SECTION';
        scopeId = user.sectionId;
        finalSectionId = user.sectionId;
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        if (!user.sousLocaliteId) {
          res.status(400).json({ error: 'Votre compte n\'est pas associé à une sous-localité' });
          return;
        }
        // SOUS_LOCALITE crée pour sa sous-localité
        scopeType = 'SOUS_LOCALITE';
        scopeId = user.sousLocaliteId;

        // Rencontre de sous-localité: pas de section
        finalSectionId = null;
      } else if (role === 'LOCALITE' || role === 'COMITE_PEDAGOGIQUE') {
        const localiteId =
          (user as any)?.localiteId
          || (user as any)?.sousLocalite?.localiteId
          || (user as any)?.section?.sousLocalite?.localiteId
          || null;

        if (!localiteId) {
          res.status(400).json({ error: "Votre compte n'est pas associé à une localité" });
          return;
        }

        // LOCALITE / COMITE_PEDAGOGIQUE crée pour la localité
        scopeType = 'LOCALITE';
        scopeId = localiteId;

        // Rencontre de localité: pas de section
        finalSectionId = null;
      } else {
        res.status(403).json({ error: 'Rôle non autorisé' });
        return;
      }

      // Vérifier le type de rencontre
      const type = await prisma.rencontreType.findUnique({
        where: { id: typeId },
      });

      if (!type) {
        res.status(404).json({ error: 'Type de rencontre non trouvé' });
        return;
      }

      // Valider theme ou ordreDuJour selon le type (optionnel maintenant)
      // Note: Ces validations sont désactivées car tous les champs sont optionnels sauf typeId
      
      // Calculer la présence totale
      const presenceTotale = presH + presF;

      // Créer la rencontre avec le scope
      const rencontre = await prisma.rencontre.create({
        data: {
          typeId,
          sectionId: finalSectionId,
          scopeType,
          scopeId,
          lieuMembreId: lieuMembreId || null,
          lieuTexte: lieuTexte || null,
          date: new Date(date),
          heureDebut,
          heureFin,
          moderateur,
          moniteur,
          theme: type.isReunion ? null : theme,
          developpement: typeof developpement === 'string' && developpement.trim() ? developpement : null,
          pvReunion: typeof pvReunion === 'string' && pvReunion.trim() ? pvReunion : null,
          ordreDuJour: type.isReunion ? ordreDuJour : null,
          membresPresents: Array.isArray(membresPresents) ? membresPresents : null,
          presenceHomme: presH,
          presenceFemme: presF,
          presenceTotale,
          observations,
          attachments: attachments || null,
          createdById: userId,
          updatedById: userId,
        },
        include: {
          type: true,
          lieuMembre: true,
          section: {
            include: {
              sousLocalite: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({
        message: 'Rencontre créée avec succès',
        rencontre,
      });
    } catch (error) {
      console.error('Erreur création rencontre:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la rencontre' });
    }
  }
);

router.get(
  '/sections-history',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, role } = req.user!;
      if (role !== 'SOUS_LOCALITE_ADMIN' && role !== 'COMITE_PEDAGOGIQUE') {
        res.status(403).json({ error: 'Accès non autorisé' });
        return;
      }

      const typeId = String(req.query.typeId ?? '').trim();
      const dateDebut = String(req.query.dateDebut ?? '').trim();
      const dateFin = String(req.query.dateFin ?? '').trim();
      const q = String(req.query.q ?? '').trim();

      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { sousLocaliteId: true, localiteId: true },
      });

      let sectionsWhere: any = {};
      if (role === 'COMITE_PEDAGOGIQUE') {
        // COMITE_PEDAGOGIQUE voit toutes les sections de la localité
        if (!actor?.localiteId) {
          res.status(403).json({ error: 'Localité non définie pour cet utilisateur' });
          return;
        }
        sectionsWhere = { sousLocalite: { localiteId: actor.localiteId } };
      } else {
        // SOUS_LOCALITE_ADMIN voit uniquement les sections de sa sous-localité
        if (!actor?.sousLocaliteId) {
          res.status(403).json({ error: 'Sous-localité non définie pour cet utilisateur' });
          return;
        }
        sectionsWhere = { sousLocaliteId: actor.sousLocaliteId };
      }

      const sections = await prisma.section.findMany({
        where: sectionsWhere,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      const sectionIds = sections.map((s) => s.id);
      if (!sectionIds.length) {
        res.json({ sousLocaliteId: actor?.sousLocaliteId ?? null, sections: [] });
        return;
      }

      const whereAnd: any[] = [{ sectionId: { in: sectionIds } }];
      if (typeId) whereAnd.push({ typeId });
      if (dateDebut) {
        const d = new Date(dateDebut);
        if (!Number.isNaN(d.getTime())) whereAnd.push({ date: { gte: d } });
      }
      if (dateFin) {
        const d = new Date(dateFin);
        if (!Number.isNaN(d.getTime())) whereAnd.push({ date: { lte: d } });
      }
      if (q) {
        whereAnd.push({
          OR: [
            { theme: { contains: q, mode: 'insensitive' } },
            { moderateur: { contains: q, mode: 'insensitive' } },
            { moniteur: { contains: q, mode: 'insensitive' } },
            { lieuTexte: { contains: q, mode: 'insensitive' } },
          ],
        });
      }

      const rencontres = await prisma.rencontre.findMany({
        where: whereAnd.length ? { AND: whereAnd } : {},
        include: {
          type: true,
          lieuMembre: {
            select: {
              id: true,
              prenom: true,
              nom: true,
            },
          },
          section: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ sectionId: 'asc' }, { date: 'desc' }, { createdAt: 'desc' }],
        take: 5000,
      });

      const bySectionId = new Map<string, { sectionId: string; sectionName: string; total: number; rencontres: any[] }>();
      for (const s of sections) {
        bySectionId.set(s.id, { sectionId: s.id, sectionName: s.name, total: 0, rencontres: [] });
      }
      for (const r of rencontres as any[]) {
        const sid = r.section?.id ?? r.sectionId;
        const bucket = bySectionId.get(sid);
        if (!bucket) continue;
        bucket.rencontres.push(r);
        bucket.total += 1;
      }

      res.json({
        sousLocaliteId: actor.sousLocaliteId,
        sections: Array.from(bySectionId.values()),
      });
    } catch (error) {
      console.error('Erreur récupération historique sections:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
    }
  }
);

/**
 * @swagger
 * /api/rencontres:
 *   get:
 *     summary: Obtenir la liste des rencontres
 *     tags: [Rencontres]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, role } = req.user!;
      const { typeId, sectionId, dateDebut, dateFin, q, page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const whereClauses: any[] = [];
      const where: any = {};

      if (typeId) {
        where.typeId = typeId as string;
      }

      if (dateDebut || dateFin) {
        where.date = {};
        if (dateDebut) {
          where.date.gte = new Date(dateDebut as string);
        }
        if (dateFin) {
          where.date.lte = new Date(dateFin as string);
        }
      }

      if (q && String(q).trim()) {
        const query = String(q).trim();
        whereClauses.push({
          OR: [
            { theme: { contains: query, mode: 'insensitive' } },
            { moderateur: { contains: query, mode: 'insensitive' } },
            { moniteur: { contains: query, mode: 'insensitive' } },
          ],
        });
      }

      // Filtrer selon le rôle et le scope
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          localiteId: true,
          sectionId: true,
          sousLocaliteId: true,
          sousLocalite: { select: { localiteId: true } },
          section: { select: { sousLocalite: { select: { localiteId: true } } } },
        },
      });

      if (role === 'SECTION_USER') {
        if (!user?.sectionId) {
          res.json({ rencontres: [], total: 0, page: pageNum, totalPages: 0 });
          return;
        }
        // SECTION voit uniquement ses propres rencontres
        where.scopeType = 'SECTION';
        where.scopeId = user.sectionId;
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        if (!user?.sousLocaliteId) {
          res.json({ rencontres: [], total: 0, page: pageNum, totalPages: 0 });
          return;
        }
        
        // Charger les sections de la sous-localité
        const sections = await prisma.section.findMany({
          where: { sousLocaliteId: user.sousLocaliteId },
          select: { id: true },
        });
        const sectionIds = sections.map(s => s.id);
        
        // SOUS_LOCALITE voit ses rencontres + celles des sections de sa zone
        where.OR = [
          // Ses propres rencontres
          { scopeType: 'SOUS_LOCALITE', scopeId: user.sousLocaliteId },
          // Rencontres des sections de sa zone
          { scopeType: 'SECTION', scopeId: { in: sectionIds } },
        ];
        
        // Filtrer par section si demandé
        if (sectionId) {
          if (sectionIds.includes(sectionId as string)) {
            delete where.OR;
            where.scopeType = 'SECTION';
            where.scopeId = sectionId as string;
          } else {
            res.status(403).json({ error: 'Accès non autorisé à cette section' });
            return;
          }
        }
      } else if (role === 'LOCALITE' || role === 'COMITE_PEDAGOGIQUE') {
        const localiteId =
          (user as any)?.localiteId
          || (user as any)?.sousLocalite?.localiteId
          || (user as any)?.section?.sousLocalite?.localiteId
          || null;

        if (!localiteId) {
          res.json({ rencontres: [], total: 0, page: pageNum, totalPages: 0 });
          return;
        }

        const sousLocalites = await prisma.sousLocalite.findMany({
          where: { localiteId },
          select: { id: true },
        });
        const sousLocaliteIds = sousLocalites.map((sl) => sl.id);

        const sections = await prisma.section.findMany({
          where: { sousLocaliteId: { in: sousLocaliteIds } },
          select: { id: true },
        });
        const sectionIds = sections.map((s) => s.id);

        where.OR = [
          { scopeType: 'LOCALITE', scopeId: localiteId },
          { scopeType: 'SOUS_LOCALITE', scopeId: { in: sousLocaliteIds } },
          { scopeType: 'SECTION', scopeId: { in: sectionIds } },
        ];

        // Filtrer par section si demandé (uniquement si section dans la localité)
        if (sectionId) {
          if (sectionIds.includes(sectionId as string)) {
            delete where.OR;
            where.scopeType = 'SECTION';
            where.scopeId = sectionId as string;
          } else {
            res.status(403).json({ error: 'Accès non autorisé à cette section' });
            return;
          }
        }
      }

      if (Object.keys(where).length > 0) whereClauses.unshift(where);

      const finalWhere = whereClauses.length > 1 ? { AND: whereClauses } : (whereClauses[0] || {});

      // Compter le total
      const total = await prisma.rencontre.count({ where: finalWhere });

      // Récupérer les rencontres
      const rencontres = await prisma.rencontre.findMany({
        where: finalWhere,
        include: {
          type: true,
          lieuMembre: {
            select: {
              id: true,
              prenom: true,
              nom: true,
            },
          },
          section: {
            include: {
              sousLocalite: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        rencontres,
        total,
        page: pageNum,
        totalPages,
        limit: limitNum,
      });
    } catch (error) {
      console.error('Erreur récupération rencontres:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des rencontres' });
    }
  }
);

/**
 * @swagger
 * /api/rencontres/{id}:
 *   get:
 *     summary: Obtenir une rencontre par ID
 *     tags: [Rencontres]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, role } = req.user!;

      const rencontre = await prisma.rencontre.findUnique({
        where: { id },
        include: {
          type: true,
          lieuMembre: {
            select: {
              id: true,
              prenom: true,
              nom: true,
            },
          },
          section: {
            include: {
              sousLocalite: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!rencontre) {
        res.status(404).json({ error: 'Rencontre non trouvée' });
        return;
      }

      // Vérifier les permissions
      if (role === 'SECTION_USER') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sectionId: true },
        });

        if (rencontre.scopeType !== 'SECTION' || user?.sectionId !== rencontre.scopeId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        const actorSousLocaliteId = user?.sousLocaliteId || null;
        if (!actorSousLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }

        // Accès à ses propres rencontres sous-localité
        if (rencontre.scopeType === 'SOUS_LOCALITE' && rencontre.scopeId === actorSousLocaliteId) {
          // ok
        } else if (rencontre.scopeType === 'SECTION') {
          // Accès aux rencontres des sections de sa sous-localité
          const sectionSousLocaliteId = (rencontre as any)?.section?.sousLocaliteId || null;
          if (sectionSousLocaliteId !== actorSousLocaliteId) {
            res.status(403).json({ error: 'Accès non autorisé' });
            return;
          }
        } else {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      } else if (role === 'LOCALITE' || role === 'COMITE_PEDAGOGIQUE') {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            localiteId: true,
            sousLocalite: { select: { localiteId: true } },
            section: { select: { sousLocalite: { select: { localiteId: true } } } },
          },
        });

        const actorLocaliteId =
          (actor as any)?.localiteId
          || (actor as any)?.sousLocalite?.localiteId
          || (actor as any)?.section?.sousLocalite?.localiteId
          || null;

        if (!actorLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }

        // Calculer la localité de la rencontre selon son scope
        let rencontreLocaliteId: string | null = null;
        if (rencontre.scopeType === 'LOCALITE') {
          rencontreLocaliteId = rencontre.scopeId;
        } else if (rencontre.scopeType === 'SOUS_LOCALITE') {
          const sl = await prisma.sousLocalite.findUnique({
            where: { id: rencontre.scopeId },
            select: { localiteId: true },
          });
          rencontreLocaliteId = sl?.localiteId || null;
        } else if (rencontre.scopeType === 'SECTION') {
          const localiteId = (rencontre as any)?.section?.sousLocalite?.localiteId || null;
          rencontreLocaliteId = localiteId;
        }

        if (rencontreLocaliteId !== actorLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      }

      res.json({ rencontre });
    } catch (error) {
      console.error('Erreur récupération rencontre:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de la rencontre' });
    }
  }
);

/**
 * @swagger
 * /api/rencontres/{id}:
 *   put:
 *     summary: Modifier une rencontre
 *     tags: [Rencontres]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, role } = req.user!;

      // Vérifier que la rencontre existe
      const existingRencontre = await prisma.rencontre.findUnique({
        where: { id },
        include: {
          section: {
            include: {
              sousLocalite: true,
            },
          },
          type: true,
        },
      });

      if (!existingRencontre) {
        res.status(404).json({ error: 'Rencontre non trouvée' });
        return;
      }

      // Vérifier les permissions basées sur le scope
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          localiteId: true,
          sectionId: true,
          sousLocaliteId: true,
          sousLocalite: { select: { localiteId: true } },
          section: { select: { sousLocalite: { select: { localiteId: true } } } },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      if (!isWithinEditWindow(existingRencontre.createdAt)) {
        res.status(403).json({
          error: 'RENCONTRE_LOCKED',
          message: 'Cette rencontre ne peut plus être modifiée après 24h',
        });
        return;
      }

      // Seul le créateur du scope peut modifier
      if (role === 'SECTION_USER') {
        if (existingRencontre.scopeType !== 'SECTION' || existingRencontre.scopeId !== user.sectionId) {
          res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres rencontres' });
          return;
        }
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        if (existingRencontre.scopeType !== 'SOUS_LOCALITE' || existingRencontre.scopeId !== user.sousLocaliteId) {
          res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres rencontres' });
          return;
        }
      } else if (role === 'LOCALITE' || role === 'COMITE_PEDAGOGIQUE') {
        const localiteId =
          (user as any)?.localiteId
          || (user as any)?.sousLocalite?.localiteId
          || (user as any)?.section?.sousLocalite?.localiteId
          || null;

        if (!localiteId) {
          res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres rencontres' });
          return;
        }

        if (existingRencontre.scopeType !== 'LOCALITE' || existingRencontre.scopeId !== localiteId) {
          res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres rencontres' });
          return;
        }
      }

      const {
        date,
        heureDebut,
        heureFin,
        moderateur,
        moniteur,
        theme,
        developpement,
        pvReunion,
        ordreDuJour,
        membresPresents,
        presenceHomme,
        presenceFemme,
        observations,
        attachments,
        lieuMembreId,
        lieuTexte,
      } = req.body;

      // Validation
      if (heureDebut && heureFin && heureFin <= heureDebut) {
        res.status(400).json({ error: "L'heure de fin doit être supérieure à l'heure de début" });
        return;
      }

      const presH = presenceHomme !== undefined ? presenceHomme : existingRencontre.presenceHomme;
      const presF = presenceFemme !== undefined ? presenceFemme : existingRencontre.presenceFemme;

      if (presH < 0 || presF < 0) {
        res.status(400).json({ error: 'Les présences ne peuvent pas être négatives' });
        return;
      }

      const presenceTotale = presH + presF;

      // Mettre à jour
      const rencontre = await prisma.rencontre.update({
        where: { id },
        data: {
          date: date ? new Date(date) : undefined,
          heureDebut: heureDebut || undefined,
          heureFin: heureFin || undefined,
          moderateur: moderateur || undefined,
          moniteur: moniteur || undefined,
          theme: existingRencontre.type.isReunion ? null : (theme !== undefined ? theme : undefined),
          developpement:
            developpement !== undefined
              ? (typeof developpement === 'string' && developpement.trim() ? developpement : null)
              : undefined,
          pvReunion:
            pvReunion !== undefined ? (typeof pvReunion === 'string' && pvReunion.trim() ? pvReunion : null) : undefined,
          ordreDuJour: existingRencontre.type.isReunion ? (ordreDuJour !== undefined ? ordreDuJour : undefined) : null,
          membresPresents: membresPresents !== undefined ? (Array.isArray(membresPresents) ? membresPresents : null) : undefined,
          presenceHomme: presH,
          presenceFemme: presF,
          presenceTotale,
          observations: observations !== undefined ? observations : undefined,
          attachments: attachments !== undefined ? attachments : undefined,
          lieuMembreId: lieuMembreId !== undefined ? (lieuMembreId || null) : undefined,
          lieuTexte: lieuTexte !== undefined ? (lieuTexte || null) : undefined,
          updatedById: userId,
        },
        include: {
          type: true,
          lieuMembre: true,
          section: {
            include: {
              sousLocalite: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.json({
        message: 'Rencontre modifiée avec succès',
        rencontre,
      });
    } catch (error) {
      console.error('Erreur modification rencontre:', error);
      res.status(500).json({ error: 'Erreur lors de la modification de la rencontre' });
    }
  }
);

/**
 * @swagger
 * /api/rencontres/{id}:
 *   delete:
 *     summary: Supprimer une rencontre
 *     tags: [Rencontres]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, role } = req.user!;

      // Vérifier que la rencontre existe
      const rencontre = await prisma.rencontre.findUnique({
        where: { id },
        include: {
          section: {
            include: {
              sousLocalite: true,
            },
          },
        },
      });

      if (!rencontre) {
        res.status(404).json({ error: 'Rencontre non trouvée' });
        return;
      }

      // Vérifier les permissions basées sur le scope
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          localiteId: true,
          sectionId: true,
          sousLocaliteId: true,
          sousLocalite: { select: { localiteId: true } },
          section: { select: { sousLocalite: { select: { localiteId: true } } } },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      if (!isWithinEditWindow(rencontre.createdAt)) {
        res.status(403).json({
          error: 'RENCONTRE_LOCKED',
          message: 'Cette rencontre ne peut plus être supprimée après 24h',
        });
        return;
      }

      // Seul le créateur du scope peut supprimer
      if (role === 'SECTION_USER') {
        if (rencontre.scopeType !== 'SECTION' || rencontre.scopeId !== user.sectionId) {
          res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres rencontres' });
          return;
        }
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        if (rencontre.scopeType !== 'SOUS_LOCALITE' || rencontre.scopeId !== user.sousLocaliteId) {
          res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres rencontres' });
          return;
        }
      } else if (role === 'LOCALITE' || role === 'COMITE_PEDAGOGIQUE') {
        const localiteId =
          (user as any)?.localiteId
          || (user as any)?.sousLocalite?.localiteId
          || (user as any)?.section?.sousLocalite?.localiteId
          || null;

        if (!localiteId) {
          res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres rencontres' });
          return;
        }

        if (rencontre.scopeType !== 'LOCALITE' || rencontre.scopeId !== localiteId) {
          res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres rencontres' });
          return;
        }
      }

      await prisma.rencontre.delete({
        where: { id },
      });

      res.json({ message: 'Rencontre supprimée avec succès' });
    } catch (error) {
      console.error('Erreur suppression rencontre:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la rencontre' });
    }
  }
);

export default router;
