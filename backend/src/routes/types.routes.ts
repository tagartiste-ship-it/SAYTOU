import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

type ScopeType = 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION' | null;

const normalizeTypeName = (value: unknown) => String(value ?? '').trim();

const getRequestScope = async (req: AuthRequest): Promise<{ role: string; scopeType: ScopeType; scopeId: string | null; userId: string }> => {
  const { userId, role } = req.user!;

  if (role === 'SECTION_USER') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { sectionId: true } });
    return { role, scopeType: 'SECTION', scopeId: user?.sectionId ?? null, userId };
  }

  if (role === 'SOUS_LOCALITE_ADMIN') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { sousLocaliteId: true } });
    return { role, scopeType: 'SOUS_LOCALITE', scopeId: user?.sousLocaliteId ?? null, userId };
  }

  return { role, scopeType: null, scopeId: null, userId };
};

const canManageType = async (req: AuthRequest, type: { scopeType: ScopeType; scopeId: string | null }) => {
  const { role, scopeId } = await getRequestScope(req);

  if (role === 'LOCALITE') return true;

  if (role === 'SOUS_LOCALITE_ADMIN') {
    if (type.scopeType === 'SOUS_LOCALITE' && type.scopeId === scopeId) return true;
    if (type.scopeType === 'SECTION' && type.scopeId) {
      const section = await prisma.section.findUnique({ where: { id: type.scopeId }, select: { sousLocaliteId: true } });
      return section?.sousLocaliteId === scopeId;
    }
    return false;
  }

  if (role === 'SECTION_USER') {
    if (type.scopeType == null) return true;
    return type.scopeType === 'SECTION' && !!type.scopeId && type.scopeId === scopeId;
  }

  return false;
};

