import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('❌ Erreur:', err);

  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Erreur de validation',
      details: err.message,
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Non autorisé',
      details: err.message,
    });
    return;
  }

  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};
