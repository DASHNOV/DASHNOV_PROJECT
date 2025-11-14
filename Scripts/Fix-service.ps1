#Requires -RunAsAdministrator

# Configuration
$InstallPath = "C:\DashNov"
$ServiceName = "DashNovService"
$nssmPath = Join-Path $InstallPath "Tools\nssm-2.24\win64\nssm.exe"

Write-Host "`n=== RÉINSTALLATION DU SERVICE DASHNOV ===" -ForegroundColor Cyan

# Vérifier que NSSM existe
if (-not (Test-Path $nssmPath)) {
    Write-Host "[ERREUR] NSSM introuvable : $nssmPath" -ForegroundColor Red
    Write-Host "Vérifiez que l'installation s'est bien déroulée." -ForegroundColor Yellow
    exit 1
}

Write-Host "NSSM trouvé : $nssmPath" -ForegroundColor Green

# 1. Arrêter et supprimer le service existant
Write-Host "`n[1] Suppression de l'ancien service..." -ForegroundColor Yellow
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq 'Running') {
        Write-Host "  Arrêt du service..." -ForegroundColor Gray
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    Write-Host "  Suppression du service..." -ForegroundColor Gray
    & $nssmPath stop $ServiceName 2>&1 | Out-Null
    & $nssmPath remove $ServiceName confirm 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    
    Write-Host "  [OK] Service supprimé" -ForegroundColor Green
} else {
    Write-Host "  Aucun service à supprimer" -ForegroundColor Gray
}

