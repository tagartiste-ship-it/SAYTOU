import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

const TEMP_PASSWORD_LENGTH = 12;

const generateTempPassword = () => {
  // URL-safe, then slice to desired length
  return crypto.randomBytes(24).toString('base64url').slice(0, TEMP_PASSWORD_LENGTH);
};

const canManageTargetUser = async (actor: { role: string; userId: string }, targetUserId: string) => {
  if (actor.role === 'LOCALITE') return true;
  if (actor.role !== 'SOUS_LOCALITE_ADMIN') return false;

  const admin = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { sousLocaliteId: true },
  });

  if (!admin?.sousLocaliteId) return false;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { sousLocaliteId: true, sectionId: true },
  });

  if (!target) return false;

  if (target.sousLocaliteId && target.sousLocaliteId === admin.sousLocaliteId) return true;
  if (!target.sectionId) return false;

  const section = await prisma.section.findUnique({
    where: { id: target.sectionId },
    select: { sousLocaliteId: true },
  });

  return !!section && section.sousLocaliteId === admin.sousLocaliteId;
};

router.get(
  '/',
  authenticate,
  authorize('LOCALITE', 'SOUS_LOCALITE_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { role: userRole, userId } = req.user!;
      const { q, role } = req.query;

      const search = typeof q === 'string' ? q.trim() : '';
      const roleFilter = typeof role === 'string' ? role : '';

      if (userRole === 'LOCALITE') {
        const users = await (prisma.user as any).findMany({
          where: {
            ...(roleFilter ? { role: roleFilter as any } : {}),
            ...(search
              ? {
                  OR: [
                    { email: { contains: search, mode: 'insensitive' as const } },
                    { name: { contains: search, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            sousLocaliteId: true,
            sectionId: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            mustChangePassword: true,
            createdAt: true,
            sousLocalite: { select: { id: true, name: true } },
            section: {
              select: {
                id: true,
                name: true,
                sousLocalite: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        res.json({ users });
        return;
      }

      // SOUS_LOCALITE_ADMIN: voit les utilisateurs de sa sous-localité et des sections de sa sous-localité
      const admin = await prisma.user.findUnique({
        where: { id: userId },
        select: { sousLocaliteId: true },
      });

      if (!admin?.sousLocaliteId) {
        res.json({ users: [] });
        return;
      }

      const sections = await prisma.section.findMany({
        where: { sousLocaliteId: admin.sousLocaliteId },
        select: { id: true },
      });
      const sectionIds = sections.map((s) => s.id);

      const users = await (prisma.user as any).findMany({
        where: {
          AND: [
            { OR: [{ sousLocaliteId: admin.sousLocaliteId }, { sectionId: { in: sectionIds } }] },
            ...(roleFilter ? [{ role: roleFilter as any }] : []),
            ...(search
              ? [
                  {
                    OR: [
                      { email: { contains: search, mode: 'insensitive' as const } },
                      { name: { contains: search, mode: 'insensitive' as const } },
                    ],
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          sousLocaliteId: true,
          sectionId: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          mustChangePassword: true,
          createdAt: true,
          sousLocalite: { select: { id: true, name: true } },
          section: {
            select: {
              id: true,
              name: true,
              sousLocalite: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ users });
    } catch (error) {
      console.error('Erreur récupération users:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  }
);

router.post(
  '/:id/unlock',
  authenticate,
  authorize('LOCALITE', 'SOUS_LOCALITE_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const actor = req.user!;
      const targetId = req.params.id;

      const allowed = await canManageTargetUser({ role: actor.role, userId: actor.userId }, targetId);
      if (!allowed) {
        res.status(403).json({ error: 'Accès non autorisé' });
        return;
      }

      await (prisma.user as any).update({
        where: { id: targetId },
        data: {
          failedLoginAttempts: 0 as any,
          lockedUntil: null as any,
          refreshToken: null,
        },
      });

      res.json({ message: 'Compte débloqué' });
    } catch (error) {
      console.error('Erreur unlock user:', error);
      res.status(500).json({ error: 'Erreur lors du déblocage du compte' });
    }
  }
);

router.post(
  '/:id/reset-password',
  authenticate,
  authorize('LOCALITE', 'SOUS_LOCALITE_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const actor = req.user!;
      const targetId = req.params.id;

      const allowed = await canManageTargetUser({ role: actor.role, userId: actor.userId }, targetId);
      if (!allowed) {
        res.status(403).json({ error: 'Accès non autorisé' });
        return;
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await (prisma.user as any).update({
        where: { id: targetId },
        data: {
          passwordHash,
          refreshToken: null,
          failedLoginAttempts: 0 as any,
          lockedUntil: null as any,
          mustChangePassword: true,
        },
      });

      res.json({ message: 'Mot de passe réinitialisé', tempPassword });
    } catch (error) {
      console.error('Erreur reset password:', error);
      res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
    }
  }
);

export default router;
