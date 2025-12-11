# 🚀 Guide d'Installation SAYTOU

Ce guide vous accompagne pas à pas pour installer et démarrer l'application SAYTOU.

## 📋 Prérequis

- **Node.js** >= 18.0.0 ([Télécharger](https://nodejs.org/))
- **Docker Desktop** ([Télécharger](https://www.docker.com/products/docker-desktop/))
- **Git** (optionnel)

## 🔧 Installation

### 1. Naviguer vers le projet

```bash
cd C:\Users\HP\CascadeProjects\saytou
```

### 2. Installer les dépendances

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd ../frontend
npm install
```

#### Root (optionnel pour scripts globaux)
```bash
cd ..
npm install
```

### 3. Configuration de l'environnement

#### Backend - Créer `.env`
```bash
cd backend
copy .env.example .env
```

Éditer `backend/.env` avec vos valeurs:
```env
DATABASE_URL="postgresql://saytou:saytou123@localhost:5432/saytou_db"
JWT_SECRET="votre_secret_jwt_tres_securise_changez_moi"
JWT_REFRESH_SECRET="votre_refresh_secret_tres_securise_changez_moi"
PORT=3000
NODE_ENV=development
TZ=Africa/Dakar
```

#### Frontend - Créer `.env`
```bash
cd ../frontend
copy .env.example .env
```

Le fichier `frontend/.env` devrait contenir:
```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Démarrer PostgreSQL avec Docker

```bash
cd ..
docker-compose up -d postgres
```

Vérifier que PostgreSQL est démarré:
```bash
docker ps
```

### 5. Initialiser la base de données

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### 6. Démarrer l'application

#### Option A: Démarrer séparément

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

#### Option B: Démarrer ensemble (depuis la racine)
```bash
npm run dev
```

## 🌐 Accès à l'application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Documentation API**: http://localhost:3000/api-docs
- **Prisma Studio**: `npm run prisma:studio` (depuis backend)

## 👤 Comptes de test

Après le seed, vous pouvez vous connecter avec:

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| localite@saytou.test | ChangeMe123! | LOCALITÉ (Super Admin) |
| admin@saytou.test | Admin123! | SOUS_LOCALITE_ADMIN |
| user@saytou.test | User123! | SECTION_USER |

## 🐳 Déploiement Docker (Production)

### Build et démarrage complet

```bash
docker-compose build
docker-compose up -d
```

### Initialiser la base de données en production

```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed
```

### Accès en production
- **Frontend**: http://localhost (port 80)
- **Backend**: http://localhost:3000

## 🛠️ Commandes utiles

### Backend

```bash
# Développement
npm run dev

# Build
npm run build

# Démarrer en production
npm start

# Prisma
npx prisma studio          # Interface graphique DB
npx prisma migrate dev     # Créer migration
npx prisma db seed         # Réinitialiser données
npx prisma generate        # Générer client Prisma
```

### Frontend

```bash
# Développement
npm run dev

# Build
npm run build

# Preview du build
npm run preview
```

### Docker

```bash
# Démarrer tous les services
docker-compose up -d

# Arrêter tous les services
docker-compose down

# Voir les logs
docker-compose logs -f

# Rebuild les images
docker-compose build --no-cache

# Supprimer volumes (⚠️ supprime les données)
docker-compose down -v
```

## 🔍 Vérification de l'installation

### 1. Vérifier PostgreSQL
```bash
docker-compose exec postgres psql -U saytou -d saytou_db -c "\dt"
```

Vous devriez voir les tables: `users`, `sous_localites`, `sections`, `rencontre_types`, `rencontres`

### 2. Vérifier le Backend
Ouvrir http://localhost:3000/health

Réponse attendue:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "timezone": "Africa/Dakar"
}
```

### 3. Vérifier le Frontend
Ouvrir http://localhost:5173

Vous devriez voir la page de connexion SAYTOU.

## ❌ Résolution des problèmes

### Erreur: Port déjà utilisé

**Backend (port 3000):**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Ou changer le port dans backend/.env
PORT=3001
```

**Frontend (port 5173):**
```bash
# Changer dans frontend/vite.config.ts
server: {
  port: 5174
}
```

### Erreur: PostgreSQL ne démarre pas

```bash
# Arrêter et supprimer le conteneur
docker-compose down
docker volume rm saytou_postgres_data

# Redémarrer
docker-compose up -d postgres
```

### Erreur: Prisma Client non généré

```bash
cd backend
npx prisma generate
```

### Erreur: Module non trouvé

```bash
# Réinstaller les dépendances
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

### Erreur: CORS

Vérifier que `VITE_API_URL` dans `frontend/.env` correspond à l'URL du backend.

## 📚 Prochaines étapes

1. **Compléter les pages frontend** - Les pages suivantes sont à implémenter:
   - `RencontresPage.tsx` - Liste des rencontres avec filtres
   - `CreateRencontrePage.tsx` - Formulaire de création
   - `RencontreDetailPage.tsx` - Détails et export PDF
   - `SectionsPage.tsx` - Gestion des sections
   - `TypesPage.tsx` - Gestion des types
   - `StatsPage.tsx` - Statistiques avec graphiques

2. **Ajouter les tests**
   - Tests unitaires backend (Jest)
   - Tests E2E frontend (Playwright)

3. **Améliorer la sécurité**
   - Changer les secrets JWT en production
   - Configurer HTTPS
   - Ajouter validation côté client

4. **Optimisations**
   - Mise en cache
   - Compression des images
   - Lazy loading des composants

## 📞 Support

Pour toute question ou problème:
1. Vérifier les logs: `docker-compose logs -f`
2. Consulter la documentation API: http://localhost:3000/api-docs
3. Vérifier Prisma Studio: `npm run prisma:studio`

## ✅ Checklist de déploiement

- [ ] Changer tous les secrets et mots de passe
- [ ] Configurer les variables d'environnement de production
- [ ] Tester toutes les fonctionnalités
- [ ] Configurer les sauvegardes de base de données
- [ ] Configurer le monitoring
- [ ] Documenter les procédures d'exploitation
- [ ] Former les utilisateurs

---

**Application SAYTOU** - Gestion de Rencontres Religieuses et Communautaires
