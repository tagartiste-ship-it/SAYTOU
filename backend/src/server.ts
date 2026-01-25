import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { swaggerSpec } from './swagger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import sousLocalitesRoutes from './routes/sous-localites.routes.js';
import sectionsRoutes from './routes/sections.routes.js';
import typesRoutes from './routes/types.routes.js';
import rencontresRoutes from './routes/rencontres.routes.js';
import statsRoutes from './routes/stats.routes.js';
import membresRoutes from './routes/membres.routes.js';
import tranchesAgeRoutes from './routes/tranches-age.routes.js';
import usersRoutes from './routes/users.routes.js';
import binomesRoutes from './routes/binomes.routes.js';
import { startBinomesAutoRotationJob } from './routes/binomes.routes.js';

const app = express();

// Middleware de sécurité
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
});
app.use('/api/', limiter);

// Documentation Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SAYTOU API Documentation',
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sous-localites', sousLocalitesRoutes);
app.use('/api/sections', sectionsRoutes);
app.use('/api/types', typesRoutes);
app.use('/api/rencontres', rencontresRoutes);
app.use('/api/membres', membresRoutes);
app.use('/api/tranches-age', tranchesAgeRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/binomes', binomesRoutes);
app.use('/api/stats', statsRoutes);

// Route de santé
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    timezone: config.timezone,
  });
});

// Route racine
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Bienvenue sur l\'API SAYTOU',
    version: '1.0.0',
    documentation: '/api-docs',
  });
});

// Gestion des erreurs 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path,
  });
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// Démarrage du serveur
const PORT = config.port;

app.listen(PORT, () => {
  startBinomesAutoRotationJob();
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                      🌟 SAYTOU API 🌟                     ║
║                                                           ║
║  Application de Gestion de Rencontres                    ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  🚀 Serveur démarré avec succès                          ║
║  📍 Port: ${PORT}                                            ║
║  🌍 Environnement: ${config.nodeEnv}                        ║
║  ⏰ Timezone: ${config.timezone}                            ║
║                                                           ║
║  📚 Documentation API: http://localhost:${PORT}/api-docs    ║
║  ❤️  Health Check: http://localhost:${PORT}/health         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
