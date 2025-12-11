# 🏗️ Architecture SAYTOU

## Vue d'ensemble

SAYTOU est une application full-stack JavaScript construite avec une architecture moderne en trois couches:

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Pages   │  │Components│  │  Store   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│       │              │              │                    │
│       └──────────────┴──────────────┘                    │
│                      │                                   │
│                 API Client (Axios)                       │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────┴──────────────────────────────────┐
│                  BACKEND (Node.js/Express)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Routes  │  │Middleware│  │ Services │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│       │              │              │                    │
│       └──────────────┴──────────────┘                    │
│                      │                                   │
│                Prisma ORM                                │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL
┌──────────────────────┴──────────────────────────────────┐
│                  DATABASE (PostgreSQL)                   │
│  ┌──────────────────────────────────────────────┐       │
│  │  users │ sous_localites │ sections │ ...     │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Stack Technologique

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Notifications**: Sonner

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Authentication**: JWT (Access + Refresh tokens)
- **Security**: Helmet, CORS, Rate Limiting
- **PDF Generation**: Puppeteer
- **API Documentation**: Swagger/OpenAPI

### Database
- **SGBD**: PostgreSQL 15
- **ORM**: Prisma
- **Migrations**: Prisma Migrate

### DevOps
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (production)
- **Timezone**: Africa/Dakar

## 📁 Structure du Projet

```
saytou/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (env, constants)
│   │   ├── middleware/      # Auth, upload, error handling
│   │   ├── routes/          # Endpoints API
│   │   ├── utils/           # Helpers (prisma, jwt, pdf)
│   │   ├── prisma/          # Seeds et migrations
│   │   ├── swagger.ts       # Configuration Swagger
│   │   └── server.ts        # Point d'entrée
│   ├── prisma/
│   │   └── schema.prisma    # Schéma de base de données
│   ├── uploads/             # Fichiers uploadés
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── pages/           # Pages de l'application
│   │   ├── lib/             # API client, types, utils
│   │   ├── store/           # Zustand stores
│   │   ├── App.tsx          # Composant racine
│   │   ├── main.tsx         # Point d'entrée
│   │   └── index.css        # Styles globaux
│   ├── public/              # Assets statiques
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── docker-compose.yml       # Orchestration Docker
├── package.json             # Scripts racine
├── README.md
├── INSTALLATION.md
└── ARCHITECTURE.md
```

## 🔐 Système d'Authentification

### Flow JWT

```
1. Login
   Client → POST /api/auth/login {email, password}
   Server → Vérifie credentials
   Server → Génère Access Token (15min) + Refresh Token (7j)
   Server → Retourne tokens + user info

2. Requête authentifiée
   Client → GET /api/rencontres
   Client → Header: Authorization: Bearer <access_token>
   Server → Vérifie token
   Server → Retourne données

3. Refresh token
   Client → POST /api/auth/refresh {refreshToken}
   Server → Vérifie refresh token
   Server → Génère nouveau access token
   Server → Retourne nouveau access token

4. Logout
   Client → POST /api/auth/logout
   Server → Invalide refresh token en DB
```

### Hiérarchie des Rôles

```
LOCALITE (Super Admin)
    ├── Accès: Tout
    ├── Peut créer: Sous-localités, Admins
    └── Peut voir: Toutes les données

SOUS_LOCALITE_ADMIN
    ├── Accès: Sa sous-localité et ses sections
    ├── Peut créer: Sections, Utilisateurs
    └── Peut voir: Données de ses sections

SECTION_USER
    ├── Accès: Sa section uniquement
    ├── Peut créer: Rencontres de sa section
    └── Peut voir: Rencontres de sa section
```

## 🗄️ Modèle de Données

### Relations

```
User ──┬─── créé par ──→ SousLocalite
       ├─── créé par ──→ Section
       ├─── créé par ──→ Rencontre
       └─── appartient à ──→ SousLocalite/Section

SousLocalite ──┬─── contient ──→ Section (1:N)
               └─── contient ──→ User (1:N)

Section ──┬─── contient ──→ Rencontre (1:N)
          └─── contient ──→ User (1:N)

RencontreType ──→ utilisé par ──→ Rencontre (1:N)

Rencontre ──┬─── appartient à ──→ Section
            ├─── a un ──→ RencontreType
            ├─── créé par ──→ User
            └─── modifié par ──→ User
```

### Schéma Prisma

Voir `backend/prisma/schema.prisma` pour le schéma complet.

## 🌐 API REST

### Endpoints Principaux

#### Authentification
- `POST /api/auth/signup` - Créer compte
- `POST /api/auth/login` - Connexion
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Info utilisateur

#### Sous-Localités
- `GET /api/sous-localites` - Liste
- `POST /api/sous-localites` - Créer (LOCALITE)
- `GET /api/sous-localites/:id` - Détails
- `PUT /api/sous-localites/:id` - Modifier (LOCALITE)
- `DELETE /api/sous-localites/:id` - Supprimer (LOCALITE)

