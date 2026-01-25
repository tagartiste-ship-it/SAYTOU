import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /api/sous-localites:
 *   post:
 *     summary: Créer une sous-localité (LOCALITÉ uniquement)
 *     tags: [Sous-Localités]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sous-localité créée
 */
router.post(
  '/',
  authenticate,
  authorize('LOCALITE'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, adminEmail, adminPassword, adminName } = req.body;

      if (!name || name.trim() === '') {
        res.status(400).json({ error: 'Le nom est requis' });
        return;
      }

      // Récupérer la première localité (ou créer si n'existe pas)
      let localite = await prisma.localite.findFirst();
      if (!localite) {
        localite = await prisma.localite.create({
          data: { name: 'Localité Principale' }
        });
      }

      // Si création avec admin
      if (adminEmail && adminPassword && adminName) {
        // Vérifier si l'email existe déjà
        const existingUser = await prisma.user.findUnique({
          where: { email: adminEmail },
        });

        if (existingUser) {
          res.status(400).json({ error: 'Cet email est déjà utilisé' });
          return;
        }

        // Créer la sous-localité et l'admin en transaction
        const result = await prisma.$transaction(async (tx) => {
          // Créer la sous-localité
          const sousLocalite = await tx.sousLocalite.create({
            data: {
              name: name.trim(),
              localiteId: localite!.id,
              createdById: req.user!.userId,
            },
          });

          // Hasher le mot de passe
          const passwordHash = await bcrypt.hash(adminPassword, 10);

          // Créer l'admin
          const admin = await tx.user.create({
            data: {
              email: adminEmail,
              passwordHash,
              name: adminName,
              role: 'SOUS_LOCALITE_ADMIN',
              sousLocaliteId: sousLocalite.id,
              mustChangePassword: true,
            },
          });

          return { sousLocalite, admin };
        });

        res.status(201).json({
          message: 'Sous-localité et administrateur créés avec succès',
          sousLocalite: result.sousLocalite,
          admin: {
            id: result.admin.id,
            email: result.admin.email,
            name: result.admin.name,
          },
        });
      } else {
        // Création simple sans admin
        const sousLocalite = await prisma.sousLocalite.create({
          data: {
            name: name.trim(),
            localiteId: localite.id,
            createdById: req.user!.userId,
          },
          include: {
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
          message: 'Sous-localité créée avec succès',
          sousLocalite,
        });
      }
    } catch (error) {
      console.error('Erreur création sous-localité:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la sous-localité' });
    }
  }
);

/**
 * @swagger
 * /api/sous-localites:
 *   get:
 *     summary: Obtenir la liste des sous-localités
 *     tags: [Sous-Localités]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des sous-localités
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role, userId } = req.user!;

      let sousLocalites;

      if (role === 'LOCALITE') {
        // LOCALITÉ voit tout
        sousLocalites = await prisma.sousLocalite.findMany({
          include: {
            sections: {
              include: {
                _count: {
                  select: { rencontres: true },
                },
              },
            },
            _count: {
              select: {
                sections: true,
                users: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } else {
        // Les autres voient seulement leur sous-localité
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        if (!user?.sousLocaliteId) {
          res.json({ sousLocalites: [] });
          return;
        }

        sousLocalites = await prisma.sousLocalite.findMany({
          where: { id: user.sousLocaliteId },
          include: {
            sections: {
              include: {
                _count: {
                  select: { rencontres: true },
                },
              },
            },
            _count: {
              select: {
                sections: true,
                users: true,
              },
            },
          },
        });
      }

      res.json({ sousLocalites });
    } catch (error) {
      console.error('Erreur récupération sous-localités:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des sous-localités' });
    }
  }
);

/**
 * @swagger
 * /api/sous-localites/{id}:
 *   get:
 *     summary: Obtenir une sous-localité par ID
 *     tags: [Sous-Localités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de la sous-localité
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { role, userId } = req.user!;

      const sousLocalite = await prisma.sousLocalite.findUnique({
        where: { id },
        include: {
          sections: {
            include: {
              _count: {
                select: { rencontres: true },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              sections: true,
              users: true,
            },
          },
        },
      });

      if (!sousLocalite) {
        res.status(404).json({ error: 'Sous-localité non trouvée' });
        return;
      }

      // Vérifier les permissions
      if (role !== 'LOCALITE') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        if (user?.sousLocaliteId !== id) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      }

      res.json({ sousLocalite });
    } catch (error) {
      console.error('Erreur récupération sous-localité:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de la sous-localité' });
    }
  }
);

/**
 * @swagger
 * /api/sous-localites/{id}:
 *   put:
 *     summary: Modifier une sous-localité
 *     tags: [Sous-Localités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sous-localité modifiée
 */
router.put(
  '/:id',
  authenticate,
  authorize('LOCALITE'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name || name.trim() === '') {
        res.status(400).json({ error: 'Le nom est requis' });
        return;
      }

      const sousLocalite = await prisma.sousLocalite.update({
        where: { id },
        data: { name: name.trim() },
        include: {
          sections: true,
          _count: {
            select: {
              sections: true,
              users: true,
            },
          },
        },
      });

      res.json({
        message: 'Sous-localité modifiée avec succès',
        sousLocalite,
      });
    } catch (error) {
      console.error('Erreur modification sous-localité:', error);
      res.status(500).json({ error: 'Erreur lors de la modification de la sous-localité' });
    }
  }
);

/**
 * @swagger
 * /api/sous-localites/{id}:
 *   delete:
 *     summary: Supprimer une sous-localité
 *     tags: [Sous-Localités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sous-localité supprimée
 */
router.delete(
  '/:id',
  authenticate,
  authorize('LOCALITE'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await prisma.sousLocalite.delete({
        where: { id },
      });

      res.json({ message: 'Sous-localité supprimée avec succès' });
    } catch (error) {
      console.error('Erreur suppression sous-localité:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la sous-localité' });
    }
  }
);

export default router;
