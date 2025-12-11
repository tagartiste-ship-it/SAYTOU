import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },
  timezone: process.env.TZ || 'Africa/Dakar',
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
  },
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute (pour développement)
    max: 1000, // limit each IP to 1000 requests per windowMs (pour développement)
  },
};
