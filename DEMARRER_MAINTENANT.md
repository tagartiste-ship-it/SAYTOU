# 🚀 Démarrer SAYTOU Maintenant

## ⚠️ Prérequis Manquants Détectés

### 1. Installer Node.js (OBLIGATOIRE)

**Node.js n'est pas installé sur votre système.**

#### Téléchargement:
👉 **https://nodejs.org/fr/download/**

**Choisir**: Node.js 18 LTS ou supérieur (version recommandée: 20 LTS)

#### Installation:
1. Télécharger le fichier `.msi` pour Windows
2. Double-cliquer sur le fichier téléchargé
3. Suivre l'assistant d'installation (laisser les options par défaut)
4. ✅ Cocher "Automatically install necessary tools" si proposé
5. Redémarrer le terminal après l'installation

#### Vérification:
Ouvrir un nouveau PowerShell et taper:
```powershell
node --version
npm --version
```

Vous devriez voir:
```
v20.x.x
10.x.x
```

---

### 2. Installer Docker Desktop (OBLIGATOIRE)

**Docker est nécessaire pour PostgreSQL.**

#### Téléchargement:
👉 **https://www.docker.com/products/docker-desktop/**

#### Installation:
1. Télécharger Docker Desktop pour Windows
2. Double-cliquer sur l'installeur
3. Suivre l'assistant d'installation
4. Redémarrer l'ordinateur si demandé
5. Lancer Docker Desktop

---

## 🚀 Une fois Node.js et Docker installés

### Étape 1: Ouvrir PowerShell dans le dossier du projet

```powershell
cd C:\Users\HP\CascadeProjects\saytou
```

### Étape 2: Installer les dépendances Backend

```powershell
cd backend
npm install
npx prisma generate
```

**Temps estimé**: 2-3 minutes

### Étape 3: Installer les dépendances Frontend

```powershell
cd ..\frontend
npm install
```

**Temps estimé**: 2-3 minutes

### Étape 4: Démarrer PostgreSQL

```powershell
cd ..
docker-compose up -d postgres
```

**Attendre 10 secondes** que PostgreSQL démarre.

### Étape 5: Initialiser la base de données

```powershell
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

### Étape 6: Créer les fichiers .env

#### Backend (.env)
Créer le fichier `backend\.env` avec ce contenu:

```env
DATABASE_URL="postgresql://saytou:saytou123@localhost:5432/saytou_db"
JWT_SECRET="votre_secret_jwt_tres_securise_changez_moi"
JWT_REFRESH_SECRET="votre_refresh_secret_tres_securise_changez_moi"
PORT=3000
NODE_ENV=development
TZ=Africa/Dakar
```

#### Frontend (.env)
Créer le fichier `frontend\.env` avec ce contenu:

```env
VITE_API_URL=http://localhost:3000/api
```

### Étape 7: Démarrer l'application

#### Option A - Deux terminaux PowerShell:

**Terminal 1 - Backend:**
```powershell
cd C:\Users\HP\CascadeProjects\saytou\backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd C:\Users\HP\CascadeProjects\saytou\frontend
npm run dev
```

#### Option B - Un seul terminal (depuis la racine):
```powershell
cd C:\Users\HP\CascadeProjects\saytou
npm install
npm run dev
```

---

## 🌐 Accéder à l'application

Une fois démarrée, ouvrir votre navigateur:

- **Application Frontend**: http://localhost:5173
- **API Backend**: http://localhost:3000
- **Documentation API (Swagger)**: http://localhost:3000/api-docs

---

## 👤 Se Connecter

Utiliser un de ces comptes de test:

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| localite@saytou.test | ChangeMe123! | Super Admin |
| admin@saytou.test | Admin123! | Admin Sous-Localité |
| user@saytou.test | User123! | Utilisateur Section |

---

## ❌ Problèmes Courants

### "npm n'est pas reconnu"
➡️ Node.js n'est pas installé ou le terminal n'a pas été redémarré après l'installation.
**Solution**: Installer Node.js et redémarrer le terminal.

### "docker n'est pas reconnu"
➡️ Docker Desktop n'est pas installé ou n'est pas démarré.
**Solution**: Installer Docker Desktop et le lancer.

### "Port 3000 déjà utilisé"
➡️ Un autre processus utilise le port 3000.
**Solution**:
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Cannot connect to database"
➡️ PostgreSQL n'est pas démarré.
**Solution**:
```powershell
docker-compose up -d postgres
# Attendre 10 secondes
```

### Erreur Prisma
➡️ Le client Prisma n'est pas généré.
**Solution**:
```powershell
cd backend
npx prisma generate
```

---

## 📝 Commandes Utiles

### Arrêter l'application
- Appuyer sur `Ctrl+C` dans chaque terminal

### Arrêter PostgreSQL
```powershell
docker-compose down
```

### Réinitialiser la base de données
```powershell
cd backend
npx prisma migrate reset
npx prisma db seed
```

### Voir les logs Docker
```powershell
docker-compose logs -f postgres
```

---

## 🆘 Besoin d'aide?

1. Vérifier que Node.js est installé: `node --version`
2. Vérifier que Docker est lancé: ouvrir Docker Desktop
3. Consulter les logs dans les terminaux
4. Lire `INSTALLATION.md` pour plus de détails

---

## ✅ Checklist Avant de Démarrer

- [ ] Node.js installé (version 18+)
- [ ] Docker Desktop installé et lancé
- [ ] Dépendances backend installées (`npm install`)
- [ ] Dépendances frontend installées (`npm install`)
- [ ] Prisma Client généré (`npx prisma generate`)
- [ ] PostgreSQL démarré (`docker-compose up -d postgres`)
- [ ] Base de données initialisée (`npx prisma migrate dev`)
- [ ] Seeds créés (`npx prisma db seed`)
- [ ] Fichiers .env créés (backend et frontend)

---

**Une fois tout installé, l'application démarre en moins de 30 secondes! 🚀**
