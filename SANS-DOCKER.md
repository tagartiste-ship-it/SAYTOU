# 🚀 Démarrer SAYTOU Sans Docker (SQLite)

## Option Simple: Utiliser SQLite au lieu de PostgreSQL

Si vous ne voulez pas installer Docker, vous pouvez utiliser SQLite (base de données locale).

### Étape 1: Modifier le fichier .env du backend

Remplacer le contenu de `backend\.env` par:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="votre_secret_jwt_changez_moi_en_production"
JWT_REFRESH_SECRET="votre_refresh_secret_changez_moi"
PORT=3000
NODE_ENV=development
TZ=Africa/Dakar
```

### Étape 2: Modifier schema.prisma

Dans `backend\prisma\schema.prisma`, changer la ligne 9:

**AVANT:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**APRÈS:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### Étape 3: Réinitialiser Prisma

```bash
cd C:\Users\HP\CascadeProjects\saytou\backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### Étape 4: Démarrer les serveurs

**Terminal 1 - Backend:**
```bash
cd C:\Users\HP\CascadeProjects\saytou\backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd C:\Users\HP\CascadeProjects\saytou\frontend
npm run dev
```

---

## ⚠️ Différences SQLite vs PostgreSQL

**SQLite:**
- ✅ Pas besoin de Docker
- ✅ Installation instantanée
- ✅ Parfait pour le développement
- ❌ Moins performant pour la production
- ❌ Pas de connexions multiples simultanées

**PostgreSQL (avec Docker):**
- ✅ Base de données professionnelle
- ✅ Meilleure performance
- ✅ Prêt pour la production
- ❌ Nécessite Docker Desktop

---

## 🎯 Recommandation

**Pour tester rapidement**: Utilisez SQLite (cette option)
**Pour la production**: Installez Docker et utilisez PostgreSQL
