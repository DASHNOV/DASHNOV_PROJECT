#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Script de mise à jour de l'interface web sur machine cliente
.DESCRIPTION
    Remplace l'interface provisoire par la vraie interface DashNov
#>

param(
    [string]$SourcePackage = "C:\Temp\DASHNOV_Setup_v1.2",
    [string]$TargetInstall = "C:\DashNov"
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
Write-Host "   DASHNOV - Mise a jour Interface Web" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Vérifier que le dossier source existe
if (-not (Test-Path $SourcePackage)) {
    Write-ColorOutput "ERREUR: Package source introuvable dans $SourcePackage" "ERROR"
    Write-ColorOutput "Veuillez extraire DASHNOV_Setup_v1.2.zip dans C:\Temp\" "INFO"
    exit 1
}

# Vérifier que l'installation cible existe
if (-not (Test-Path $TargetInstall)) {
    Write-ColorOutput "ERREUR: Installation cible introuvable dans $TargetInstall" "ERROR"
    exit 1
}

# ÉTAPE 1 : Arrêter le service
Write-ColorOutput "Etape 1: Arret du service..." "INFO"
try {
    Stop-Service -Name "DashNovService" -Force -ErrorAction Stop
    Write-ColorOutput "Service arrete" "SUCCESS"
} catch {
    Write-ColorOutput "Impossible d'arreter le service (peut-etre deja arrete)" "WARN"
}
Start-Sleep -Seconds 2

# ÉTAPE 2 : Sauvegarder l'ancienne interface
Write-ColorOutput "`nEtape 2: Sauvegarde de l'ancienne interface..." "INFO"
$oldPublic = "$TargetInstall\Server\public"
if (Test-Path $oldPublic) {
    $backupDir = "$TargetInstall\Server\public_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Move-Item $oldPublic $backupDir -Force
    Write-ColorOutput "Ancienne interface sauvegardee : $backupDir" "SUCCESS"
}

# ÉTAPE 3 : Copier la nouvelle interface
Write-ColorOutput "`nEtape 3: Installation de la nouvelle interface..." "INFO"

$sourcePublic = "$SourcePackage\Server\public"
if (-not (Test-Path $sourcePublic)) {
    Write-ColorOutput "ERREUR: Interface introuvable dans le package source" "ERROR"
    Write-ColorOutput "Chemin attendu: $sourcePublic" "ERROR"
    exit 1
}

# Créer le dossier public
$targetPublic = "$TargetInstall\Server\public"
New-Item -ItemType Directory -Path $targetPublic -Force | Out-Null

# Copier index.html
$sourceIndex = "$sourcePublic\index.html"
if (Test-Path $sourceIndex) {
    Copy-Item $sourceIndex -Destination $targetPublic -Force
    Write-ColorOutput "index.html copie" "SUCCESS"
} else {
    Write-ColorOutput "ERREUR: index.html introuvable" "ERROR"
    exit 1
}

# Copier le dossier assets
$sourceAssets = "$sourcePublic\assets"
if (Test-Path $sourceAssets) {
    Copy-Item $sourceAssets -Destination $targetPublic -Recurse -Force
    Write-ColorOutput "Dossier assets copie (css, js, fonts, logo)" "SUCCESS"
} else {
    Write-ColorOutput "ERREUR: Dossier assets introuvable" "ERROR"
    exit 1
}

# ÉTAPE 4 : Vérifier la nouvelle interface
Write-ColorOutput "`nEtape 4: Verification de l'installation..." "INFO"

$filesCheck = @(
    "$targetPublic\index.html",
    "$targetPublic\assets\css",
    "$targetPublic\assets\js",
    "$targetPublic\assets\fonts",
    "$targetPublic\assets\logo"
)

$allOk = $true
foreach ($file in $filesCheck) {
    if (Test-Path $file) {
        Write-ColorOutput "  OK: $(Split-Path $file -Leaf)" "SUCCESS"
    } else {
        Write-ColorOutput "  MANQUANT: $(Split-Path $file -Leaf)" "ERROR"
        $allOk = $false
    }
}

if (-not $allOk) {
    Write-ColorOutput "`nATTENTION: Certains fichiers sont manquants" "WARN"
}

# ÉTAPE 5 : Redémarrer le service
Write-ColorOutput "`nEtape 5: Redemarrage du service..." "INFO"
try {
    Start-Service -Name "DashNovService" -ErrorAction Stop
    Start-Sleep -Seconds 3

    $service = Get-Service -Name "DashNovService"
    if ($service.Status -eq 'Running') {
        Write-ColorOutput "Service demarre avec succes" "SUCCESS"
    } else {
        Write-ColorOutput "Service dans l'etat: $($service.Status)" "WARN"
    }
} catch {
    Write-ColorOutput "Erreur lors du demarrage du service: $_" "ERROR"
    Write-ColorOutput "Demarrez manuellement avec: Start-Service DashNovService" "INFO"
}

# ÉTAPE 6 : Test de l'application
Write-ColorOutput "`nEtape 6: Test de l'application..." "INFO"
Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8085" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop

    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "Application accessible sur http://localhost:8085" "SUCCESS"

        # Vérifier que la nouvelle interface est bien chargée
        if ($response.Content -match "DashNov5") {
            Write-ColorOutput "NOUVELLE INTERFACE detectee !" "SUCCESS"
        } else {
            Write-ColorOutput "Interface chargee mais verifiez le contenu" "WARN"
        }
    }
} catch {
    Write-ColorOutput "Application ne repond pas encore" "WARN"
    Write-ColorOutput "Patientez quelques secondes et testez : http://localhost:8085" "INFO"
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "   MISE A JOUR TERMINEE" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green

Write-ColorOutput "Actions effectuees:" "INFO"
Write-ColorOutput "  [1] Ancienne interface sauvegardee" "SUCCESS"
Write-ColorOutput "  [2] Nouvelle interface installee (DashNov5_GUI + assets)" "SUCCESS"
Write-ColorOutput "  [3] Service redémarre" "SUCCESS"
Write-Host ""
Write-ColorOutput "Testez maintenant:" "INFO"
Write-ColorOutput "  - Ouvrez : http://localhost:8085" "INFO"
Write-ColorOutput "  - Vous devriez voir la VRAIE interface DashNov avec logo et styles" "INFO"
Write-ColorOutput "  - Si probleme, verifiez : C:\DashNov\Logs\service-error.log" "INFO"
Write-Host "`n"

# Proposer d'ouvrir le navigateur
$openBrowser = Read-Host "Voulez-vous ouvrir l'application dans le navigateur maintenant ? (O/N)"
if ($openBrowser -eq "O") {
    Start-Process "http://localhost:8085"
}

exit 0
