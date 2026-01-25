import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const getDateRangeFilter = (req: AuthRequest) => {
  const dateDebutRaw = req.query.dateDebut as string | undefined;
  const dateFinRaw = req.query.dateFin as string | undefined;

  const dateFilter: any = {};
  if (dateDebutRaw) {
    const d = new Date(dateDebutRaw);
    if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
  }
  if (dateFinRaw) {
    const d = new Date(dateFinRaw);
    if (!Number.isNaN(d.getTime())) dateFilter.lte = d;
  }

  return Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};
};

type TrancheStatsItem = {
  tranche: string;
  nombreRencontres: number;
  totalPresenceHomme: number;
  totalPresenceFemme: number;
  totalPresence: number;
};

const buildParTrancheAge = (
  rencontresParType: Array<{
    typeId: string;
    _count: { id: number };
    _sum: {
      presenceHomme?: number | null;
      presenceFemme?: number | null;
      presenceTotale?: number | null;
    };
  }>,
  typeIdToTrancheName: Map<string, string>
): TrancheStatsItem[] => {
  const acc = new Map<string, TrancheStatsItem>();

  for (const stat of rencontresParType) {
    const tranche = typeIdToTrancheName.get(stat.typeId) ?? 'Non défini';
    const current = acc.get(tranche) ?? {
      tranche,
      nombreRencontres: 0,
      totalPresenceHomme: 0,
      totalPresenceFemme: 0,
      totalPresence: 0,
    };

    current.nombreRencontres += stat._count.id;
    current.totalPresenceHomme += stat._sum.presenceHomme ?? 0;
    current.totalPresenceFemme += stat._sum.presenceFemme ?? 0;
    current.totalPresence += stat._sum.presenceTotale ?? 0;
    acc.set(tranche, current);
  }

  const order: Record<string, number> = { 'Tout âge': 0, S1: 1, S2: 2, S3: 3, 'Non défini': 4 };

  const values = Array.from(acc.values());
  const toutAge: TrancheStatsItem = {
    tranche: 'Tout âge',
    nombreRencontres: 0,
    totalPresenceHomme: 0,
    totalPresenceFemme: 0,
    totalPresence: 0,
  };

  for (const v of values) {
    toutAge.nombreRencontres += v.nombreRencontres;
    toutAge.totalPresenceHomme += v.totalPresenceHomme;
    toutAge.totalPresenceFemme += v.totalPresenceFemme;
    toutAge.totalPresence += v.totalPresence;
  }

  const sorted = values.sort((a, b) => {
    const oa = order[a.tranche] ?? 999;
    const ob = order[b.tranche] ?? 999;
    if (oa !== ob) return oa - ob;
    return a.tranche.localeCompare(b.tranche);
  });

  if (toutAge.nombreRencontres === 0 && sorted.length === 0) return [];
  return [toutAge, ...sorted];
};

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

      const dateWhere = getDateRangeFilter(req);

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
        where: { sectionId: id, ...dateWhere },
      });

      const rencontres = await prisma.rencontre.findMany({
        where: { sectionId: id, ...dateWhere },
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
        where: { sectionId: id, ...dateWhere },
        _count: { id: true },
        _sum: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
        },
      });

      const typeIds = rencontresParType.map((r) => r.typeId);
      const types = await prisma.rencontreType.findMany({
        where: { id: { in: typeIds } },
        select: {
          id: true,
          trancheAge: {
            select: { name: true },
          },
        },
      });

      const typeIdToTrancheName = new Map<string, string>();
      for (const t of types) {
        if (t.trancheAge?.name) typeIdToTrancheName.set(t.id, t.trancheAge.name);
      }

      const parTrancheAge = buildParTrancheAge(rencontresParType, typeIdToTrancheName);

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
        where: { sectionId: id, ...dateWhere },
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
          parTrancheAge,
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

      const dateWhere = getDateRangeFilter(req);

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
        where: { sectionId: { in: sectionIds }, ...dateWhere },
      });

      const rencontres = await prisma.rencontre.findMany({
        where: { sectionId: { in: sectionIds }, ...dateWhere },
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
            where: { sectionId: section.id, ...dateWhere },
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
        where: { sectionId: { in: sectionIds }, ...dateWhere },
        _count: { id: true },
        _sum: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
        },
      });

      const typeIds = rencontresParType.map((r) => r.typeId);
      const types = await prisma.rencontreType.findMany({
        where: { id: { in: typeIds } },
        select: {
          id: true,
          trancheAge: {
            select: { name: true },
          },
        },
      });

      const typeIdToTrancheName = new Map<string, string>();
      for (const t of types) {
        if (t.trancheAge?.name) typeIdToTrancheName.set(t.id, t.trancheAge.name);
      }

      const parTrancheAge = buildParTrancheAge(rencontresParType, typeIdToTrancheName);

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
          parTrancheAge,
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

      const dateWhere = getDateRangeFilter(req);

      if (role !== 'LOCALITE') {
        res.status(403).json({ error: 'Accès réservé à LOCALITÉ' });
        return;
      }

      // Statistiques globales
      const totalSousLocalites = await prisma.sousLocalite.count();
      const totalSections = await prisma.section.count();
      const totalRencontres = await prisma.rencontre.count({ where: { ...dateWhere } });
      const totalUtilisateurs = await prisma.user.count();

      const rencontres = await prisma.rencontre.findMany({
        where: { ...dateWhere },
        select: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
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
        where: { ...dateWhere },
        _count: { id: true },
        _sum: {
          presenceHomme: true,
          presenceFemme: true,
          presenceTotale: true,
        },
      });

      const typeIds = rencontresParType.map((r) => r.typeId);
      const types = await prisma.rencontreType.findMany({
        where: { id: { in: typeIds } },
        select: {
          id: true,
          trancheAge: {
            select: { name: true },
          },
        },
      });

      const typeIdToTrancheName = new Map<string, string>();
      for (const t of types) {
        if (t.trancheAge?.name) typeIdToTrancheName.set(t.id, t.trancheAge.name);
      }

      const parTrancheAge = buildParTrancheAge(rencontresParType, typeIdToTrancheName);

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
          moyennePresenceHomme: Math.round(moyennePresenceHomme * 10) / 10,
          moyennePresenceFemme: Math.round(moyennePresenceFemme * 10) / 10,
          moyennePresence: Math.round(moyennePresence * 10) / 10,
          parTrancheAge,
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
