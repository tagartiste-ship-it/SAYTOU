import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { generateRencontrePDF } from '../utils/pdfGenerator.js';

const router = Router();

/**
 * @swagger
 * /api/rencontres/{id}/pdf:
 *   get:
 *     summary: Télécharger le PDF d'une rencontre
 *     tags: [PDF]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/rencontres/:id/pdf',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, role } = req.user!;

      const rencontre = await prisma.rencontre.findUnique({
        where: { id },
        include: {
          type: true,
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

        if (user?.sectionId !== rencontre.sectionId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sousLocaliteId: true },
        });

        if (user?.sousLocaliteId !== rencontre.section.sousLocaliteId) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      }

      // Récupérer le nom de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      let membresPresentsDetails: Array<{ prenom: string; nom: string; fonction?: string | null; genre?: string | null }> = [];
      const membresPresentsIds = Array.isArray((rencontre as any).membresPresents) ? ((rencontre as any).membresPresents as string[]) : [];
      if (membresPresentsIds.length > 0) {
        membresPresentsDetails = await prisma.membre.findMany({
          where: {
            id: { in: membresPresentsIds },
            sectionId: rencontre.sectionId,
          },
          select: {
            prenom: true,
            nom: true,
            fonction: true,
            genre: true,
          },
          orderBy: [{ prenom: 'asc' }, { nom: 'asc' }],
        });
      }

      // Générer le PDF
      const pdfBuffer = await generateRencontrePDF(
        { ...(rencontre as any), membresPresentsDetails },
        user?.name || 'Utilisateur'
      );

      // Nom du fichier
      const dateStr = new Date(rencontre.date).toISOString().split('T')[0];
      const filename = `Rencontre_${rencontre.type.name.replace(/\s+/g, '_')}_${dateStr}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  }
);

/**
 * @swagger
 * /api/rencontres/export:
 *   post:
 *     summary: Exporter plusieurs rencontres en PDF
 *     tags: [PDF]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/rencontres/export',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { rencontreIds } = req.body;
      const { userId, role } = req.user!;

      if (!rencontreIds || !Array.isArray(rencontreIds) || rencontreIds.length === 0) {
        res.status(400).json({ error: 'Liste de rencontres requise' });
        return;
      }

      // Récupérer les rencontres
      const rencontres = await prisma.rencontre.findMany({
        where: { id: { in: rencontreIds } },
        include: {
          type: true,
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

      if (rencontres.length === 0) {
        res.status(404).json({ error: 'Aucune rencontre trouvée' });
        return;
      }

      // Vérifier les permissions pour chaque rencontre
      for (const rencontre of rencontres) {
        if (role === 'SECTION_USER') {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { sectionId: true },
          });

          if (user?.sectionId !== rencontre.sectionId) {
            res.status(403).json({ error: 'Accès non autorisé à certaines rencontres' });
            return;
          }
        } else if (role === 'SOUS_LOCALITE_ADMIN') {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { sousLocaliteId: true },
          });

          if (user?.sousLocaliteId !== rencontre.section.sousLocaliteId) {
            res.status(403).json({ error: 'Accès non autorisé à certaines rencontres' });
            return;
          }
        }
      }

      // Récupérer le nom de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      // Générer un PDF pour chaque rencontre et les combiner
      // Pour simplifier, on génère un ZIP avec tous les PDFs
      // Note: Pour une vraie implémentation, utiliser archiver ou jszip
      
      // Pour l'instant, on génère juste le premier PDF
      // TODO: Implémenter la génération de ZIP avec plusieurs PDFs
      const pdfBuffer = await generateRencontrePDF(rencontres[0], user?.name || 'Utilisateur');

      const filename = `Rencontres_Export_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur export PDF:', error);
      res.status(500).json({ error: 'Erreur lors de l\'export PDF' });
    }
  }
);

export default router;
