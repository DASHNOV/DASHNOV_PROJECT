#Requires -RunAsAdministrator

param(
    [string]$OutputPath = "C:\DASHNOV_Installer_Build",
    [string]$Version = "1.0"
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
Write-Host "   DASHNOV - Build Package Installer" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Créer le dossier de build
Write-ColorOutput "Preparation du dossier de build..." "INFO"
if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null

$buildPath = Join-Path $OutputPath "DASHNOV_Setup_v$Version"
New-Item -ItemType Directory -Path $buildPath -Force | Out-Null

@("NodeJS", "Database", "Server", "Tools") | ForEach-Object {
    New-Item -ItemType Directory -Path "$buildPath\$_" -Force | Out-Null
}

Write-ColorOutput "Structure creee" "SUCCESS"

# ===== COPIE DU SERVEUR =====
Write-ColorOutput "`nCopie du serveur..." "INFO"

$serverSource = "C:\DASHNOV\src\server"
$serverDest = "$buildPath\Server"

if (-not (Test-Path $serverSource)) {
    Write-ColorOutput "ERREUR : Serveur introuvable dans $serverSource" "ERROR"
    exit 1
}

@("index.js", "package.json", "package-lock.json", ".env.example") | ForEach-Object {
    $file = Join-Path $serverSource $_
    if (Test-Path $file) {
        Copy-Item $file -Destination $serverDest -Force
        Write-ColorOutput "  Copie: $_" "SUCCESS"
    } else {
        Write-ColorOutput "  Manquant: $_" "WARN"
    }
}

# Copier SQL.env depuis config/
$sqlEnvSource = Join-Path $serverSource "config\SQL.env"
if (Test-Path $sqlEnvSource) {
    Copy-Item $sqlEnvSource -Destination $serverDest -Force
    Write-ColorOutput "  Copie: SQL.env (depuis config/)" "SUCCESS"
} else {
    Write-ColorOutput "  Manquant: config/SQL.env" "WARN"
}

# Créer le dossier public pour l'interface web
$publicDest = Join-Path $serverDest "public"
New-Item -ItemType Directory -Path $publicDest -Force | Out-Null

# Copier la vraie interface web : DashNov5_GUI.html → public/index.html
$dashnovGUI = "C:\DASHNOV\src\client\index.html"
if (Test-Path $dashnovGUI) {
    Copy-Item $dashnovGUI -Destination "$publicDest\index.html" -Force
    Write-ColorOutput "  Interface principale copiee (DashNov5_GUI.html -> index.html)" "SUCCESS"
} else {
    Write-ColorOutput "  ERREUR: DashNov5_GUI.html introuvable" "ERROR"
    exit 1
}

# Copier le dossier assets (CSS, JS, fonts, logo)
$assetsSource = "C:\DASHNOV\src\client\assets"
if (Test-Path $assetsSource) {
    Write-ColorOutput "  Copie du dossier assets/..." "INFO"
    Copy-Item $assetsSource -Destination "$publicDest\assets" -Recurse -Force
    Write-ColorOutput "  Dossier assets copie (css, js, fonts, logo)" "SUCCESS"
} else {
    Write-ColorOutput "  ERREUR: Dossier assets/ introuvable" "ERROR"
    exit 1
}

$nodeModulesSource = Join-Path $serverSource "node_modules"
if (Test-Path $nodeModulesSource) {
    Write-ColorOutput "  Copie de node_modules..." "INFO"
    Copy-Item $nodeModulesSource -Destination $serverDest -Recurse -Force
    Write-ColorOutput "  node_modules copie" "SUCCESS"
} else {
    Write-ColorOutput "  ERREUR: node_modules absent dans le serveur source" "ERROR"
    Write-ColorOutput "  Pour une installation hors-ligne, node_modules est OBLIGATOIRE" "ERROR"
    Write-ColorOutput "" "INFO"
    Write-ColorOutput "  Solution : Executer 'npm install' dans $serverSource" "INFO"
    Write-ColorOutput "" "INFO"

    $response = Read-Host "Voulez-vous executer 'npm install' maintenant ? (O/N)"
    if ($response -eq "O") {
        Write-ColorOutput "  Installation des dependances npm..." "INFO"
        Push-Location $serverSource
        $output = & npm install --production 2>&1
        Pop-Location

        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "  npm install reussi, copie en cours..." "SUCCESS"
            Copy-Item $nodeModulesSource -Destination $serverDest -Recurse -Force
            Write-ColorOutput "  node_modules copie" "SUCCESS"
        } else {
            Write-ColorOutput "  Erreur npm install : $output" "ERROR"
            exit 1
        }
    } else {
        Write-ColorOutput "  ATTENTION: Le package ne pourra PAS fonctionner sans node_modules" "ERROR"
        $response2 = Read-Host "Continuer quand meme ? (O/N)"
        if ($response2 -ne "O") {
            exit 1
        }
    }
}

