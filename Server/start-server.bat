@echo off
chcp 65001 >nul
title DashNov Server
color 0A

echo.
echo ============================================
echo   DashNov Server - Demarrage
echo ============================================
echo.

cd /d "%~dp0"

:: Verifier Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo ERREUR: Node.js n'est pas installe
    echo    Telechargez depuis: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detecte
node --version

:: Verifier SQL.env
if not exist "SQL.env" (
    color 0C
    echo ERREUR: Fichier SQL.env introuvable
    echo    Creez ce fichier avec les parametres de connexion
    echo.
    pause
    exit /b 1
)

echo [OK] Configuration SQL.env trouvee

:: Verifier node_modules
if not exist "node_modules" (
    echo.
    echo Installation des dependances...
    call npm install --production
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo ERREUR lors de l'installation
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Dependances verifiees
echo.
echo Demarrage du serveur...
echo.

node DashNov_Server.js

echo.
pause
