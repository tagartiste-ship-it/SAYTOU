import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /api/stats/section/{id}:
 *   get:
 *     summary: Obtenir les statistiques d'une section
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/section/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, role } = req.user!;

      // Vérifier les permissions
      if (role === 'SECTION_USER') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sectionId: true },
        });

        if (user?.sectionId !== id) {
          res.status(403).json({ error: 'Accès non autorisé' });
          return;
        }
      } else if (role === 'SOUS_LOCALITE_ADMIN') {
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

      // Récupérer les statistiques
      const totalRencontres = await prisma.rencontre.count({
        where: { sectionId: id },
      });

      const rencontres = await prisma.rencontre.findMany({
        where: { sectionId: id },
        select: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
          typeId: true,
        },
      });

      const totalPresenceHomme = rencontres.reduce((sum, r) => sum + r.presenceHomme, 0);
      const totalPresenceFemme = rencontres.reduce((sum, r) => sum + r.presenceFemme, 0);
      const totalPresence = rencontres.reduce((sum, r) => sum + r.presenceTotale, 0);

      const moyennePresenceHomme = totalRencontres > 0 ? totalPresenceHomme / totalRencontres : 0;
      const moyennePresenceFemme = totalRencontres > 0 ? totalPresenceFemme / totalRencontres : 0;
      const moyennePresence = totalRencontres > 0 ? totalPresence / totalRencontres : 0;

      // Statistiques par type
      const rencontresParType = await prisma.rencontre.groupBy({
        by: ['typeId'],
        where: { sectionId: id },
        _count: { id: true },
        _sum: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
        },
      });

      const typesWithStats = await Promise.all(
        rencontresParType.map(async (stat) => {
          const type = await prisma.rencontreType.findUnique({
            where: { id: stat.typeId },
          });
          return {
            type: type?.name || 'Inconnu',
            nombreRencontres: stat._count.id,
            totalPresenceHomme: stat._sum.presenceHomme || 0,
            totalPresenceFemme: stat._sum.presenceFemme || 0,
            totalPresence: stat._sum.presenceTotale || 0,
          };
        })
      );

      // Rencontres récentes
      const rencontresRecentes = await prisma.rencontre.findMany({
        where: { sectionId: id },
        include: {
          type: true,
        },
        orderBy: { date: 'desc' },
        take: 5,
      });

      res.json({
        section: await prisma.section.findUnique({
          where: { id },
          include: {
            sousLocalite: true,
          },
        }),
        statistiques: {
          totalRencontres,
          totalPresenceHomme,
          totalPresenceFemme,
          totalPresence,
          moyennePresenceHomme: Math.round(moyennePresenceHomme * 10) / 10,
          moyennePresenceFemme: Math.round(moyennePresenceFemme * 10) / 10,
          moyennePresence: Math.round(moyennePresence * 10) / 10,
        },
        parType: typesWithStats,
        rencontresRecentes,
      });
    } catch (error) {
      console.error('Erreur stats section:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
  }
);

