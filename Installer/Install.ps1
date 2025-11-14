#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Script d'installation automatique DashNov - Version Corrigee
.DESCRIPTION
    Installe l'application DashNov avec tous ses composants
#>
param(
    [string]$InstallPath = "C:\DashNov",
    [string]$Port = "8085",
    [string]$ServiceName = "DashNovService"
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$SetupRoot = Split-Path $scriptPath -Parent

# Vérifier si on est dans le bon dossier
if (-not (Test-Path "$SetupRoot\Server")) {
    # Chercher le dossier Server en remontant les répertoires
    $searchPath = $scriptPath
    $found = $false
    
    for ($i = 0; $i -lt 5; $i++) {
        if (Test-Path "$searchPath\Server") {
            $SetupRoot = $searchPath
            $found = $true
            break
        }
        $searchPath = Split-Path $searchPath -Parent
    }
    
    if (-not $found) {
        Write-Error "Dossier 'Server' introuvable. Le script doit être exécuté depuis le dossier d'installation."
        exit 1
    }
}

# ===== FONCTIONS UTILITAIRES =====

function Write-Log {
    param([string]$Message, [string]$Type = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logFile = Join-Path $InstallPath "Logs\install.log"
    $logDir = Split-Path $logFile -Parent
    
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    $logEntry = "[$timestamp] [$Type] $Message"
    
    switch ($Type) {
        "SUCCESS" { Write-Host $Message -ForegroundColor Green }
        "ERROR"   { Write-Host $Message -ForegroundColor Red }
        "WARN"    { Write-Host $Message -ForegroundColor Yellow }
        default   { Write-Host $Message -ForegroundColor White }
    }
    
    Add-Content -Path $logFile -Value $logEntry -ErrorAction SilentlyContinue
}

function Test-Prerequisites {
    Write-Log "Verification des prerequis..." "INFO"
    
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-Log "Windows 10+ requis (detecte : $($osVersion))" "ERROR"
        return $false
    }
    Write-Log "[OK] Windows 10+" "SUCCESS"
    
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Log "Droits administrateur requis" "ERROR"
        return $false
    }
    Write-Log "[OK] Droits Admin" "SUCCESS"
    
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-Log "PowerShell 5+ requis" "ERROR"
        return $false
    }
    Write-Log "[OK] PowerShell 5+" "SUCCESS"
    
    return $true
}

