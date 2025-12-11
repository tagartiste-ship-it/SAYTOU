# SAYTOU - Application de Gestion de Rencontres

Application web moderne et sécurisée pour gérer plusieurs types de rencontres religieuses ou communautaires avec des rôles hiérarchiques de gestion.

## 🎨 Identité Visuelle

- **Nom**: SAYTOU
- **Couleurs**:
  - Bleu primaire: `#0B6EFF`
  - Orange accent: `#FF7A00`
  - Noir texte: `#0A0A0A`
  - Blanc: `#FFFFFF`
  - Fond clair: `#F7FAFC`

## 🧱 Technologies

### Backend
- Node.js + Express
- PostgreSQL + Prisma ORM
- JWT Authentication
- Puppeteer (Export PDF)
- Swagger (Documentation API)

### Frontend
- React + Vite
- TypeScript
- TailwindCSS
- Lucide Icons

### DevOps
- Docker + Docker Compose
- Timezone: Africa/Dakar

## 📋 Prérequis

- Node.js >= 18.0.0
- Docker & Docker Compose
- npm >= 9.0.0

## 🚀 Installation

### 1. Cloner et installer les dépendances

```bash
cd saytou
npm run install:all
```

### 2. Configuration de l'environnement

Créer un fichier `.env` dans le dossier `backend`:

```env
DATABASE_URL="postgresql://saytou:saytou123@localhost:5432/saytou_db"
JWT_SECRET="votre_secret_jwt_tres_securise"
JWT_REFRESH_SECRET="votre_refresh_secret_tres_securise"
PORT=3000
NODE_ENV=development
TZ=Africa/Dakar
```

Créer un fichier `.env` dans le dossier `frontend`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Démarrer la base de données

```bash
npm run docker:up
```

### 4. Initialiser la base de données

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Lancer l'application

```bash
npm run dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- API Documentation: http://localhost:3000/api-docs

## 👥 Comptes par défaut

Après le seed, vous pouvez vous connecter avec:

- **LOCALITÉ (Super Admin)**
  - Email: `localite@saytou.test`
  - Password: `ChangeMe123!`

## 📊 Structure des Rôles

### 1️⃣ LOCALITÉ (Super Admin)
- Créer/modifier/supprimer des Sous-localités
- Voir toutes les données
- Créer des comptes d'administrateurs

### 2️⃣ SOUS-LOCALITÉ (Admin)
- Gérer les Sections de base
- Consulter et exporter les données de ses sections
- Créer des comptes utilisateurs

### 3️⃣ SECTION DE BASE (Utilisateur)
- Créer/modifier/supprimer ses rencontres
- Télécharger les rencontres en PDF
- Consulter ses statistiques

## 📅 Types de Rencontre

Types prédéfinis:
- GOUDI ALDIOUMA
- KHADARATOUL DJOUMA
- RÉUNION BUREAU
- RÉUNION SECTION
- TOURE CELLULE FÉMININE
- ÉCOLE (DAARA)
- TOURE MJ
- TOURNÉ

Les administrateurs peuvent ajouter d'autres types.

## 🗄️ Base de Données

### Modèle de données
- `users` - Utilisateurs et authentification
- `sous_localites` - Sous-localités
- `sections` - Sections de base
- `rencontre_types` - Types de rencontres
- `rencontres` - Rencontres enregistrées

## 🌐 API Endpoints

### Authentification
- `POST /api/auth/signup` - Création de compte
- `POST /api/auth/login` - Connexion
- `POST /api/auth/refresh` - Refresh token

### Sous-localités & Sections
- `POST /api/sous-localites` - Créer sous-localité
- `GET /api/sous-localites` - Liste avec sections
- `POST /api/sections` - Créer section
- `GET /api/sections` - Liste sections

### Types de rencontre
- `GET /api/types` - Liste
- `POST /api/types` - Ajouter type
- `PUT /api/types/:id` - Modifier type

### Rencontres
- `POST /api/rencontres` - Créer
- `GET /api/rencontres` - Liste filtrée
- `GET /api/rencontres/:id` - Détail
- `PUT /api/rencontres/:id` - Modifier
- `DELETE /api/rencontres/:id` - Supprimer

### Export PDF
- `GET /api/rencontres/:id/pdf` - PDF d'une rencontre
- `POST /api/rencontres/export` - Export par lot

### Statistiques
- `GET /api/stats/section/:id` - Stats section
- `GET /api/stats/sous-localite/:id` - Stats globales

## 🐳 Docker

### Démarrer tous les services

```bash
docker-compose up -d
```

### Arrêter les services

```bash
docker-compose down
```

### Rebuild les images

```bash
docker-compose build
```

## 🧪 Tests

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 📦 Production

### Build

```bash
npm run build
```

### Déploiement Docker

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🔐 Sécurité

- Hash des mots de passe avec bcrypt
- JWT avec access et refresh tokens
- Rate limiting sur l'API
- Upload sécurisé avec validation
- Middleware d'autorisation par rôle

## 📝 Licence

Propriétaire - Tous droits réservés

## 👨‍💻 Support

Pour toute question ou problème, contactez l'équipe de développement.
