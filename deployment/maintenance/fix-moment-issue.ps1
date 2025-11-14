#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Fix missing moment package issue
.DESCRIPTION
    Copies moment from root node_modules to Server/node_modules
#>

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param([string]$Message, [string]$Type = "INFO")

    switch ($Type) {
        "SUCCESS" { Write-Host $Message -ForegroundColor Green }
        "ERROR"   { Write-Host $Message -ForegroundColor Red }
        "WARN"    { Write-Host $Message -ForegroundColor Yellow }
        default   { Write-Host $Message -ForegroundColor Cyan }
    }
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "   DASHNOV - Fix Moment Package Issue" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Verify root node_modules has moment
$rootMoment = "C:\DASHNOV\node_modules\moment"
$serverMoment = "C:\DASHNOV\Server\node_modules\moment"

if (-not (Test-Path $rootMoment)) {
    Write-ColorOutput "ERREUR: moment introuvable dans C:\DASHNOV\node_modules" "ERROR"
    exit 1
}

Write-ColorOutput "moment trouve dans node_modules racine" "SUCCESS"

# Check if Server/node_modules/moment exists
if (Test-Path $serverMoment) {
    Write-ColorOutput "moment existe deja dans Server/node_modules" "WARN"
    Write-ColorOutput "Verification de l'integrite..." "INFO"

    # Check if package.json exists
    if (-not (Test-Path "$serverMoment\package.json")) {
        Write-ColorOutput "package.json manquant! Remplacement necessaire" "WARN"
        Remove-Item $serverMoment -Recurse -Force
    } else {
        Write-ColorOutput "moment semble correct dans Server/node_modules" "SUCCESS"
        exit 0
    }
}

# Copy moment from root to Server
Write-ColorOutput "`nCopie de moment depuis la racine vers Server/node_modules..." "INFO"

try {
    Copy-Item $rootMoment -Destination "C:\DASHNOV\Server\node_modules\moment" -Recurse -Force
    Write-ColorOutput "moment copie avec succes" "SUCCESS"

    # Verify the copy
    if (Test-Path "$serverMoment\package.json") {
        Write-ColorOutput "Verification: package.json present" "SUCCESS"
    } else {
        Write-ColorOutput "ATTENTION: package.json toujours manquant" "ERROR"
    }

    # Test if moment can be required
    Write-ColorOutput "`nTest de chargement du module..." "INFO"
    $testResult = & node -e "try { require('moment'); console.log('OK'); } catch(e) { console.log('ERROR: ' + e.message); }" 2>&1

    if ($testResult -match "OK") {
        Write-ColorOutput "moment peut etre charge correctement" "SUCCESS"
    } else {
        Write-ColorOutput "Probleme lors du chargement: $testResult" "ERROR"
    }

} catch {
    Write-ColorOutput "Erreur lors de la copie: $_" "ERROR"
    exit 1
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "   CORRECTION TERMINEE" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green

Write-ColorOutput "Vous pouvez maintenant:" "INFO"
Write-ColorOutput "  1. Tester le serveur: cd C:\DASHNOV\Server && node server.js" "INFO"
Write-ColorOutput "  2. Recreer l'installeur: .\Scripts\build-installer.ps1 -Version 1.3" "INFO"

exit 0
