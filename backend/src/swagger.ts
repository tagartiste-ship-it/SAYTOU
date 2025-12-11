import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SAYTOU API',
      version: '1.0.0',
      description: 'API pour l\'application de gestion de rencontres SAYTOU',
      contact: {
        name: 'SAYTOU Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Serveur de développement',
      },
      {
        url: 'https://api.saytou.com',
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentification et gestion des utilisateurs',
      },
      {
        name: 'Sous-Localités',
        description: 'Gestion des sous-localités',
      },
      {
        name: 'Sections',
        description: 'Gestion des sections',
      },
      {
        name: 'Types',
        description: 'Gestion des types de rencontre',
      },
      {
        name: 'Rencontres',
        description: 'Gestion des rencontres',
      },
      {
        name: 'PDF',
        description: 'Export PDF des rencontres',
      },
      {
        name: 'Statistiques',
        description: 'Statistiques et rapports',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