function Install-NodeJS {
    Write-Log "Installation de Node.js..." "INFO"
    
    $nodeVersion = $null
    try {
        $nodeVersion = & node --version 2>$null
    } catch {}
    
    if ($nodeVersion) {
        Write-Log "Node.js deja installe : $nodeVersion" "SUCCESS"
        return $true
    }
    
    $nodeInstaller = Get-ChildItem -Path "$scriptPath\NodeJS" -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (-not $nodeInstaller) {
        Write-Log "Installeur Node.js introuvable" "ERROR"
        return $false
    }
    
    Write-Log "Installation de $($nodeInstaller.Name)..." "INFO"
    
    try {
        $msiArgs = @("/i", "`"$($nodeInstaller.FullName)`"", "/quiet", "/norestart", "ADDLOCAL=ALL")
        $process = Start-Process "msiexec.exe" -ArgumentList $msiArgs -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Write-Log "Node.js installe avec succes" "SUCCESS"
            return $true
        } else {
            Write-Log "Erreur lors de l'installation Node.js (code: $($process.ExitCode))" "ERROR"
            return $false
        }
    } catch {
        Write-Log "Erreur lors de l'installation Node.js : $_" "ERROR"
        return $false
    }
}

function Get-SqlInstance {
    Write-Log "Recherche de l'instance SQL Server..." "INFO"
    
    Write-Log "Verification de l'instance par defaut..." "INFO"
    $defaultService = Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue
    if ($defaultService -and $defaultService.Status -eq 'Running') {
        Write-Log "Instance SQL par defaut trouvee : $env:COMPUTERNAME" "SUCCESS"
        return $env:COMPUTERNAME
    }
    
    Write-Log "Recherche d'instances nommees..." "INFO"
    $sqlServices = Get-Service -Name "MSSQL$*" -ErrorAction SilentlyContinue
    
    foreach ($service in $sqlServices) {
        if ($service.Status -eq 'Running' -and $service.Name -match 'MSSQL\$(.+)') {
            $instanceName = $Matches[1]
            $fullInstance = "$env:COMPUTERNAME\$instanceName"
            Write-Log "Instance SQL nommee trouvee : $fullInstance" "SUCCESS"
            return $fullInstance
        }
    }
    
    Write-Log "Recherche dans le registre..." "INFO"
    $regPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server"
    if (Test-Path $regPath) {
        try {
            $instances = Get-ItemProperty -Path "$regPath" -Name "InstalledInstances" -ErrorAction Stop
            if ($instances.InstalledInstances) {
                $firstInstance = $instances.InstalledInstances[0]
                
                if ($firstInstance -eq "MSSQLSERVER") {
                    Write-Log "Instance par defaut trouvee via registre" "SUCCESS"
                    return $env:COMPUTERNAME
                } else {
                    $fullInstance = "$env:COMPUTERNAME\$firstInstance"
                    Write-Log "Instance nommee trouvee via registre : $fullInstance" "SUCCESS"
                    return $fullInstance
                }
            }
        } catch {
            Write-Log "Erreur lecture registre : $_" "WARN"
        }
    }
    
    Write-Log "Aucune instance SQL Server trouvee ou demarree" "ERROR"
    Write-Log "Verifiez que SQL Server est installe et demarre" "ERROR"
    return $null
}

function Install-SqlServerExpress {
    Write-Log "Verification de l'installeur SQL Server Express..." "INFO"

    $sqlInstaller = Get-ChildItem -Path "$scriptPath\Database" -Filter "*SQLEXPR*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

    if (-not $sqlInstaller) {
        Write-Log "Installeur SQL Server Express non trouve dans le package" "INFO"
        return $false
    }

    Write-Log "Installeur SQL Server Express trouve : $($sqlInstaller.Name)" "SUCCESS"
    Write-Log "Installation de SQL Server Express (cela peut prendre 10-15 minutes)..." "INFO"
    Write-Log "ATTENTION: Ne fermez pas cette fenetre pendant l'installation" "WARN"

    try {
        $configFile = "$env:TEMP\SqlServerSetup.ini"

        # Créer un fichier de configuration pour installation silencieuse
        $configContent = @"
[OPTIONS]
ACTION=Install
FEATURES=SQLEngine
INSTANCENAME=SQLEXPRESS
SQLSYSADMINACCOUNTS="BUILTIN\Administrators"
SECURITYMODE=SQL
SAPWD=Sql2022!
TCPENABLED=1
IACCEPTSQLSERVERLICENSETERMS=1
QUIET=True
"@

        $configContent | Out-File -FilePath $configFile -Encoding ASCII -Force

        $process = Start-Process -FilePath $sqlInstaller.FullName `
                                 -ArgumentList "/ConfigurationFile=`"$configFile`"" `
                                 -Wait -PassThru -NoNewWindow

        Remove-Item $configFile -Force -ErrorAction SilentlyContinue

        if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
            Write-Log "SQL Server Express installe avec succes" "SUCCESS"

            # Attendre que le service démarre
            Start-Sleep -Seconds 10

            # Vérifier que le service est démarré
            $service = Get-Service -Name "MSSQL`$SQLEXPRESS" -ErrorAction SilentlyContinue
            if ($service -and $service.Status -eq 'Running') {
                Write-Log "Service SQL Server demarre" "SUCCESS"
            } else {
                Write-Log "Demarrage du service SQL Server..." "INFO"
                Start-Service -Name "MSSQL`$SQLEXPRESS" -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 5
            }

            return $true
        } else {
            Write-Log "Erreur lors de l'installation SQL Server (code: $($process.ExitCode))" "ERROR"
            return $false
        }
    } catch {
        Write-Log "Erreur lors de l'installation SQL Server : $_" "ERROR"
        return $false
    }
}

function Test-SqlServer {
    Write-Log "Verification de SQL Server..." "INFO"

    $sqlInstance = Get-SqlInstance

    if (-not $sqlInstance) {
        Write-Log "SQL Server n'est pas installe" "WARN"

        # Tenter l'installation automatique
        if (Install-SqlServerExpress) {
            Write-Log "SQL Server Express installe automatiquement" "SUCCESS"
            return $true
        } else {
            Write-Log "Impossible d'installer SQL Server automatiquement" "ERROR"
            Write-Log "Veuillez installer SQL Server Express manuellement" "ERROR"
            Write-Log "Telechargement : https://www.microsoft.com/fr-fr/sql-server/sql-server-downloads" "INFO"
            return $false
        }
    }

    Write-Log "SQL Server deja installe" "SUCCESS"
    return $true
}