/**
 * @swagger
 * /api/types:
 *   get:
 *     summary: Obtenir la liste des types de rencontre
 *     tags: [Types]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, role } = req.user!;

      // Construire le filtre selon le rôle
      const where: any = {};

      if (role === 'SECTION_USER') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sectionId: true, sousLocaliteId: true },
        });

        // Section voit : types globaux + types de sa section + types de sa sous-localité
        where.OR = [
          { scopeType: null }, // Types globaux
          { scopeType: 'SECTION', scopeId: user?.sectionId },
          { scopeType: 'SOUS_LOCALITE', scopeId: user?.sousLocaliteId },
        ];
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        // Charger les sections de la sous-localité
        const sections = await prisma.section.findMany({
          where: { sousLocaliteId: user?.sousLocaliteId },
          select: { id: true },
        });
        const sectionIds = sections.map(s => s.id);

        // Sous-localité voit : types globaux + types de sa sous-localité + types des sections de sa zone
        where.OR = [
          { scopeType: null }, // Types globaux
          { scopeType: 'SOUS_LOCALITE', scopeId: user?.sousLocaliteId },
          { scopeType: 'SECTION', scopeId: { in: sectionIds } },
        ];
      }
      // LOCALITE voit tout (pas de filtre)

      const types = await prisma.rencontreType.findMany({
        where,
        include: {
          trancheAge: true,
        },
        orderBy: { name: 'asc' },
      });

      res.json({ types });
    } catch (error) {
      console.error('Erreur récupération types:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des types' });
    }
  }
);

/**
 * @swagger
 * /api/types:
 *   post:
 *     summary: Créer un nouveau type de rencontre
 *     tags: [Types]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { isReunion, trancheAgeId } = req.body;
      const name = normalizeTypeName(req.body?.name);
      const { userId, role } = req.user!;

      if (!name) {
        res.status(400).json({ error: 'Le nom est requis' });
        return;
      }

      // Déterminer le scope selon le rôle
      let scopeType: 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION' | null = null;
      let scopeId: string | null = null;

      if (role === 'SECTION_USER') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sectionId: true },
        });

        if (!user?.sectionId) {
          res.status(400).json({ error: 'Votre compte n\'est pas associé à une section' });
          return;
        }

        scopeType = 'SECTION';
        scopeId = user.sectionId;
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        if (!user?.sousLocaliteId) {
          res.status(400).json({ error: 'Votre compte n\'est pas associé à une sous-localité' });
          return;
        }

        scopeType = 'SOUS_LOCALITE';
        scopeId = user.sousLocaliteId;
      } else if (role === 'LOCALITE') {
        // Types globaux (scopeType et scopeId restent null)
        scopeType = null;
        scopeId = null;
      }

      const existing = await prisma.rencontreType.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          scopeType,
          scopeId,
        },
        select: { id: true },
      });

      if (existing) {
        res.status(400).json({ error: 'Un type avec ce nom existe déjà pour cette section' });
        return;
      }

      if (trancheAgeId) {
        const trancheAge = await prisma.trancheAge.findUnique({
          where: { id: String(trancheAgeId) },
          select: { id: true },
        });

        if (!trancheAge) {
          res.status(400).json({ error: 'Tranche d\'âge invalide' });
          return;
        }
      }

      const type = await prisma.rencontreType.create({
        data: {
          name,
          isReunion: isReunion || false,
          createdById: userId,
          scopeType,
          scopeId,
          trancheAgeId: trancheAgeId ? String(trancheAgeId) : null,
        },
        include: {
          trancheAge: true,
        },
      });

      res.status(201).json({
        message: 'Type de rencontre créé avec succès',
        type,
      });
    } catch (error) {
      console.error('Erreur création type:', error);
      res.status(500).json({ error: 'Erreur lors de la création du type' });
    }
  }
);

/**
 * @swagger
 * /api/types/{id}:
 *   put:
 *     summary: Modifier un type de rencontre
 *     tags: [Types]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { isReunion, trancheAgeId } = req.body;
      const name = normalizeTypeName(req.body?.name);

      if (!name) {
        res.status(400).json({ error: 'Le nom est requis' });
        return;
      }

      const current = await prisma.rencontreType.findUnique({
        where: { id },
        select: { id: true, scopeType: true, scopeId: true },
      });

      if (!current) {
        res.status(404).json({ error: 'Type introuvable' });
        return;
      }

      const allowed = await canManageType(req, { scopeType: current.scopeType as ScopeType, scopeId: current.scopeId });
      if (!allowed) {
        res.status(403).json({ error: 'Accès refusé' });
        return;
      }

      const duplicate = await prisma.rencontreType.findFirst({
        where: {
          id: { not: id },
          name: { equals: name, mode: 'insensitive' },
          scopeType: current.scopeType,
          scopeId: current.scopeId,
        },
        select: { id: true },
      });

      if (duplicate) {
        res.status(400).json({ error: 'Un type avec ce nom existe déjà pour cette section' });
        return;
      }

      if (trancheAgeId) {
        const trancheAge = await prisma.trancheAge.findUnique({
          where: { id: String(trancheAgeId) },
          select: { id: true },
        });

        if (!trancheAge) {
          res.status(400).json({ error: 'Tranche d\'âge invalide' });
          return;
        }
      }

      const type = await prisma.rencontreType.update({
        where: { id },
        data: {
          name,
          isReunion: isReunion !== undefined ? isReunion : undefined,
          trancheAgeId: trancheAgeId === undefined ? undefined : (trancheAgeId ? String(trancheAgeId) : null),
        },
        include: {
          trancheAge: true,
        },
      });

      res.json({
        message: 'Type de rencontre modifié avec succès',
        type,
      });
    } catch (error) {
      console.error('Erreur modification type:', error);
      res.status(500).json({ error: 'Erreur lors de la modification du type' });
    }
  }
);

/**
 * @swagger
 * /api/types/{id}:
 *   delete:
 *     summary: Supprimer un type de rencontre
 *     tags: [Types]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const current = await prisma.rencontreType.findUnique({
        where: { id },
        select: { id: true, scopeType: true, scopeId: true },
      });

      if (!current) {
        res.status(404).json({ error: 'Type introuvable' });
        return;
      }

      const allowed = await canManageType(req, { scopeType: current.scopeType as ScopeType, scopeId: current.scopeId });
      if (!allowed) {
        res.status(403).json({ error: 'Accès refusé' });
        return;
      }

      // Vérifier si le type est utilisé
      const rencontresCount = await prisma.rencontre.count({
        where: { typeId: id },
      });

      if (rencontresCount > 0) {
        res.status(400).json({
          error: `Ce type est utilisé par ${rencontresCount} rencontre(s) et ne peut pas être supprimé`,
        });
        return;
      }

      await prisma.rencontreType.delete({
        where: { id },
      });

      res.json({ message: 'Type de rencontre supprimé avec succès' });
    } catch (error) {
      console.error('Erreur suppression type:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du type' });
    }
  }
);

export default router;
