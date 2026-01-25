import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const ensureDefaultTranchesAge = async () => {
  const count = await prisma.trancheAge.count();
  if (count > 0) return;

  const defaults = [
    { name: 'S1', ageMin: 0, ageMax: 12, order: 1 },
    { name: 'S2', ageMin: 12, ageMax: 18, order: 2 },
    { name: 'S3', ageMin: 18, ageMax: null as number | null, order: 3 },
  ];

  for (const t of defaults) {
    await prisma.trancheAge.upsert({
      where: { name: t.name },
      update: { ageMin: t.ageMin, ageMax: t.ageMax, order: t.order },
      create: { name: t.name, ageMin: t.ageMin, ageMax: t.ageMax, order: t.order },
    });
  }
};

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureDefaultTranchesAge();
    const tranchesAge = await prisma.trancheAge.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    res.json({ tranchesAge });
  } catch (error) {
    console.error('Erreur récupération tranches d\'âge:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tranches d\'âge' });
  }
});

export default router;