# ===== SAUVEGARDE BASE DE DONNÉES =====
Write-ColorOutput "`nSauvegarde de la base de donnees..." "INFO"

$backupFolder = "C:\DASHNOV\Backup"
if (-not (Test-Path $backupFolder)) {
    New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
}

$backupPath = "$backupFolder\Amadeus5.bak"

# Supprimer l'ancien backup
if (Test-Path $backupPath) {
    Remove-Item $backupPath -Force
    Write-ColorOutput "Ancien backup supprime" "INFO"
}

$backupQuery = @"
BACKUP DATABASE Amadeus5 
TO DISK = N'$backupPath'
WITH FORMAT, INIT, CHECKSUM;
"@

$backupSuccess = $false

try {
    # Méthode 1 : Invoke-Sqlcmd
    if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
        Write-ColorOutput "Sauvegarde via Invoke-Sqlcmd..." "INFO"
        Write-ColorOutput "Patientez (1-3 minutes)..." "INFO"
        
        Invoke-Sqlcmd -Query $backupQuery -ServerInstance "DASHNOV\DASHNOV" -QueryTimeout 600 -ErrorAction Stop
        $backupSuccess = $true
        Write-ColorOutput "Sauvegarde SQL reussie" "SUCCESS"
    }
    # Méthode 2 : sqlcmd.exe
    elseif (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
        Write-ColorOutput "Sauvegarde via sqlcmd.exe..." "INFO"
        Write-ColorOutput "Patientez (1-3 minutes)..." "INFO"
        
        $tempFile = "$env:TEMP\backup.sql"
        $backupQuery | Out-File -FilePath $tempFile -Encoding ASCII
        
        $output = & sqlcmd -S "DASHNOV\DASHNOV" -E -i $tempFile -b 2>&1
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -eq 0) {
            $backupSuccess = $true
            Write-ColorOutput "Sauvegarde SQL reussie" "SUCCESS"
        } else {
            throw "Erreur sqlcmd : $output"
        }
    }
    else {
        throw "Aucun outil SQL disponible"
    }
    
} catch {
    Write-ColorOutput "ERREUR sauvegarde : $($_.Exception.Message)" "ERROR"
    Write-ColorOutput "" "INFO"
    Write-ColorOutput "Options :" "WARN"
    Write-ColorOutput "  1. Corriger l'instance SQL et reessayer" "INFO"
    Write-ColorOutput "  2. Copier manuellement un backup existant vers :" "INFO"
    Write-ColorOutput "     $backupFolder\Amadeus5.bak" "INFO"
    Write-ColorOutput "  3. Continuer sans backup (installation impossible)" "WARN"
    Write-ColorOutput "" "INFO"
    
    $response = Read-Host "Continuer quand meme ? (O/N)"
    if ($response -ne "O") {
        exit 1
    }
}

# VÉRIFICATION CRITIQUE : Le fichier existe-t-il ?
if (Test-Path $backupPath) {
    $backupSize = (Get-Item $backupPath).Length / 1MB
    Write-ColorOutput "Backup valide : $([math]::Round($backupSize, 2)) MB" "SUCCESS"
    
    # Copier dans le package d'installation
    Copy-Item $backupPath -Destination "$buildPath\Database\" -Force
    Write-ColorOutput "Backup copie dans le package" "SUCCESS"
} else {
    Write-ColorOutput "ERREUR CRITIQUE : Fichier backup absent" "ERROR"
    Write-ColorOutput "Le package ne pourra PAS installer la base de donnees" "ERROR"
    
    $response = Read-Host "Arreter le build ? (O/N)"
    if ($response -eq "O") {
        exit 1
    }
}


# ===== COPIE NODE.JS =====
Write-ColorOutput "`nRecherche de Node.js..." "INFO"

$nodeInstallers = Get-ChildItem -Path "C:\Users\*\Downloads" -Filter "node-v*-x64.msi" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($nodeInstallers) {
    Copy-Item $nodeInstallers.FullName -Destination "$buildPath\NodeJS\" -Force
    Write-ColorOutput "Node.js copie: $($nodeInstallers.Name)" "SUCCESS"
} else {
    Write-ColorOutput "Installeur Node.js introuvable" "WARN"
}

# ===== COPIE SQL SERVER EXPRESS (OPTIONNEL) =====
Write-ColorOutput "`nRecherche de SQL Server Express (optionnel)..." "INFO"

