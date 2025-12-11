@echo off
echo ========================================
echo    DEMARRAGE SAYTOU - Verification
echo ========================================
echo.

REM Verification Node.js
echo [1/6] Verification Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe!
    echo.
    echo Telechargez Node.js ici: https://nodejs.org/fr/download/
    echo Installez Node.js 20 LTS puis relancez ce script.
    echo.
    pause
    exit /b 1
)

node --version
npm --version
echo [OK] Node.js est installe
echo.

REM Verification Docker
echo [2/6] Verification Docker...
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [AVERTISSEMENT] Docker n'est pas installe ou pas demarre
    echo Telechargez Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo.
)

REM Installation Backend
echo [3/6] Installation des dependances Backend...
cd backend
if not exist "node_modules" (
    echo Installation en cours...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERREUR] Echec installation backend
        pause
        exit /b 1
    )
    echo Generation Prisma Client...
    call npx prisma generate
) else (
    echo [OK] Dependances backend deja installees
)
cd ..
echo.

REM Installation Frontend
echo [4/6] Installation des dependances Frontend...
cd frontend
if not exist "node_modules" (
    echo Installation en cours...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERREUR] Echec installation frontend
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependances frontend deja installees
)
cd ..
echo.

REM Creation fichiers .env
echo [5/6] Verification fichiers .env...
if not exist "backend\.env" (
    echo Creation backend\.env...
    (
        echo DATABASE_URL="postgresql://saytou:saytou123@localhost:5432/saytou_db"
        echo JWT_SECRET="votre_secret_jwt_tres_securise_changez_moi_en_production"
        echo JWT_REFRESH_SECRET="votre_refresh_secret_tres_securise_changez_moi_en_production"
        echo PORT=3000
        echo NODE_ENV=development
        echo TZ=Africa/Dakar
    ) > backend\.env
    echo [OK] Fichier backend\.env cree
) else (
    echo [OK] backend\.env existe
)

if not exist "frontend\.env" (
    echo Creation frontend\.env...
    echo VITE_API_URL=http://localhost:3000/api > frontend\.env
    echo [OK] Fichier frontend\.env cree
) else (
    echo [OK] frontend\.env existe
)
echo.

REM Demarrage PostgreSQL
echo [6/6] Demarrage PostgreSQL avec Docker...
docker-compose up -d postgres 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] PostgreSQL demarre
    echo Attente de 10 secondes pour l'initialisation...
    timeout /t 10 /nobreak >nul
) else (
    echo [AVERTISSEMENT] Impossible de demarrer PostgreSQL
    echo Verifiez que Docker Desktop est lance
)
echo.

REM Initialisation base de donnees
echo Initialisation de la base de donnees...
cd backend
call npx prisma migrate dev --name init 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Migrations appliquees
    call npx prisma db seed
    echo [OK] Donnees de test creees
) else (
    echo [INFO] Base de donnees deja initialisee ou Docker non disponible
)
cd ..
echo.

echo ========================================
echo    DEMARRAGE DES SERVEURS
echo ========================================
echo.
echo Le backend va demarrer sur: http://localhost:3000
echo Le frontend va demarrer sur: http://localhost:5173
echo.
echo IMPORTANT: Gardez cette fenetre ouverte!
echo Pour arreter: Appuyez sur Ctrl+C
echo.
echo Demarrage en cours...
echo.

REM Demarrage Backend et Frontend
start "SAYTOU Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul
start "SAYTOU Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo    SERVEURS DEMARRES
echo ========================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:3000/api-docs
echo.
echo Comptes de test:
echo - localite@saytou.test / ChangeMe123!
echo - admin@saytou.test / Admin123!
echo - user@saytou.test / User123!
echo.
echo Deux fenetres se sont ouvertes pour les serveurs.
echo Fermez-les pour arreter l'application.
echo.
pause