# 2. Obtenir le chemin complet de Node.js
Write-Host "`n[2] Recherche de Node.js..." -ForegroundColor Yellow
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $nodePath -or -not (Test-Path $nodePath)) {
    Write-Host "  [ERREUR] Node.js introuvable" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Node.js trouvé : $nodePath" -ForegroundColor Green

# 3. Vérifier les fichiers
Write-Host "`n[3] Vérification des fichiers..." -ForegroundColor Yellow
$serverPath = Join-Path $InstallPath "Server"
$serverScript = Join-Path $serverPath "server.js"
$envFile = Join-Path $serverPath "SQL.env"
$logPath = Join-Path $InstallPath "Logs"

if (-not (Test-Path $serverScript)) {
    Write-Host "  [ERREUR] server.js introuvable : $serverScript" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $envFile)) {
    Write-Host "  [ERREUR] SQL.env introuvable : $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] server.js trouvé" -ForegroundColor Green
Write-Host "  [OK] SQL.env trouvé" -ForegroundColor Green

# Créer le dossier Logs s'il n'existe pas
if (-not (Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
}

Write-Host "  [OK] Dossier Logs prêt" -ForegroundColor Green

# 4. Installer le service
Write-Host "`n[4] Installation du nouveau service..." -ForegroundColor Yellow

try {
    # Installation de base
    Write-Host "  Installation du service..." -ForegroundColor Gray
    & $nssmPath install $ServiceName "$nodePath" "$serverScript"
    
    if ($LASTEXITCODE -ne 0) {
        throw "Échec de l'installation (code: $LASTEXITCODE)"
    }
    
    Write-Host "  [OK] Service installé" -ForegroundColor Green
    
    # Configuration du répertoire de travail
    & $nssmPath set $ServiceName AppDirectory "$serverPath" | Out-Null
    Write-Host "  [OK] Répertoire de travail configuré" -ForegroundColor Green
    
    # Configuration des logs
    $stdoutLog = Join-Path $logPath "service.log"
    $stderrLog = Join-Path $logPath "service-error.log"
    
    & $nssmPath set $ServiceName AppStdout "$stdoutLog" | Out-Null
    & $nssmPath set $ServiceName AppStderr "$stderrLog" | Out-Null
    & $nssmPath set $ServiceName AppStdoutCreationDisposition 4 | Out-Null
    & $nssmPath set $ServiceName AppStderrCreationDisposition 4 | Out-Null
    & $nssmPath set $ServiceName AppRotateFiles 1 | Out-Null
    & $nssmPath set $ServiceName AppRotateBytes 1048576 | Out-Null
    & $nssmPath set $ServiceName AppRotateOnline 1 | Out-Null
    
    Write-Host "  [OK] Logs configurés" -ForegroundColor Green
    Write-Host "    → Logs normaux: $stdoutLog" -ForegroundColor Gray
    Write-Host "    → Logs erreurs: $stderrLog" -ForegroundColor Gray
    
    # Configuration du service
    & $nssmPath set $ServiceName DisplayName "DashNov Application Server" | Out-Null
    & $nssmPath set $ServiceName Description "Serveur web DashNov - Gestion des données Amadeus" | Out-Null
    & $nssmPath set $ServiceName Start SERVICE_AUTO_START | Out-Null
    
    Write-Host "  [OK] Métadonnées du service configurées" -ForegroundColor Green
    
    # Configuration de la reprise automatique
    & $nssmPath set $ServiceName AppExit Default Restart | Out-Null
    & $nssmPath set $ServiceName AppRestartDelay 5000 | Out-Null
    & $nssmPath set $ServiceName AppThrottle 10000 | Out-Null
    
    Write-Host "  [OK] Reprise automatique configurée" -ForegroundColor Green
    
    # Configuration du compte utilisateur
    & $nssmPath set $ServiceName ObjectName LocalSystem | Out-Null
    
    Write-Host "  [OK] Compte utilisateur configuré (LocalSystem)" -ForegroundColor Green
    
} catch {
    Write-Host "  [ERREUR] $_" -ForegroundColor Red
    exit 1
}

# 5. Démarrer le service
Write-Host "`n[5] Démarrage du service..." -ForegroundColor Yellow

try {
    Start-Service -Name $ServiceName -ErrorAction Stop
    Start-Sleep -Seconds 5
    
    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq 'Running') {
        Write-Host "  [OK] Service démarré avec succès" -ForegroundColor Green
    } else {
        throw "Le service ne s'est pas démarré correctement (statut: $($service.Status))"
    }
    
} catch {
    Write-Host "  [ERREUR] Impossible de démarrer le service : $_" -ForegroundColor Red
    Write-Host "`n  Vérifiez les logs :" -ForegroundColor Yellow
    Write-Host "    - $stdoutLog" -ForegroundColor Gray
    Write-Host "    - $stderrLog" -ForegroundColor Gray
    
    if (Test-Path $stderrLog) {
        Write-Host "`n  Dernières erreurs :" -ForegroundColor Yellow
        Get-Content $stderrLog -Tail 20
    }
    
    exit 1
}

# 6. Test de connectivité
Write-Host "`n[6] Test de connectivité..." -ForegroundColor Yellow
$maxAttempts = 10
$attempt = 0
$url = "http://localhost:8085"

while ($attempt -lt $maxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  [OK] Application accessible sur $url" -ForegroundColor Green
            break
        }
    } catch {
        $attempt++
        if ($attempt -lt $maxAttempts) {
            Write-Host "  Tentative $attempt/$maxAttempts..." -ForegroundColor Gray
            Start-Sleep -Seconds 3
        }
    }
}

if ($attempt -eq $maxAttempts) {
    Write-Host "  [ATTENTION] L'application ne répond pas après 30 secondes" -ForegroundColor Yellow
    Write-Host "  Vérifiez les logs pour plus de détails." -ForegroundColor Gray
    
    # Afficher les logs si disponibles
    if (Test-Path $stdoutLog) {
        Write-Host "`n  Derniers logs :" -ForegroundColor Yellow
        Get-Content $stdoutLog -Tail 20
    }
}

Write-Host "`n=== RÉINSTALLATION TERMINÉE ===" -ForegroundColor Cyan
Write-Host "`nCommandes utiles :" -ForegroundColor Yellow
Write-Host "  Voir les logs      : Get-Content `"$stdoutLog`" -Tail 50 -Wait" -ForegroundColor Gray
Write-Host "  Voir les erreurs   : Get-Content `"$stderrLog`" -Tail 50 -Wait" -ForegroundColor Gray
Write-Host "  Redémarrer service : Restart-Service $ServiceName" -ForegroundColor Gray
Write-Host "  Arrêter service    : Stop-Service $ServiceName" -ForegroundColor Gray
Write-Host "  État du service    : Get-Service $ServiceName | Format-List *" -ForegroundColor Gray
