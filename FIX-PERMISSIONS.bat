@echo off
echo ========================================
echo    CORRECTION PERMISSIONS POWERSHELL
echo ========================================
echo.
echo Ce script va autoriser l'execution des scripts npm
echo.
pause

echo Modification de la politique d'execution...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Permissions modifiees avec succes!
) else (
    echo [ERREUR] Impossible de modifier les permissions
    echo Essayez de lancer ce script en tant qu'Administrateur
)

echo.
echo ========================================
echo    VERIFICATION
echo ========================================
echo.
powershell -Command "Get-ExecutionPolicy -List"

echo.
echo Vous pouvez maintenant lancer START.bat ou RESTART.bat
echo.
pause
