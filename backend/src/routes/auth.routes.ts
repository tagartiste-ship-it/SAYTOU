import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/prisma.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Créer un nouveau compte utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [LOCALITE, SOUS_LOCALITE_ADMIN, SECTION_USER]
 *               sousLocaliteId:
 *                 type: string
 *               sectionId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Compte créé avec succès
 */
router.post('/signup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, sousLocaliteId, sectionId } = req.body;

    const creator = req.user;
    if (!creator) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    // Règles de création :
    // - LOCALITE peut créer uniquement SOUS_LOCALITE_ADMIN (dans sa sous-localité)
    // - SOUS_LOCALITE_ADMIN peut créer uniquement SECTION_USER (dans ses sections)
    if (creator.role === 'LOCALITE') {
      if (role !== 'SOUS_LOCALITE_ADMIN') {
        res.status(403).json({ error: 'Accès non autorisé' });
        return;
      }

      if (!sousLocaliteId) {
        res.status(400).json({ error: 'sousLocaliteId requis pour créer un compte SOUS_LOCALITE_ADMIN' });
        return;
      }

      if (sectionId) {
        res.status(400).json({ error: 'sectionId non autorisé pour un compte SOUS_LOCALITE_ADMIN' });
        return;
      }
    } else if (creator.role === 'SOUS_LOCALITE_ADMIN') {
      if (role !== 'SECTION_USER') {
        res.status(403).json({ error: 'Accès non autorisé' });
        return;
      }

      if (!sectionId) {
        res.status(400).json({ error: 'sectionId requis pour créer un compte SECTION_USER' });
        return;
      }

      const creatorUser = await prisma.user.findUnique({
        where: { id: creator.userId },
        select: { sousLocaliteId: true },
      });

      if (!creatorUser?.sousLocaliteId) {
        res.status(403).json({ error: 'Accès non autorisé' });
        return;
      }

      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { sousLocaliteId: true },
      });

      if (!section || section.sousLocaliteId !== creatorUser.sousLocaliteId) {
        res.status(403).json({ error: 'Accès non autorisé' });
        return;
      }
    } else {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Cet email est déjà utilisé' });
      return;
    }

    // Valider le mot de passe
    if (password.length < 8) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        sousLocaliteId: sousLocaliteId || null,
        sectionId: sectionId || null,
        mustChangePassword: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sousLocaliteId: true,
        sectionId: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Compte créé avec succès',
      user,
    });
  } catch (error) {
    console.error('Erreur signup:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Se connecter
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const MAX_FAILED_ATTEMPTS = 5;
    const LOCK_MINUTES = 15;

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        localite: true,
        sousLocalite: true,
        section: {
          include: {
            sousLocalite: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }

    const lockedUntil = (user as any).lockedUntil as Date | null | undefined;
    const failedLoginAttempts = ((user as any).failedLoginAttempts ?? 0) as number;

    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      res.status(423).json({
        error: 'Compte temporairement bloqué. Réessayez plus tard ou contactez un administrateur.',
        lockedUntil,
      });
      return;
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const attempts = failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      const nextLockedUntil = shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;

      await (prisma.user as any).update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: nextLockedUntil,
        },
      });

      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }

    // Reset compteur/lock si succès
    if (failedLoginAttempts !== 0 || lockedUntil) {
      await (prisma.user as any).update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Générer les tokens
    const derivedLocaliteId =
      ((user as any).localiteId as string | null | undefined) ??
      ((user as any).sousLocalite?.localiteId as string | null | undefined) ??
      ((user as any).section?.sousLocalite?.localiteId as string | null | undefined) ??
      null;
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      localiteId: derivedLocaliteId,
      sectionId: user.sectionId,
      sousLocaliteId: user.sousLocaliteId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Sauvegarder le refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        localiteId: derivedLocaliteId,
        sousLocaliteId: user.sousLocaliteId,
        sectionId: user.sectionId,
        mustChangePassword: (user as any).mustChangePassword ?? false,
        localite: (user as any).localite ?? null,
        sousLocalite: user.sousLocalite,
        section: user.section,
      },
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    res.json({ user: req.user });
  } catch (error) {
    console.error('Erreur auth/me:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Rafraîchir le token d'accès
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token rafraîchi
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token manquant' });
      return;
    }

    // Vérifier le refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Vérifier que le token est toujours valide en base
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ error: 'Refresh token invalide' });
      return;
    }

    const actor = await (prisma.user as any).findUnique({
      where: { id: user.id },
      select: {
        localiteId: true,
        sousLocalite: { select: { localiteId: true } },
        section: { select: { sousLocalite: { select: { localiteId: true } } } },
      },
    });

    const derivedLocaliteId =
      ((actor as any)?.localiteId as string | null | undefined) ??
      ((actor as any)?.sousLocalite?.localiteId as string | null | undefined) ??
      ((actor as any)?.section?.sousLocalite?.localiteId as string | null | undefined) ??
      null;

    // Générer un nouveau access token
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      localiteId: derivedLocaliteId,
      sousLocaliteId: (user as any).sousLocaliteId ?? null,
      sectionId: (user as any).sectionId ?? null,
    };

    const accessToken = generateAccessToken(payload);

    res.json({
      accessToken,
    });
  } catch (error) {
    console.error('Erreur refresh:', error);
    res.status(401).json({ error: 'Refresh token invalide ou expiré' });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Se déconnecter
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Supprimer le refresh token
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { refreshToken: null },
    });

    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtenir les informations de l'utilisateur connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations utilisateur
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        localiteId: true,
        sousLocaliteId: true,
        sectionId: true,
        mustChangePassword: true,
        localite: {
          select: {
            id: true,
            name: true,
          },
        },
        sousLocalite: {
          select: {
            id: true,
            name: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
            sousLocalite: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Erreur me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

router.post('/change-password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Champs manquants' });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        refreshToken: null,
      },
    });

    res.json({ message: 'Mot de passe modifié' });
  } catch (error) {
    console.error('Erreur change-password:', error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
});

export default router;
