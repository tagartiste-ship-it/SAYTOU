# 🚀 Démarrage Rapide - SAYTOU

## ⚡ Installation en 5 minutes

### 1️⃣ Installer les dépendances (3 min)

```bash
# Ouvrir PowerShell dans le dossier saytou
cd C:\Users\HP\CascadeProjects\saytou

# Backend
cd backend
npm install
npx prisma generate

# Frontend
cd ..\frontend
npm install

# Retour à la racine
cd ..
```

### 2️⃣ Démarrer PostgreSQL (30 sec)

```bash
docker-compose up -d postgres
```

**Attendre 10 secondes** que PostgreSQL démarre.

### 3️⃣ Initialiser la base de données (1 min)

```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
cd ..
```

### 4️⃣ Lancer l'application (30 sec)

**Option A - Deux terminaux séparés:**

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd frontend
npm run dev
```

**Option B - Un seul terminal:**
```bash
npm run dev
```

### 5️⃣ Accéder à l'application ✅

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Documentation API**: http://localhost:3000/api-docs
- **Prisma Studio**: `npm run prisma:studio`

---

## 👤 Se Connecter

### Comptes de test disponibles:

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| localite@saytou.test | ChangeMe123! | Super Admin (LOCALITÉ) |
| admin@saytou.test | Admin123! | Admin Sous-Localité |
| user@saytou.test | User123! | Utilisateur Section |

---

## 🔍 Vérifier l'installation

```bash
npm run verify
```

Ce script vérifie automatiquement:
- ✅ Structure des fichiers
- ✅ Dépendances installées
- ✅ Compilation TypeScript
- ✅ Validation Prisma

---

## ❌ Problèmes Courants

### Erreur: Port 3000 déjà utilisé

```bash
# Windows - Trouver et tuer le processus
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Erreur: PostgreSQL ne démarre pas

```bash
# Supprimer et recréer
docker-compose down
docker volume rm saytou_postgres_data
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

---

## 📝 Commandes Utiles

### Développement

```bash
npm run dev              # Démarrer backend + frontend
npm run dev:backend      # Backend seul
npm run dev:frontend     # Frontend seul
```

### Base de données

```bash
npm run prisma:migrate   # Créer migration
npm run prisma:seed      # Réinitialiser données
npm run prisma:studio    # Interface graphique DB
```

### Docker

```bash
npm run docker:up        # Démarrer tous les services
npm run docker:down      # Arrêter tous les services
npm run docker:build     # Rebuild les images
```

### Build

```bash
npm run build            # Build backend + frontend
npm run build:backend    # Build backend seul
npm run build:frontend   # Build frontend seul
```

---

## 📚 Documentation Complète

- **README.md** - Vue d'ensemble
- **INSTALLATION.md** - Guide détaillé
- **ARCHITECTURE.md** - Architecture technique
- **CORRECTIONS.md** - Corrections appliquées
- **ERREURS_CORRIGEES.md** - Rapport de corrections

---

## 🎯 Prochaines Étapes

1. ✅ Se connecter avec un compte de test
2. ✅ Explorer le dashboard
3. ✅ Créer une rencontre
4. ✅ Consulter les statistiques
5. ✅ Exporter un PDF
6. 📝 Compléter les pages frontend manquantes:
   - RencontresPage (liste avec filtres)
   - CreateRencontrePage (formulaire)
   - RencontreDetailPage (détails + PDF)
   - SectionsPage (gestion CRUD)
   - TypesPage (gestion CRUD)
   - StatsPage (graphiques)

---

## 💡 Conseils

- **Prisma Studio** est très utile pour visualiser/modifier les données
- **Swagger UI** documente toute l'API automatiquement
- Les **logs** du backend sont dans le terminal
- Le **hot reload** est actif en développement

---

## 🆘 Besoin d'aide?

1. Vérifier les logs dans les terminaux
2. Exécuter `npm run verify`
3. Consulter `INSTALLATION.md`
4. Vérifier `ERREURS_CORRIGEES.md`

---

**Bon développement! 🚀**
