# ============================================
# Création du package portable DashNov
# ============================================

$packagePath = "C:\DASHNOV_Portable"
$backupPath = "C:\DASHNOV\Backup"

Write-Host "Création du package portable..." -ForegroundColor Cyan

# 1. Créer les dossiers
New-Item -ItemType Directory -Force -Path $packagePath | Out-Null
New-Item -ItemType Directory -Force -Path "$packagePath\Server" | Out-Null
New-Item -ItemType Directory -Force -Path "$packagePath\Scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$packagePath\Database" | Out-Null
New-Item -ItemType Directory -Force -Path "$packagePath\NodeJS" | Out-Null

# 2. Copier les fichiers serveur
Copy-Item -Path "C:\DASHNOV\Server\*" -Destination "$packagePath\Server" -Recurse -Force
Write-Host "✓ Fichiers serveur copiés" -ForegroundColor Green

# 3. Copier les scripts
Copy-Item -Path "C:\DASHNOV\Scripts\*" -Destination "$packagePath\Scripts" -Recurse -Force
Write-Host "✓ Scripts copiés" -ForegroundColor Green

# 4. Sauvegarder la base de données
Write-Host "Sauvegarde de la base de données..." -ForegroundColor Yellow

$sqlQuery = @"
BACKUP DATABASE Amadeus5 
TO DISK = '$backupPath\Amadeus5.bak'
WITH FORMAT, INIT, COMPRESSION;
"@

Invoke-Sqlcmd -Query $sqlQuery -ServerInstance "DASHNOV\DASHNOV"
Copy-Item -Path "$backupPath\Amadeus5.bak" -Destination "$packagePath\Database\" -Force
Write-Host "✓ Base de données sauvegardée" -ForegroundColor Green

# 5. Créer le guide d'installation
$installGuide = @"
============================================
  DASHNOV - Installation hors ligne
============================================

PRÉREQUIS :
-----------
1. SQL Server 2019+ installé
2. Instance : localhost\SQLEXPRESS ou localhost

ÉTAPES D'INSTALLATION :
-----------------------

1. INSTALLER NODE.JS
   - Exécuter : NodeJS\node-v22.20.0-x64.msi
   - Redémarrer le PC

2. COPIER LES FICHIERS
   - Copier tout le contenu vers : C:\DASHNOV\

3. RESTAURER LA BASE DE DONNÉES
   - Ouvrir SQL Server Management Studio
   - Clic droit sur "Bases de données" → Restaurer
   - Fichier source : C:\DASHNOV\Database\Amadeus5.bak
   - Nom base : Amadeus5
   - Cliquer sur "OK"

4. CONFIGURER LA CONNEXION
   - Ouvrir : C:\DASHNOV\Server\SQL.env
   - Modifier DB_SERVER selon votre instance SQL
   - Vérifier DB_PASSWORD

5. DÉMARRER LE SERVEUR
   - Ouvrir PowerShell en administrateur
   - cd C:\DASHNOV\Server
   - .\start-server.bat

6. ACCÉDER À L'APPLICATION
   - Ouvrir le navigateur
   - Aller sur : http://127.0.0.1:8085

DÉPANNAGE :
-----------
- Erreur connexion DB : Vérifier SQL.env
- Port 8085 occupé : Modifier PORT dans SQL.env
- Node.js non reconnu : Redémarrer le PC

Support : [votre_email@domaine.com]
============================================
"@

$installGuide | Out-File -FilePath "$packagePath\INSTALLATION.txt" -Encoding UTF8
Write-Host "✓ Guide d'installation créé" -ForegroundColor Green

# 6. Créer le script d'installation automatique
$autoInstall = @"
# ============================================
# Installation automatique DashNov
# ============================================

Write-Host "Vérification des prérequis..." -ForegroundColor Cyan

# Vérifier Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    `$nodeVersion = node --version
    Write-Host "✓ Node.js détecté : `$nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js non trouvé. Installez-le d'abord." -ForegroundColor Red
    exit 1
}

# Vérifier SQL Server
`$sqlService = Get-Service -Name 'MSSQL*' -ErrorAction SilentlyContinue
if (`$sqlService) {
    Write-Host "✓ SQL Server détecté" -ForegroundColor Green
} else {
    Write-Host "✗ SQL Server non trouvé. Installez-le d'abord." -ForegroundColor Red
    exit 1
}

Write-Host "`nCopie des fichiers..." -ForegroundColor Cyan
if (-not (Test-Path "C:\DASHNOV")) {
    New-Item -ItemType Directory -Path "C:\DASHNOV" -Force | Out-Null
}

Copy-Item -Path ".\Server\*" -Destination "C:\DASHNOV\Server\" -Recurse -Force
Copy-Item -Path ".\Scripts\*" -Destination "C:\DASHNOV\Scripts\" -Recurse -Force
Write-Host "✓ Fichiers copiés vers C:\DASHNOV" -ForegroundColor Green

Write-Host "`nPour continuer :" -ForegroundColor Yellow
Write-Host "1. Restaurez la base de données (voir INSTALLATION.txt)" -ForegroundColor White
Write-Host "2. Configurez SQL.env" -ForegroundColor White
Write-Host "3. Lancez : cd C:\DASHNOV\Server ; .\start-server.bat" -ForegroundColor White
"@

$autoInstall | Out-File -FilePath "$packagePath\INSTALL.ps1" -Encoding UTF8
Write-Host "✓ Script d'installation créé" -ForegroundColor Green

# 7. Compresser le tout
Compress-Archive -Path "$packagePath\*" -DestinationPath "C:\DASHNOV_Portable_Package.zip" -Force
Write-Host "`n✓ Package créé : C:\DASHNOV_Portable_Package.zip" -ForegroundColor Green

Write-Host "`nContenu du package :" -ForegroundColor Cyan
Write-Host "- Server\ (application Node.js)" -ForegroundColor White
Write-Host "- Database\ (sauvegarde Amadeus5)" -ForegroundColor White
Write-Host "- Scripts\ (utilitaires)" -ForegroundColor White
Write-Host "- INSTALLATION.txt (guide)" -ForegroundColor White
Write-Host "- INSTALL.ps1 (installation auto)" -ForegroundColor White

Write-Host "`nÉtapes suivantes :" -ForegroundColor Yellow
Write-Host "1. Téléchargez Node.js v22.20.0 et ajoutez-le à NodeJS\" -ForegroundColor White
Write-Host "2. Copiez le package sur clé USB" -ForegroundColor White
Write-Host "3. Suivez INSTALLATION.txt sur le PC client" -ForegroundColor White
