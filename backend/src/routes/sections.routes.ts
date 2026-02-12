import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /api/sections:
 *   post:
 *     summary: Créer une section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  authenticate,
  authorize('LOCALITE', 'SOUS_LOCALITE_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, sousLocaliteId, userEmail, userPassword, userName } = req.body;
      const { role, userId } = req.user!;

      if (!name || name.trim() === '') {
        res.status(400).json({ error: 'Le nom est requis' });
        return;
      }

      if (!sousLocaliteId) {
        res.status(400).json({ error: 'La sous-localité est requise' });
        return;
      }

      // Vérifier les permissions
      if (role === 'SOUS_LOCALITE_ADMIN') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        if (user?.sousLocaliteId !== sousLocaliteId) {
          res.status(403).json({ error: 'Vous ne pouvez créer des sections que dans votre sous-localité' });
          return;
        }
      }

      // Si création avec utilisateur
      if (userEmail && userPassword && userName) {
        // Vérifier si l'email existe déjà
        const existingUser = await prisma.user.findUnique({
          where: { email: userEmail },
        });

        if (existingUser) {
          res.status(400).json({ error: 'Cet email est déjà utilisé' });
          return;
        }

        // Créer la section et l'utilisateur en transaction
        const result = await prisma.$transaction(async (tx) => {
          // Créer la section
          const section = await tx.section.create({
            data: {
              name: name.trim(),
              sousLocaliteId,
              createdById: userId,
            },
          });

          // Hasher le mot de passe
          const passwordHash = await bcrypt.hash(userPassword, 10);

          // Créer l'utilisateur
          const sectionUser = await tx.user.create({
            data: {
              email: userEmail,
              passwordHash,
              name: userName,
              role: 'SECTION_USER',
              sectionId: section.id,
              mustChangePassword: true,
            },
          });

          return { section, sectionUser };
        });

        res.status(201).json({
          message: 'Section et utilisateur créés avec succès',
          section: result.section,
          user: {
            id: result.sectionUser.id,
            email: result.sectionUser.email,
            name: result.sectionUser.name,
          },
        });
      } else {
        // Création simple sans utilisateur
        const section = await prisma.section.create({
          data: {
            name: name.trim(),
            sousLocaliteId,
            createdById: userId,
          },
          include: {
            sousLocalite: true,
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
          message: 'Section créée avec succès',
          section,
        });
      }
    } catch (error) {
      console.error('Erreur création section:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la section' });
    }
  }
);

/**
 * @swagger
 * /api/sections:
 *   get:
 *     summary: Obtenir la liste des sections
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, userId } = req.user!;
      const { sousLocaliteId } = req.query;

      let sections;

      if (role === 'LOCALITE' || role === 'COMITE_PEDAGOGIQUE') {
        // LOCALITÉ / COMITE_PEDAGOGIQUE voit tout
        const where = sousLocaliteId ? { sousLocaliteId: sousLocaliteId as string } : {};
        sections = await prisma.section.findMany({
          where,
          include: {
            sousLocalite: true,
            _count: {
              select: { rencontres: true, users: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } else {
        // Les autres voient seulement leurs sections
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true, sectionId: true, role: true },
        });

        if (!user?.sousLocaliteId) {
          res.json({ sections: [] });
          return;
        }

        if (role === 'SECTION_USER' && user.sectionId) {
          // Utilisateur de section voit seulement sa section
          sections = await prisma.section.findMany({
            where: { id: user.sectionId },
            include: {
              sousLocalite: true,
              _count: {
                select: { rencontres: true, users: true },
              },
            },
          });
        } else {
          // Admin de sous-localité voit toutes les sections de sa sous-localité
          sections = await prisma.section.findMany({
            where: { sousLocaliteId: user.sousLocaliteId },
            include: {
              sousLocalite: true,
              _count: {
                select: { rencontres: true, users: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        }
      }

      res.json({ sections });
    } catch (error) {
      console.error('Erreur récupération sections:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des sections' });
    }
  }
);

/**
 * @swagger
 * /api/sections/{id}:
 *   get:
 *     summary: Obtenir une section par ID
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { role, userId } = req.user!;

      const section = await prisma.section.findUnique({
        where: { id },
        include: {
          sousLocalite: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { rencontres: true, users: true },
          },
        },
      });

      if (!section) {
        res.status(404).json({ error: 'Section non trouvée' });
        return;
      }

      // Vérifier les permissions
      if (role !== 'LOCALITE') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true, sectionId: true },
        });

        if (role === 'SECTION_USER' && user?.sectionId !== id) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }

        if (role === 'SOUS_LOCALITE_ADMIN' && user?.sousLocaliteId !== section.sousLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      }

      res.json({ section });
    } catch (error) {
      console.error('Erreur récupération section:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de la section' });
    }
  }
);

/**
 * @swagger
 * /api/sections/{id}:
 *   put:
 *     summary: Modifier une section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  authenticate,
  authorize('LOCALITE', 'SOUS_LOCALITE_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const { role, userId } = req.user!;

      if (!name || name.trim() === '') {
        res.status(400).json({ error: 'Le nom est requis' });
        return;
      }

      // Vérifier les permissions
      if (role === 'SOUS_LOCALITE_ADMIN') {
        const section = await prisma.section.findUnique({
          where: { id },
          select: { sousLocaliteId: true },
        });

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        if (section?.sousLocaliteId !== user?.sousLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      }

      const section = await prisma.section.update({
        where: { id },
        data: { name: name.trim() },
        include: {
          sousLocalite: true,
          _count: {
            select: { rencontres: true, users: true },
          },
        },
      });

      res.json({
        message: 'Section modifiée avec succès',
        section,
      });
    } catch (error) {
      console.error('Erreur modification section:', error);
      res.status(500).json({ error: 'Erreur lors de la modification de la section' });
    }
  }
);

/**
 * @swagger
 * /api/sections/{id}:
 *   delete:
 *     summary: Supprimer une section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  authenticate,
  authorize('LOCALITE', 'SOUS_LOCALITE_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { role, userId } = req.user!;

      // Vérifier les permissions
      if (role === 'SOUS_LOCALITE_ADMIN') {
        const section = await prisma.section.findUnique({
          where: { id },
          select: { sousLocaliteId: true },
        });

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        if (section?.sousLocaliteId !== user?.sousLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      }

      await prisma.section.delete({
        where: { id },
      });

      res.json({ message: 'Section supprimée avec succès' });
    } catch (error) {
      console.error('Erreur suppression section:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la section' });
    }
  }
);

export default router;
