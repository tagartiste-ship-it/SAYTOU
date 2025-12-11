@echo off
echo ========================================
echo    ARRET SERVEURS SAYTOU
echo ========================================
echo.

echo Arret de tous les serveurs Node.js...
taskkill /F /IM node.exe >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [OK] Tous les serveurs ont ete arretes
) else (
    echo [INFO] Aucun serveur en cours d'execution
)

echo.
echo Arret de Docker (PostgreSQL)...
docker-compose down >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [OK] PostgreSQL arrete
) else (
    echo [INFO] Docker non disponible ou deja arrete
)

echo.
echo ========================================
echo    TOUS LES SERVEURS SONT ARRETES
echo ========================================
echo.
pause