$sqlInstallers = Get-ChildItem -Path "C:\Users\*\Downloads" -Filter "*SQLEXPR*.exe" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($sqlInstallers) {
    Write-ColorOutput "SQL Server Express trouve: $($sqlInstallers.Name)" "SUCCESS"
    $includeSQL = Read-Host "Voulez-vous l'inclure dans le package ? (O/N) [Ajoute ~500 MB]"

    if ($includeSQL -eq "O") {
        New-Item -ItemType Directory -Path "$buildPath\Database" -Force -ErrorAction SilentlyContinue | Out-Null
        Copy-Item $sqlInstallers.FullName -Destination "$buildPath\Database\" -Force
        Write-ColorOutput "SQL Server Express copie" "SUCCESS"
    } else {
        Write-ColorOutput "SQL Server Express non inclus" "INFO"
    }
} else {
    Write-ColorOutput "Installeur SQL Server Express introuvable" "INFO"
    Write-ColorOutput "Le client devra avoir SQL Server preinstalle" "WARN"
}

# ===== COPIE NSSM =====
Write-ColorOutput "`nCopie de NSSM..." "INFO"

$nssmPath = "C:\DASHNOV\deployment\tools\nssm-2.24"
if (Test-Path $nssmPath) {
    Copy-Item -Path $nssmPath -Destination "$buildPath\Tools\" -Recurse -Force
    Write-ColorOutput "NSSM copie" "SUCCESS"
} else {
    Write-ColorOutput "NSSM introuvable, telechargement..." "WARN"
    
    try {
        $nssmZip = "$buildPath\Tools\nssm.zip"
        Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath "$buildPath\Tools\" -Force
        Remove-Item $nssmZip -Force
        Write-ColorOutput "NSSM telecharge" "SUCCESS"
    } catch {
        Write-ColorOutput "Impossible de telecharger NSSM" "WARN"
    }
}

# ===== COPIE SCRIPTS =====
Write-ColorOutput "`nCopie des scripts..." "INFO"

$installScript = "C:\DASHNOV\deployment\installer\Install.ps1"
if (Test-Path $installScript) {
    Copy-Item $installScript -Destination $buildPath -Force
    Write-ColorOutput "Install.ps1 copie" "SUCCESS"
} else {
    Write-ColorOutput "ERREUR: Install.ps1 introuvable" "ERROR"
    exit 1
}

$fixScript = "C:\DASHNOV\deployment\installer\fix-client-installation.ps1"
if (Test-Path $fixScript) {
    Copy-Item $fixScript -Destination $buildPath -Force
    Write-ColorOutput "fix-client-installation.ps1 copie" "SUCCESS"
} else {
    Write-ColorOutput "Script de reparation non trouve (optionnel)" "WARN"
}

$updateScript = "C:\DASHNOV\deployment\installer\update-interface-client.ps1"
if (Test-Path $updateScript) {
    Copy-Item $updateScript -Destination $buildPath -Force
    Write-ColorOutput "update-interface-client.ps1 copie" "SUCCESS"
} else {
    Write-ColorOutput "Script de mise a jour interface non trouve (optionnel)" "WARN"
}

# Créer Setup.bat
$setupBat = @'
@echo off
chcp 65001 >nul
echo ============================================
echo    DASHNOV - Installation Automatique
echo ============================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERREUR] Droits administrateur requis
    pause
    exit /b 1
)

PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"

if %errorLevel% neq 0 (
    echo.
    echo [ERREUR] Installation echouee
    pause
    exit /b 1
)

echo.
echo ============================================
echo    Installation terminee !
echo ============================================
echo.
pause
'@

$setupBat | Out-File -FilePath "$buildPath\Setup.bat" -Encoding ASCII -Force
Write-ColorOutput "Setup.bat cree" "SUCCESS"

# Créer README.txt
$readme = @"
==============================================
   DASHNOV - Package d'Installation v$Version
   Installation Hors-Ligne
==============================================

INSTALLATION RAPIDE :
---------------------
1. Extraire ce ZIP completement
2. Clic droit sur Setup.bat
3. "Executer en tant qu'administrateur"
4. Attendre la fin de l'installation (5-15 min)

PREREQUIS SYSTEME :
-------------------
- Windows 10+ (64-bit)
- Droits administrateur
- SQL Server sera installe automatiquement si inclus

CONTENU DU PACKAGE :
--------------------
- Setup.bat              : Lanceur d'installation
- Install.ps1            : Script PowerShell d'installation
- Server/                : Application Node.js + node_modules
- Database/Amadeus5.bak  : Backup base de donnees
- Database/SQLEXPR*.exe  : [SI INCLUS] Installeur SQL Server Express
- NodeJS/                : Installeur Node.js
- Tools/                 : NSSM (service Windows)

