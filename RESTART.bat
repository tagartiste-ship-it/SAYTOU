@echo off
echo ========================================
echo    REDEMARRAGE SERVEURS SAYTOU
echo ========================================
echo.

REM Arreter les processus Node.js existants
echo [1/3] Arret des serveurs existants...
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Serveurs arretes
) else (
    echo [INFO] Aucun serveur en cours
)
timeout /t 2 /nobreak >nul
echo.

REM Verification Node.js
echo [2/3] Verification Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe ou pas dans le PATH!
    echo.
    echo Solutions:
    echo 1. Installez Node.js: https://nodejs.org/fr/download/
    echo 2. Ou redemarrez votre ordinateur apres l'installation
    echo 3. Ou ajoutez Node.js au PATH manuellement
    echo.
    pause
    exit /b 1
)
node --version
echo [OK] Node.js detecte
echo.

REM Demarrage des serveurs
echo [3/3] Demarrage des serveurs...
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo IMPORTANT: 2 fenetres vont s'ouvrir - NE PAS LES FERMER!
echo.

REM Demarrer Backend
start "SAYTOU Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"
echo [OK] Backend demarre...
timeout /t 3 /nobreak >nul

REM Demarrer Frontend
start "SAYTOU Frontend Server" cmd /k "cd /d %~dp0frontend && npm run dev"
echo [OK] Frontend demarre...
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo    SERVEURS DEMARRES
echo ========================================
echo.
echo Ouvrez votre navigateur sur:
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000
echo   API Docs: http://localhost:3000/api-docs
echo.
echo Comptes de test:
echo   Email: localite@saytou.test
echo   Mot de passe: ChangeMe123!
echo.
echo Pour arreter: Fermez les 2 fenetres de serveur
echo.
pause
