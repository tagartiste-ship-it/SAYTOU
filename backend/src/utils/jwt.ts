import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: JwtPayload): string => {
  const secret: Secret = config.jwt.secret as Secret;
  const options: SignOptions = { expiresIn: config.jwt.accessTokenExpiry as any };
  return jwt.sign(payload, secret, options);
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  const secret: Secret = config.jwt.refreshSecret as Secret;
  const options: SignOptions = { expiresIn: config.jwt.refreshTokenExpiry as any };
  return jwt.sign(payload, secret, options);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret as Secret) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.refreshSecret as Secret) as JwtPayload;
};