function Copy-ApplicationFiles {
    Write-Log "Copie des fichiers de l'application..." "Info"
    
    $sourceServer = "$SetupRoot\Server"
    $targetRoot = "C:\DashNov"
    $targetServer = "$targetRoot\Server"
    
    if (-not (Test-Path $sourceServer)) {
        Write-Log "ERREUR: Dossier Server introuvable dans $sourceServer" "Error"
        return $false
    }
    
    try {
        # Créer le répertoire C:\DashNov s'il n'existe pas
        if (-not (Test-Path $targetRoot)) {
            New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
            Write-Log "Repertoire cree : $targetRoot" "Info"
        }

        # Créer le répertoire Server s'il n'existe pas
        if (-not (Test-Path $targetServer)) {
            New-Item -ItemType Directory -Path $targetServer -Force | Out-Null
            Write-Log "Repertoire Server cree : $targetServer" "Info"
        }

        # Copier le CONTENU du dossier Server dans C:\DashNov\Server
        Copy-Item -Path "$sourceServer\*" -Destination $targetServer -Recurse -Force
        Write-Log "Contenu du serveur copie" "Success"
        
        if (Test-Path "$targetServer\public\index.html") {
            Write-Log "Interface web copiee" "Success"
        } else {
            Write-Log "Attention: public/index.html manquant" "Warning"
        }
        
        # Créer le fichier .env depuis .env.example s'il n'existe pas
        if ((Test-Path "$targetServer\.env.example") -and -not (Test-Path "$targetServer\.env")) {
            Copy-Item "$targetServer\.env.example" "$targetServer\.env"
            Write-Log "Fichier .env cree depuis .env.example" "Info"
        }
        
        # Créer le fichier SQL.env depuis SQL.env du root (s'il existe)
        if ((Test-Path "$targetRoot\SQL.env") -and -not (Test-Path "$targetServer\SQL.env")) {
            Copy-Item "$targetRoot\SQL.env" "$targetServer\SQL.env"
            Write-Log "Fichier SQL.env cree" "Info"
        }
        
        Write-Log "Fichiers de l'application copies" "Success"
        return $true
    } catch {
        Write-Log "Erreur lors de la copie : $_" "Error"
        return $false
    }
}

function Set-DatabaseConfiguration {
    Write-Log "Configuration de la base de donnees..." "INFO"
    
    $sqlInstance = Get-SqlInstance
    if (-not $sqlInstance) {
        Write-Log "Instance SQL non trouvee" "ERROR"
        return $false
    }
    
    $backupPath = Join-Path $scriptPath "Database\Amadeus5.bak"
    
    if (-not (Test-Path $backupPath)) {
        Write-Log "Fichier de sauvegarde introuvable : $backupPath" "ERROR"
        return $false
    }
    
    Write-Log "Restauration de la base de donnees depuis : $backupPath" "INFO"
    Write-Log "Instance SQL : $sqlInstance" "INFO"
    
    # ÉTAPE 1 : Detecter le chemin des donnees SQL
    Write-Log "Detection du chemin des donnees SQL..." "INFO"
    
    $dataPath = $null
    try {
        if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
            $query = "SELECT SERVERPROPERTY('InstanceDefaultDataPath') AS DataPath"
            $result = Invoke-Sqlcmd -Query $query -ServerInstance $sqlInstance -ErrorAction Stop
            $dataPath = $result.DataPath
        }
    } catch {
        Write-Log "Impossible d'interroger SQL Server pour le chemin" "WARN"
    }
    
    if (-not $dataPath) {
        $possibleRoots = "C:\Program Files\Microsoft SQL Server"
        try {
            $foundDir = Get-ChildItem -Path $possibleRoots -Directory -Recurse -ErrorAction SilentlyContinue |
                        Where-Object { $_.FullName -match '\\MSSQL\d*.*\\MSSQL\\DATA$' } |
                        Select-Object -First 1
            if ($foundDir) { $dataPath = $foundDir.FullName }
        } catch {
            # fallback silencieux
        }
    }
    
    if (-not $dataPath) {
        Write-Log "Impossible de detecter le chemin des donnees SQL" "ERROR"
        Write-Log "Veuillez specifier manuellement le chemin" "ERROR"
        return $false
    }
    
    Write-Log "Chemin des donnees SQL : $dataPath" "SUCCESS"
    
    $mdfPath = Join-Path $dataPath "Amadeus5.mdf"
    $ldfPath = Join-Path $dataPath "Amadeus5_log.ldf"
    
    Write-Log "Fichier MDF : $mdfPath" "INFO"
    Write-Log "Fichier LDF : $ldfPath" "INFO"
    
    # ÉTAPE 2 : Lire les noms logiques du backup
    Write-Log "Lecture des noms logiques du backup..." "INFO"
    
    $logicalNames = @{ Data = "Amadeus5"; Log = "Amadeus5_log" }
    
    try {
        if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
            $fileListQuery = "RESTORE FILELISTONLY FROM DISK = '$backupPath'"
            $fileList = Invoke-Sqlcmd -Query $fileListQuery -ServerInstance $sqlInstance
            
            foreach ($file in $fileList) {
                if ($file.Type -eq 'D') { $logicalNames.Data = $file.LogicalName }
                elseif ($file.Type -eq 'L') { $logicalNames.Log = $file.LogicalName }
            }
            
            Write-Log "Nom logique donnees : $($logicalNames.Data)" "SUCCESS"
            Write-Log "Nom logique log : $($logicalNames.Log)" "SUCCESS"
        }
    } catch {
        Write-Log "Utilisation des noms logiques par defaut" "WARN"
    }
    
    # ÉTAPE 3 : Creer la requete de restauration
    $restoreQuery = @"
