#Requires -RunAsAdministrator

# ============================================
# Installation du service Windows DashNov
# ============================================

$ErrorActionPreference = "Stop"
$ServiceName = "DashNovServer"
$ServerPath = $PSScriptRoot
$NodeExe = (Get-Command node).Source
$ServerScript = Join-Path $ServerPath "DashNov_Server_V16.js"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Installation service Windows" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verifier NSSM
$NSSMPath = Join-Path $ServerPath "nssm.exe"
if (!(Test-Path $NSSMPath)) {
    Write-Host "[ERREUR] nssm.exe introuvable" -ForegroundColor Red
    Write-Host "   Telechargez depuis: https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "   Placez nssm.exe dans: $ServerPath" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Appuyez sur Entree"
    exit 1
}

# Verifier si le service existe deja
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Service existant detecte" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous le desinstaller d'abord? (O/N)"
    if ($response -eq 'O' -or $response -eq 'o') {
        Write-Host "Arret du service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        Write-Host "Desinstallation..." -ForegroundColor Yellow
        & $NSSMPath remove $ServiceName confirm
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Installation annulee" -ForegroundColor Red
        Read-Host "Appuyez sur Entree"
        exit 0
    }
}

# Creer dossier logs
$LogsPath = Join-Path $ServerPath "logs"
if (!(Test-Path $LogsPath)) {
    New-Item -ItemType Directory -Path $LogsPath | Out-Null
}

Write-Host "Installation du service..." -ForegroundColor Yellow

# Installer avec NSSM
& $NSSMPath install $ServiceName $NodeExe $ServerScript

# Configuration
& $NSSMPath set $ServiceName AppDirectory $ServerPath
& $NSSMPath set $ServiceName DisplayName "DashNov Server"
& $NSSMPath set $ServiceName Description "Serveur backend pour DashNov"
& $NSSMPath set $ServiceName Start SERVICE_AUTO_START

# Logs
& $NSSMPath set $ServiceName AppStdout "$LogsPath\service-output.log"
& $NSSMPath set $ServiceName AppStderr "$LogsPath\service-error.log"
& $NSSMPath set $ServiceName AppRotateFiles 1
& $NSSMPath set $ServiceName AppRotateBytes 1048576

# Demarrer
Write-Host "Demarrage du service..." -ForegroundColor Yellow
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3

# Verification
$service = Get-Service -Name $ServiceName
if ($service.Status -eq 'Running') {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Service installe avec succes!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Nom:     $ServiceName"
    Write-Host "  Statut:  $($service.Status)" -ForegroundColor Green
    Write-Host "  Chemin:  $ServerPath"
    Write-Host "  Logs:    $LogsPath"
    Write-Host ""
    Write-Host "Commandes utiles:" -ForegroundColor Yellow
    Write-Host "  Stop-Service $ServiceName" -ForegroundColor Gray
    Write-Host "  Start-Service $ServiceName" -ForegroundColor Gray
    Write-Host "  Restart-Service $ServiceName" -ForegroundColor Gray
    Write-Host "  Get-Service $ServiceName" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERREUR] Le service n'a pas demarre" -ForegroundColor Red
    Write-Host "   Verifiez les logs: $LogsPath" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Appuyez sur Entree pour fermer"
