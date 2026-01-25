import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
