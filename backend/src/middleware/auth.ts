import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    sectionId?: string | null;
    sousLocaliteId?: string | null;
  };
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

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token manquant ou invalide' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    req.user = decoded;
    next();
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Auth error:', {
      name: error?.name,
      message: error?.message,
    });

    const isDev = process.env.NODE_ENV !== 'production';
    res.status(401).json(
      isDev
        ? { error: 'Token invalide ou expiré', details: error?.name, message: error?.message }
        : { error: 'Token invalide ou expiré' }
    );
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    if (req.user.role === 'OWNER') {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    next();
  };
};
