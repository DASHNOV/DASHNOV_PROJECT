#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Script de réparation pour installation DashNov cliente
.DESCRIPTION
    Corrige les problèmes de démarrage du service DashNov
#>

param(
    [string]$InstallPath = "C:\DashNov"
)

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
Write-Host "   DASHNOV - Script de Reparation" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# ÉTAPE 1 : Corriger le fichier server.js
Write-ColorOutput "Etape 1: Correction du fichier server.js..." "INFO"

$serverFile = Join-Path $InstallPath "Server\server.js"

if (-not (Test-Path $serverFile)) {
    Write-ColorOutput "ERREUR: Fichier server.js introuvable dans $serverFile" "ERROR"
    exit 1
}

try {
    # Lire le contenu
    $content = Get-Content $serverFile -Raw -Encoding UTF8

    # Vérifier si le problème existe
    $pathCount = ([regex]::Matches($content, "const path = require\('path'\);")).Count

    if ($pathCount -gt 1) {
        Write-ColorOutput "Probleme detecte: 'path' declare $pathCount fois" "WARN"

        # Créer une sauvegarde
        $backupFile = "$serverFile.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $serverFile $backupFile -Force
        Write-ColorOutput "Sauvegarde creee: $backupFile" "INFO"

        # Correction : Supprimer les lignes 19-21 problématiques et réorganiser
        $lines = Get-Content $serverFile -Encoding UTF8
        $newLines = @()

        $skipNext = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]

            # Ligne 19 : doublon de path - SKIP
            if ($i -eq 18 -and $line -match "const path = require\('path'\);") {
                Write-ColorOutput "  Ligne 19 supprimee (doublon)" "INFO"
                continue
            }

            # Ligne 21 : app.use avant déclaration - SKIP (on le remettra après)
            if ($line -match "^app\.use\(express\.static\(path\.join\(__dirname, 'public'\)\)\);?$") {
                Write-ColorOutput "  Ligne app.use() deplacee" "INFO"
                $appUseLine = $line
                continue
            }

            # Ajouter app.use() après la déclaration de app
            if ($line -match "^const app = express\(\);?$") {
                $newLines += $line
                if ($appUseLine) {
                    $newLines += "app.use(express.static(path.join(__dirname, 'public')));"
                    $newLines += ""
                }
                continue
            }

            $newLines += $line
        }

        # Écrire le fichier corrigé
        $newLines | Out-File -FilePath $serverFile -Encoding UTF8 -Force
        Write-ColorOutput "Fichier server.js corrige avec succes" "SUCCESS"
    } else {
        Write-ColorOutput "Fichier server.js deja correct" "SUCCESS"
    }
} catch {
    Write-ColorOutput "Erreur lors de la correction du fichier: $_" "ERROR"
    exit 1
}

# ÉTAPE 2 : Reconfigurer le service NSSM
Write-ColorOutput "`nEtape 2: Reconfiguration du service Windows..." "INFO"

$service = Get-Service -Name "DashNovService" -ErrorAction SilentlyContinue

if (-not $service) {
    Write-ColorOutput "Service DashNovService introuvable" "WARN"
    Write-ColorOutput "Le service n'est peut-etre pas installe" "WARN"
} else {
    # Trouver NSSM
    $nssmPaths = @(
        "C:\DashNov\Tools\nssm-2.24\win64\nssm.exe",
        "C:\DashNov\Tools\nssm-2.24\win32\nssm.exe",
        "C:\Program Files\nssm\nssm.exe"
    )

    $nssmExe = $nssmPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $nssmExe) {
        Write-ColorOutput "NSSM non trouve, recherche dans le systeme..." "WARN"
        $nssmExe = Get-Command nssm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    }

    if ($nssmExe) {
        Write-ColorOutput "NSSM trouve: $nssmExe" "SUCCESS"

        # Arrêter le service
        Write-ColorOutput "Arret du service..." "INFO"
        Stop-Service -Name "DashNovService" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # Reconfigurer le chemin du script
        $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
        if (-not $nodePath) {
            $nodePath = "C:\Program Files\nodejs\node.exe"
        }

        $serverScript = Join-Path $InstallPath "Server\server.js"

        Write-ColorOutput "Reconfiguration du service avec:" "INFO"
        Write-ColorOutput "  Node.js: $nodePath" "INFO"
        Write-ColorOutput "  Script : $serverScript" "INFO"

        # Mettre à jour la configuration NSSM
        & $nssmExe set DashNovService Application $nodePath
        & $nssmExe set DashNovService AppParameters $serverScript
        & $nssmExe set DashNovService AppDirectory "$InstallPath\Server"

        Write-ColorOutput "Service reconfigure" "SUCCESS"

        # Redémarrer le service
        Write-ColorOutput "Demarrage du service..." "INFO"
        Start-Sleep -Seconds 2

        try {
            Start-Service -Name "DashNovService" -ErrorAction Stop
            Start-Sleep -Seconds 3

            $serviceStatus = (Get-Service -Name "DashNovService").Status

            if ($serviceStatus -eq 'Running') {
                Write-ColorOutput "Service demarre avec succes !" "SUCCESS"
            } else {
                Write-ColorOutput "Service dans l'etat: $serviceStatus" "WARN"
            }
        } catch {
            Write-ColorOutput "Erreur lors du demarrage du service: $_" "ERROR"
            Write-ColorOutput "Verifiez les logs: $InstallPath\Logs\service-error.log" "WARN"
        }
    } else {
        Write-ColorOutput "NSSM non trouve, impossible de reconfigurer le service" "ERROR"
        Write-ColorOutput "Service doit etre reconfigure manuellement" "WARN"
    }
}

# ÉTAPE 3 : Test de l'application
Write-ColorOutput "`nEtape 3: Test de l'application..." "INFO"
Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8085" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop

    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "Application accessible sur http://localhost:8085" "SUCCESS"
    }
} catch {
    Write-ColorOutput "L'application ne repond pas encore" "WARN"
    Write-ColorOutput "Verifiez manuellement avec: cd $InstallPath\Server && node server.js" "INFO"
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "   REPARATION TERMINEE" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green

Write-ColorOutput "Actions effectuees:" "INFO"
Write-ColorOutput "  [1] Fichier server.js corrige" "SUCCESS"
Write-ColorOutput "  [2] Service DashNovService reconfigure" "SUCCESS"
Write-ColorOutput "  [3] Service redémarre" "SUCCESS"
Write-Host ""
Write-ColorOutput "Verifications:" "INFO"
Write-ColorOutput "  - URL: http://localhost:8085" "INFO"
Write-ColorOutput "  - Service: Get-Service DashNovService" "INFO"
Write-ColorOutput "  - Logs: $InstallPath\Logs\service-error.log" "INFO"
Write-Host "`n"

exit 0