USE master;
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'Amadeus5')
BEGIN
    ALTER DATABASE Amadeus5 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE Amadeus5;
END

RESTORE DATABASE Amadeus5
FROM DISK = N'$backupPath'
WITH REPLACE, RECOVERY,
MOVE N'$($logicalNames.Data)' TO N'$mdfPath',
MOVE N'$($logicalNames.Log)' TO N'$ldfPath';

ALTER DATABASE Amadeus5 SET MULTI_USER;
"@
    
    Write-Log "Requete de restauration preparee" "INFO"
    
    # ÉTAPE 4 : Executer la restauration
    try {
        if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
            Write-Log "Restauration via Invoke-Sqlcmd..." "INFO"
            Write-Log "Cela peut prendre 1-3 minutes..." "INFO"
            Invoke-Sqlcmd -Query $restoreQuery -ServerInstance $sqlInstance -QueryTimeout 600 -ErrorAction Stop
            Write-Log "Base de donnees restauree avec succes !" "SUCCESS"
            Update-SqlEnvFile -SqlInstance $sqlInstance
            return $true
        }
        
        if (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
            Write-Log "Restauration via sqlcmd.exe..." "INFO"
            Write-Log "Cela peut prendre 1-3 minutes..." "INFO"
            
            $tempSqlFile = [System.IO.Path]::Combine($env:TEMP, "dashnov_restore_$([Guid]::NewGuid()).sql")
            $restoreQuery | Out-File -FilePath $tempSqlFile -Encoding UTF8 -Force
            
            $output = & sqlcmd -S $sqlInstance -E -i $tempSqlFile -b 2>&1
            Remove-Item $tempSqlFile -Force -ErrorAction SilentlyContinue
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Base de donnees restauree avec succes !" "SUCCESS"
                Update-SqlEnvFile -SqlInstance $sqlInstance
                return $true
            } else {
                Write-Log "Erreur sqlcmd : $output" "ERROR"
                return $false
            }
        }
        
        Write-Log "Aucun outil SQL disponible (Invoke-Sqlcmd ou sqlcmd.exe)" "ERROR"
        return $false
        
    } catch {
        Write-Log "Erreur lors de la restauration : $($_.Exception.Message)" "ERROR"
        Write-Log "Details : $($_.ScriptStackTrace)" "ERROR"
        return $false
    }
}

function Update-SqlEnvFile {
    param([string]$SqlInstance)
    
    $envFile = Join-Path $InstallPath "Server\SQL.env"
    
    if (-not (Test-Path $envFile)) {
        Write-Log "Fichier SQL.env introuvable" "WARN"
        return
    }
    
    try {
        $content = Get-Content $envFile -Raw
        $content = $content -replace '(?m)^\s*DB_SERVER\s*=.*', "DB_SERVER=$SqlInstance"
        Set-Content -Path $envFile -Value $content -Encoding UTF8 -Force
        Write-Log "Fichier SQL.env mis a jour" "SUCCESS"
    } catch {
        Write-Log "Erreur lors de la mise a jour de SQL.env : $_" "WARN"
    }
}