/**
 * @swagger
 * /api/stats/sous-localite/{id}:
 *   get:
 *     summary: Obtenir les statistiques d'une sous-localité
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/sous-localite/:id',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, role } = req.user!;

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

      // Récupérer toutes les sections de la sous-localité
      const sections = await prisma.section.findMany({
        where: { sousLocaliteId: id },
        select: { id: true },
      });

      const sectionIds = sections.map((s: any) => s.id);

      // Statistiques globales
      const totalRencontres = await prisma.rencontre.count({
        where: { sectionId: { in: sectionIds } },
      });

      const rencontres = await prisma.rencontre.findMany({
        where: { sectionId: { in: sectionIds } },
        select: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
          typeId: true,
          sectionId: true,
        },
      });

      const totalPresenceHomme = rencontres.reduce((sum, r) => sum + r.presenceHomme, 0);
      const totalPresenceFemme = rencontres.reduce((sum, r) => sum + r.presenceFemme, 0);
      const totalPresence = rencontres.reduce((sum, r) => sum + r.presenceTotale, 0);

      const moyennePresenceHomme = totalRencontres > 0 ? totalPresenceHomme / totalRencontres : 0;
      const moyennePresenceFemme = totalRencontres > 0 ? totalPresenceFemme / totalRencontres : 0;
      const moyennePresence = totalRencontres > 0 ? totalPresence / totalRencontres : 0;

      // Statistiques par section
      const statsParSection = await Promise.all(
        sections.map(async (section: any) => {
          const sectionRencontres = await prisma.rencontre.count({
            where: { sectionId: section.id },
          });

          const sectionData = await prisma.section.findUnique({
            where: { id: section.id },
            select: { name: true },
          });

          const sectionPresences = rencontres.filter((r: any) => r.sectionId === section.id);
          const totalPres = sectionPresences.reduce((sum: number, r: any) => sum + r.presenceTotale, 0);

          return {
            sectionId: section.id,
            sectionName: sectionData?.name || 'Inconnu',
            nombreRencontres: sectionRencontres,
            totalPresence: totalPres,
          };
        })
      );

      // Statistiques par type
      const rencontresParType = await prisma.rencontre.groupBy({
        by: ['typeId'],
        where: { sectionId: { in: sectionIds } },
        _count: { id: true },
        _sum: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
        },
      });

      const typesWithStats = await Promise.all(
        rencontresParType.map(async (stat) => {
          const type = await prisma.rencontreType.findUnique({
            where: { id: stat.typeId },
          });
          return {
            type: type?.name || 'Inconnu',
            nombreRencontres: stat._count.id,
            totalPresenceHomme: stat._sum.presenceHomme || 0,
            totalPresenceFemme: stat._sum.presenceFemme || 0,
            totalPresence: stat._sum.presenceTotale || 0,
          };
        })
      );

      res.json({
        sousLocalite: await prisma.sousLocalite.findUnique({
          where: { id },
          include: {
            _count: {
              select: { sections: true },
            },
          },
        }),
        statistiques: {
          nombreSections: sections.length,
          totalRencontres,
          totalPresenceHomme,
          totalPresenceFemme,
          totalPresence,
          moyennePresenceHomme: Math.round(moyennePresenceHomme * 10) / 10,
          moyennePresenceFemme: Math.round(moyennePresenceFemme * 10) / 10,
          moyennePresence: Math.round(moyennePresence * 10) / 10,
        },
        parSection: statsParSection,
        parType: typesWithStats,
      });
    } catch (error) {
      console.error('Erreur stats sous-localité:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
  }
);

/**
 * @swagger
 * /api/stats/global:
 *   get:
 *     summary: Obtenir les statistiques globales (LOCALITÉ uniquement)
 *     tags: [Statistiques]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/global',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role } = req.user!;

      if (role !== 'LOCALITE') {
        res.status(403).json({ error: 'Accès réservé à LOCALITÉ' });
        return;
      }

      // Statistiques globales
      const totalSousLocalites = await prisma.sousLocalite.count();
      const totalSections = await prisma.section.count();
      const totalRencontres = await prisma.rencontre.count();
      const totalUtilisateurs = await prisma.user.count();

      const rencontres = await prisma.rencontre.findMany({
        select: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
        },
      });

      const totalPresenceHomme = rencontres.reduce((sum, r) => sum + r.presenceHomme, 0);
      const totalPresenceFemme = rencontres.reduce((sum, r) => sum + r.presenceFemme, 0);
      const totalPresence = rencontres.reduce((sum, r) => sum + r.presenceTotale, 0);

      // Statistiques par type
      const rencontresParType = await prisma.rencontre.groupBy({
        by: ['typeId'],
        _count: { id: true },
        _sum: {
          presenceTotale: true,
        },
      });

      const typesWithStats = await Promise.all(
        rencontresParType.map(async (stat) => {
          const type = await prisma.rencontreType.findUnique({
            where: { id: stat.typeId },
          });
          return {
            type: type?.name || 'Inconnu',
            nombreRencontres: stat._count.id,
            totalPresence: stat._sum.presenceTotale || 0,
          };
        })
      );

      res.json({
        statistiques: {
          totalSousLocalites,
          totalSections,
          totalRencontres,
          totalUtilisateurs,
          totalPresenceHomme,
          totalPresenceFemme,
          totalPresence,
        },
        parType: typesWithStats,
      });
    } catch (error) {
      console.error('Erreur stats globales:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
  }
);

export default router;
