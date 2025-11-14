# ============================================
# Script de demarrage DashNov Server
# ============================================

$Host.UI.RawUI.WindowTitle = "DashNov Server"
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DashNov Server - Demarrage" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Se placer dans le dossier du script
Set-Location $PSScriptRoot

# Verifier Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js detecte: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Node.js non installe" -ForegroundColor Red
    Write-Host "   Telechargez depuis: https://nodejs.org" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Appuyez sur Entree"
    exit 1
}

# Verifier SQL.env
if (!(Test-Path "SQL.env")) {
    Write-Host "[ERREUR] Fichier SQL.env introuvable" -ForegroundColor Red
    Write-Host "   Creez ce fichier avec les parametres de connexion" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Appuyez sur Entree"
    exit 1
}
Write-Host "[OK] Configuration SQL.env trouvee" -ForegroundColor Green

# Verifier node_modules
if (!(Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "Installation des dependances..." -ForegroundColor Yellow
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERREUR] Echec de l'installation" -ForegroundColor Red
        Write-Host ""
        Read-Host "Appuyez sur Entree"
        exit 1
    }
}
Write-Host "[OK] Dependances verifiees" -ForegroundColor Green
Write-Host ""

# Demarrer
Write-Host "Demarrage du serveur..." -ForegroundColor Cyan
Write-Host ""
Write-Host "============================================" -ForegroundColor DarkGray
Write-Host ""

node DashNov_Server.js

Write-Host ""
Write-Host "============================================" -ForegroundColor DarkGray
Write-Host ""
Read-Host "Appuyez sur Entree pour fermer"
