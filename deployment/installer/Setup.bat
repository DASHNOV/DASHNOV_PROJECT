@echo off
setlocal enabledelayedexpansion

:: Vérifier les droits administrateur
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════╗
    echo ║  Droits administrateur requis                              ║
    echo ╚════════════════════════════════════════════════════════════╝
    echo.
    echo Relancez ce programme en tant qu'administrateur.
    pause
    exit /b 1
)

:: Lancer le script PowerShell
powershell.exe -ExecutionPolicy Bypass -File "%~dp0Install.ps1"

pause