#### Sections
- `GET /api/sections` - Liste
- `POST /api/sections` - Créer (LOCALITE, ADMIN)
- `GET /api/sections/:id` - Détails
- `PUT /api/sections/:id` - Modifier (LOCALITE, ADMIN)
- `DELETE /api/sections/:id` - Supprimer (LOCALITE, ADMIN)

#### Types de Rencontre
- `GET /api/types` - Liste
- `POST /api/types` - Créer (LOCALITE, ADMIN)
- `PUT /api/types/:id` - Modifier (LOCALITE, ADMIN)
- `DELETE /api/types/:id` - Supprimer (LOCALITE)

#### Rencontres
- `GET /api/rencontres` - Liste (avec filtres)
- `POST /api/rencontres` - Créer
- `GET /api/rencontres/:id` - Détails
- `PUT /api/rencontres/:id` - Modifier
- `DELETE /api/rencontres/:id` - Supprimer

#### Export PDF
- `GET /api/rencontres/:id/pdf` - PDF d'une rencontre
- `POST /api/rencontres/export` - Export multiple

#### Statistiques
- `GET /api/stats/section/:id` - Stats section
- `GET /api/stats/sous-localite/:id` - Stats sous-localité
- `GET /api/stats/global` - Stats globales (LOCALITE)

### Format de Réponse

```json
{
  "success": true,
  "data": { ... },
  "message": "Opération réussie"
}
```

### Gestion des Erreurs

```json
{
  "error": "Message d'erreur",
  "details": "Détails supplémentaires"
}
```

## 🎨 Design System

### Couleurs

```css
/* Primaire (Bleu) */
--primary: #0B6EFF
--primary-50: #E6F1FF
--primary-600: #0058CC

/* Accent (Orange) */
--accent: #FF7A00
--accent-50: #FFE8CC
--accent-600: #CC6200

/* Neutre */
--gray-50: #F7FAFC
--gray-900: #0A0A0A
```

### Composants TailwindCSS

Classes utilitaires définies dans `frontend/src/index.css`:
- `.btn` - Boutons
- `.input` - Champs de formulaire
- `.card` - Cartes
- `.label` - Labels

## 🔒 Sécurité

### Mesures Implémentées

1. **Authentification**
   - Hash bcrypt (10 rounds)
   - JWT avec expiration
   - Refresh token rotation

2. **Autorisation**
   - Middleware par rôle
   - Vérification des permissions par ressource

3. **Protection API**
   - Rate limiting (100 req/15min)
   - Helmet.js (headers sécurisés)
   - CORS configuré

4. **Upload**
   - Validation type MIME
   - Limite de taille (10MB)
   - Stockage sécurisé

5. **Base de Données**
   - Parameterized queries (Prisma)
   - Validation des entrées
   - Audit trail (created_by, updated_by)

## 📊 Performance

### Optimisations Backend
- Indexation DB (typeId, sectionId, date)
- Pagination des résultats
- Select spécifiques (éviter N+1)

### Optimisations Frontend
- Code splitting (React.lazy)
- Memoization (useMemo, useCallback)
- Optimistic updates
- Debouncing recherches

## 🧪 Tests

### Backend (À implémenter)
```bash
npm test
```
- Tests unitaires (Jest)
- Tests d'intégration (Supertest)
- Coverage > 80%

### Frontend (À implémenter)
```bash
npm test
```
- Tests composants (React Testing Library)
- Tests E2E (Playwright)

## 📦 Déploiement

### Environnements

1. **Développement**
   - Hot reload
   - Logs verbeux
   - Prisma Studio

2. **Production**
   - Build optimisé
   - Compression
   - Logs structurés
   - Health checks

### CI/CD (À configurer)

```yaml
# Exemple GitHub Actions
- Build & Test
- Lint & Type check
- Build Docker images
- Deploy to staging
- Deploy to production
```

## 🔄 Workflow de Développement

1. **Nouvelle fonctionnalité**
   ```bash
   git checkout -b feature/nom-feature
   # Développement
   git commit -m "feat: description"
   git push origin feature/nom-feature
   # Pull Request
   ```

2. **Modification DB**
   ```bash
   # Modifier schema.prisma
   npx prisma migrate dev --name description
   npx prisma generate
   ```

3. **Nouvelle route API**
   - Créer route dans `backend/src/routes/`
   - Ajouter middleware auth si nécessaire
   - Documenter avec JSDoc/Swagger
   - Tester avec Postman/Swagger UI

4. **Nouveau composant**
   - Créer dans `frontend/src/components/`
   - Utiliser TypeScript strict
   - Suivre le design system
   - Responsive mobile-first

## 📚 Ressources

- [Prisma Docs](https://www.prisma.io/docs)
- [Express.js](https://expressjs.com/)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [Docker](https://docs.docker.com/)

---

**SAYTOU** - Architecture moderne pour une gestion efficace