function Install-NpmDependencies {
    Write-Log "Verification des dependances npm..." "INFO"

    $serverPath = Join-Path $InstallPath "Server"

    if (Test-Path "$serverPath\node_modules") {
        Write-Log "node_modules present (installation hors-ligne)" "SUCCESS"
        return $true
    }

    Write-Log "ATTENTION: node_modules manquant !" "WARN"
    Write-Log "Pour une installation hors-ligne, node_modules doit etre inclus dans le package" "WARN"
    Write-Log "Tentative d'installation via npm (necessite une connexion Internet)..." "INFO"

    try {
        Push-Location $serverPath
        $output = & npm install --production 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Log "Dependances installees avec succes" "SUCCESS"
            Pop-Location
            return $true
        } else {
            Write-Log "Erreur npm install : $output" "ERROR"
            Write-Log "ECHEC: Impossible d'installer les dependances sans Internet" "ERROR"
            Write-Log "Le package d'installation doit contenir node_modules" "ERROR"
            Pop-Location
            return $false
        }
    } catch {
        Write-Log "Erreur lors de l'installation npm : $_" "ERROR"
        Write-Log "ECHEC: Impossible d'installer les dependances sans Internet" "ERROR"
        Pop-Location
        return $false
    }
}

function Set-ServiceConfiguration {
    Write-Log "Configuration du service Windows..." "INFO"
    
    $nssmCandidate = Get-ChildItem -Path $scriptPath -Filter 'nssm.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($nssmCandidate) {
        $nssmExe = $nssmCandidate.FullName
    } else {
        Write-Log "NSSM non trouve, service non installe" "WARN"
        Write-Log "Vous pouvez demarrer manuellement avec : node DashNov_Server.js" "INFO"
        return $false
    }
    
    $serverPath = Join-Path $InstallPath "Server"
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $nodePath = $nodeCmd.Source
    } else {
        $nodePath = ("C:\Program Files\nodejs\node.exe","C:\Program Files (x86)\nodejs\node.exe") | 
                    Where-Object { Test-Path $_ } | Select-Object -First 1
    }
    
    if (-not $nodePath) {
        Write-Log "node.exe introuvable. Veuillez redemarrer la session ou installer Node.js correctement." "ERROR"
        return $false
    }
    
    $serverScript = Join-Path $serverPath "server.js"
    
    try {
        $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Write-Log "Suppression de l'ancien service..." "INFO"
            & $nssmExe stop $ServiceName 2>$null | Out-Null
            Start-Sleep -Seconds 1
            & $nssmExe remove $ServiceName confirm 2>$null | Out-Null
            Start-Sleep -Seconds 1
        }
        
        # Créer le répertoire des logs s'il n'existe pas
        $logsPath = Join-Path $InstallPath "Logs"
        if (-not (Test-Path $logsPath)) {
            New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
        }
        
        Write-Log "Installation du service $ServiceName..." "INFO"
        $installOutput = & $nssmExe install $ServiceName $nodePath $serverScript 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Erreur installation NSSM: $installOutput" "ERROR"
            return $false
        }
        
        Start-Sleep -Seconds 1
        
        & $nssmExe set $ServiceName AppDirectory $serverPath 2>$null
        & $nssmExe set $ServiceName AppStdout "$InstallPath\Logs\service.log" 2>$null
        & $nssmExe set $ServiceName AppStderr "$InstallPath\Logs\service-error.log" 2>$null
        & $nssmExe set $ServiceName DisplayName "DashNov Application" 2>$null
        & $nssmExe set $ServiceName Description "Serveur Node.js pour l'application DashNov" 2>$null
        & $nssmExe set $ServiceName Start SERVICE_AUTO_START 2>$null
        
        Write-Log "Service configure avec succes" "SUCCESS"
        return $true
        
    } catch {
        Write-Log "Erreur lors de la configuration du service : $_" "ERROR"
        return $false
    }
}