INSTALLATION AUTOMATIQUE :
--------------------------
Le script va automatiquement :
  [1] Verifier les prerequis Windows
  [2] Installer Node.js (si necessaire)
  [3] Installer SQL Server Express (si inclus)
  [4] Copier les fichiers dans C:\DashNov
  [5] Restaurer la base de donnees Amadeus5
  [6] Installer le service Windows DashNovService
  [7] Demarrer l'application

CONFIGURATION PAR DEFAUT :
--------------------------
- Dossier installation : C:\DashNov
- URL application       : http://localhost:8085
- Service Windows       : DashNovService (demarrage auto)
- Base de donnees       : Amadeus5
- Instance SQL          : Detection automatique

APRES INSTALLATION :
--------------------
- Ouvrir un navigateur : http://localhost:8085
- Logs disponibles dans : C:\DashNov\Logs\
- Documentation complete : README_PREREQUISITES.md

DEPANNAGE :
-----------
Si probleme :
1. Consulter : C:\DashNov\Logs\install.log
2. Verifier le service : Get-Service DashNovService
3. Test manuel : cd C:\DASHNOV\src\server && node server.js

IMPORTANT - INSTALLATION HORS-LIGNE :
--------------------------------------
Ce package contient TOUS les fichiers necessaires
pour une installation sans connexion Internet :
  - node_modules complet (pas besoin de npm install)
  - Backup SQL complet
  - Installeurs Node.js et SQL Server (si inclus)

Date de creation : $(Get-Date -Format "dd/MM/yyyy HH:mm")
Version          : $Version

Pour plus de details, consultez README_PREREQUISITES.md
"@

$readme | Out-File -FilePath "$buildPath\README.txt" -Encoding UTF8 -Force
Write-ColorOutput "README.txt cree" "SUCCESS"

# Copier le README détaillé
$readmeSource = "C:\DASHNOV\deployment\installer\README_PREREQUISITES.md"
if (Test-Path $readmeSource) {
    Copy-Item $readmeSource -Destination $buildPath -Force
    Write-ColorOutput "README_PREREQUISITES.md copie" "SUCCESS"
}

# ===== CRÉATION ZIP AVEC 7-ZIP =====
Write-ColorOutput "`nCreation du ZIP..." "INFO"

$zipFile = Join-Path $OutputPath "DASHNOV_Setup_v$Version.zip"

if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

# Fonction de compression avec détection 7-Zip
function Compress-WithSevenZip {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    $sevenZipPaths = @(
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe",
        "${env:ProgramFiles}\7-Zip\7z.exe",
        "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
    )
    
    $sevenZip = $sevenZipPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($sevenZip) {
        Write-ColorOutput "Utilisation de 7-Zip (compression rapide)..." "INFO"
        Write-Host "  Chemin: $sevenZip" -ForegroundColor Gray
        
        $arguments = @(
            "a",
            "-tzip",
            "`"$Destination`"",
            "`"$Source\*`"",
            "-mx=5",
            "-mmt=on"
        )
        
        $process = Start-Process -FilePath $sevenZip `
                                 -ArgumentList $arguments `
                                 -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -eq 0) {
            Write-ColorOutput "Compression 7-Zip reussie !" "SUCCESS"
            return $true
        } else {
            Write-ColorOutput "Erreur 7-Zip (code: $($process.ExitCode))" "WARN"
            return $false
        }
    } else {
        Write-ColorOutput "7-Zip non trouve, utilisation methode native..." "WARN"
        return $false
    }
}

# Tenter avec 7-Zip
$useSevenZip = Compress-WithSevenZip -Source $buildPath -Destination $zipFile

# Fallback PowerShell
if (-not $useSevenZip) {
    Write-ColorOutput "Compression avec PowerShell..." "INFO"
    
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $buildPath, 
        $zipFile, 
        [System.IO.Compression.CompressionLevel]::Optimal, 
        $false
    )
    
    Write-ColorOutput "Compression PowerShell terminee" "SUCCESS"
}

# Vérifier
if (Test-Path $zipFile) {
    $zipSize = (Get-Item $zipFile).Length / 1MB
    Write-ColorOutput "`nPackage cree : $zipFile" "SUCCESS"
    Write-ColorOutput "Taille       : $([math]::Round($zipSize, 2)) MB" "INFO"
} else {
    Write-ColorOutput "ERREUR: Echec creation ZIP" "ERROR"
    exit 1
}

# ===== RÉSUMÉ =====
Write-Host "`n============================================" -ForegroundColor Green
Write-Host "   BUILD TERMINE" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green

Write-ColorOutput "PROCHAINES ETAPES:" "INFO"
Write-ColorOutput "1. Copier le ZIP sur la machine cible" "INFO"
Write-ColorOutput "2. Extraire le contenu" "INFO"
Write-ColorOutput "3. Executer Setup.bat en administrateur" "INFO"
Write-Host "`n"
