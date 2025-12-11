import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import prisma from '../utils/prisma.js';

/**
 * Middleware pour vérifier les permissions basées sur le scope
 * Détermine automatiquement le scopeType et scopeId selon le rôle de l'utilisateur
 */
export async function determineScopeFromUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;

    // Récupérer les informations complètes de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        sectionId: true,
        sousLocaliteId: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    // Déterminer le scope selon le rôle
    let scopeType: 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION';
    let scopeId: string;

    if (role === 'SECTION_USER') {
      if (!user.sectionId) {
        res.status(400).json({ error: 'Utilisateur de section sans section assignée' });
        return;
      }
      scopeType = 'SECTION';
      scopeId = user.sectionId;
    } else if (role === 'SOUS_LOCALITE_ADMIN') {
      if (!user.sousLocaliteId) {
        res.status(400).json({ error: 'Admin de sous-localité sans sous-localité assignée' });
        return;
      }
      scopeType = 'SOUS_LOCALITE';
      scopeId = user.sousLocaliteId;
    } else if (role === 'LOCALITE') {
      // Pour LOCALITE, on utilise un ID fictif car il a accès à tout
      scopeType = 'LOCALITE';
      scopeId = 'LOCALITE';
    } else {
      res.status(403).json({ error: 'Rôle non autorisé' });
      return;
    }

    // Ajouter les informations de scope à la requête
    req.scope = { scopeType, scopeId, user };
    next();
  } catch (error) {
    console.error('Erreur checkScope:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification des permissions' });
  }
}

/**
 * Vérifie si l'utilisateur peut voir une rencontre donnée
 */
export async function canViewRencontre(
  userId: string,
  role: string,
  rencontreId: string
): Promise<boolean> {
  const rencontre = await prisma.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      scopeType: true,
      scopeId: true,
      sectionId: true,
      section: {
        select: {
          sousLocaliteId: true,
        },
      },
    },
  });

  if (!rencontre) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      sectionId: true,
      sousLocaliteId: true,
    },
  });

  if (!user) return false;

  // LOCALITE peut tout voir
  if (role === 'LOCALITE') return true;

  // SOUS_LOCALITE_ADMIN peut voir ses rencontres et celles des sections de sa zone
  if (role === 'SOUS_LOCALITE_ADMIN') {
    if (rencontre.scopeType === 'SOUS_LOCALITE' && rencontre.scopeId === user.sousLocaliteId) {
      return true;
    }
    if (rencontre.scopeType === 'SECTION' && rencontre.section.sousLocaliteId === user.sousLocaliteId) {
      return true;
    }
    return false;
  }

  // SECTION_USER peut voir uniquement ses rencontres
  if (role === 'SECTION_USER') {
    return rencontre.scopeType === 'SECTION' && rencontre.scopeId === user.sectionId;
  }

  return false;
}

/**
 * Vérifie si l'utilisateur peut modifier/supprimer une rencontre
 */
export async function canModifyRencontre(
  userId: string,
  role: string,
  rencontreId: string
): Promise<boolean> {
  const rencontre = await prisma.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      scopeType: true,
      scopeId: true,
      createdById: true,
    },
  });

  if (!rencontre) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      sectionId: true,
      sousLocaliteId: true,
    },
  });

  if (!user) return false;

  // Vérifier que l'utilisateur modifie uniquement ses propres rencontres
  if (role === 'SECTION_USER') {
    return rencontre.scopeType === 'SECTION' && rencontre.scopeId === user.sectionId;
  }

  if (role === 'SOUS_LOCALITE_ADMIN') {
    return rencontre.scopeType === 'SOUS_LOCALITE' && rencontre.scopeId === user.sousLocaliteId;
  }

  if (role === 'LOCALITE') {
    return rencontre.scopeType === 'LOCALITE';
  }

  return false;
}

// Étendre le type AuthRequest pour inclure le scope
declare module './auth.js' {
  interface AuthRequest {
    scope?: {
      scopeType: 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION';
      scopeId: string;
      user: {
        id: string;
        role: string;
        sectionId: string | null;
        sousLocaliteId: string | null;
      };
    };
  }
}