function Start-Application {
    Write-Log "Demarrage de l'application..." "INFO"
    
    # Attendre un peu pour que le service soit bien inscrit
    Start-Sleep -Seconds 2
    
    try {
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        
        if ($service) {
            # Essayer de démarrer le service
            $attempts = 0
            $maxAttempts = 3
            
            while ($attempts -lt $maxAttempts) {
                try {
                    Start-Service -Name $ServiceName -ErrorAction Stop
                    Start-Sleep -Seconds 2
                    
                    # Vérifier que le service est bien en cours d'exécution
                    $service = Get-Service -Name $ServiceName
                    if ($service.Status -eq 'Running') {
                        Write-Log "Service demarre avec succes" "SUCCESS"
                        return $true
                    } else {
                        throw "Service stopped after start attempt"
                    }
                } catch {
                    $attempts++
                    if ($attempts -lt $maxAttempts) {
                        Write-Log "Tentative de demarrage $attempts/$maxAttempts echouee, nouvelle tentative..." "WARN"
                        Start-Sleep -Seconds 3
                    }
                }
            }
            
            Write-Log "Service n'a pas pu demarrer apres $maxAttempts tentatives" "ERROR"
            return $false
        } else {
            Write-Log "Service non trouve, demarrage manuel..." "WARN"
            
            $serverPath = Join-Path $InstallPath "Server"
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
            if ($nodeCmd) {
                $nodeExe = $nodeCmd.Source
            } else {
                $nodeExe = ("C:\Program Files\nodejs\node.exe","C:\Program Files (x86)\nodejs\node.exe") | 
                           Where-Object { Test-Path $_ } | Select-Object -First 1
            }
            
            if (-not $nodeExe) {
                Write-Log "node.exe introuvable pour demarrer l'application manuellement" "ERROR"
                return $false
            }
            
            Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $serverPath -WindowStyle Hidden
            Write-Log "Application demarree en arriere-plan" "SUCCESS"
            return $true
        }
    } catch {
        Write-Log "Erreur lors du demarrage : $_" "ERROR"
        return $false
    }
}

function Test-ApplicationHealth {
    Write-Log "Verification de l'application..." "INFO"
    Start-Sleep -Seconds 5
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 10
        
        if ($response.StatusCode -eq 200) {
            Write-Log "Application accessible sur http://localhost:$Port" "SUCCESS"
            return $true
        }
    } catch {
        Write-Log "L'application ne repond pas encore (demarrage en cours...)" "WARN"
        return $false
    }
}

# ===== SCRIPT PRINCIPAL =====

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "   DASHNOV - Installation Automatique" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Log "=== Debut de l'installation ===" "INFO"
Write-Log "Chemin d'installation : $InstallPath" "INFO"
Write-Log "Port d'ecoute : $Port" "INFO"
Write-Host ""

if (-not (Test-Prerequisites)) {
    Write-Log "Verification des prerequis echouee" "ERROR"
    exit 1
}
Write-Host ""

if (-not (Install-NodeJS)) {
    Write-Log "Installation de Node.js echouee" "ERROR"
    exit 1
}
Write-Host ""

if (-not (Test-SqlServer)) {
    Write-Log "Verification de SQL Server echouee" "ERROR"
    exit 1
}
Write-Host ""

if (-not (Copy-ApplicationFiles)) {
    Write-Log "Copie des fichiers echouee" "ERROR"
    exit 1
}
Write-Host ""

if (-not (Set-DatabaseConfiguration)) {
    Write-Log "Configuration de la base de donnees echouee" "ERROR"
    exit 1
}
Write-Host ""

if (-not (Install-NpmDependencies)) {
    Write-Log "Installation des dependances npm echouee" "ERROR"
    exit 1
}
Write-Host ""

$serviceConfigured = Set-ServiceConfiguration
Write-Host ""

if ($serviceConfigured) {
    if (-not (Start-Application)) {
        Write-Log "Demarrage de l'application echoue" "WARN"
    }
} else {
    Write-Log "Demarrage manuel requis : cd $InstallPath\Server && node server.js" "INFO"
}
Write-Host ""

Test-ApplicationHealth | Out-Null

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "   INSTALLATION TERMINEE" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green

Write-Log "Application installee dans : $InstallPath" "SUCCESS"
Write-Log "URL d'acces : http://localhost:$Port" "SUCCESS"
Write-Log "Logs : $InstallPath\Logs\" "INFO"

if ($serviceConfigured) {
    Write-Log "Service Windows : $ServiceName (demarre automatiquement)" "SUCCESS"
} else {
    Write-Log "Pour demarrer manuellement :" "INFO"
    Write-Log "  cd $InstallPath\Server" "INFO"
    Write-Log "  node server.js" "INFO"
}

Write-Host "`n"
Write-Log "=== Installation terminee ===" "SUCCESS"

exit 0
