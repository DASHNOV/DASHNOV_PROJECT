# Documentation Technique - Système d'Installation Hors Ligne DashNov

**Version:** 1.3
**Date:** 14 novembre 2025
**Auteur:** Équipe DashNov
**Statut:** Production Ready

---

## Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture du système](#2-architecture-du-système)
3. [Processus de build (Serveur d'hébergement)](#3-processus-de-build-serveur-dhébergement)
4. [Processus d'installation (Machine cliente)](#4-processus-dinstallation-machine-cliente)
5. [Composants détaillés](#5-composants-détaillés)
6. [Structure du package d'installation](#6-structure-du-package-dinstallation)
7. [Flux de données et dépendances](#7-flux-de-données-et-dépendances)
8. [Diagnostics et dépannage](#8-diagnostics-et-dépannage)
9. [Scripts de maintenance](#9-scripts-de-maintenance)
10. [Problèmes connus et solutions](#10-problèmes-connus-et-solutions)

---

## 1. Vue d'ensemble

### 1.1 Objectif

Le système d'installation hors ligne permet de déployer l'application DashNov sur des machines clientes **sans connexion Internet**. Tout le nécessaire (Node.js, SQL Server, base de données, dépendances) est inclus dans un package ZIP unique.

### 1.2 Principes de fonctionnement

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVEUR D'HÉBERGEMENT                        │
│  (Machine où DashNov est déjà installé et fonctionnel)         │
│                                                                 │
│  1. Exécution de build-installer.ps1                           │
│  2. Collecte de tous les fichiers nécessaires                  │
│  3. Sauvegarde de la base de données                           │
│  4. Création du ZIP package                                    │
│                                                                 │
│  Sortie: DASHNOV_Setup_v1.3.zip (65-70 MB)                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Transfert USB/Réseau local
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MACHINE CLIENTE                            │
│  (Machine cible sans Internet, installation vierge)            │
│                                                                 │
│  1. Extraction du ZIP                                          │
│  2. Double-clic sur Setup.bat (admin)                          │
│  3. Installation automatique de tous les composants            │
│  4. Configuration du service Windows                           │
│  5. Restauration de la base de données                         │
│                                                                 │
│  Résultat: Application fonctionnelle sur http://localhost:8085 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Prérequis

**Sur le serveur d'hébergement:**
- DashNov installé et fonctionnel
- PowerShell 5.1+
- Droits administrateur
- SQL Server accessible
- 7-Zip installé (optionnel, améliore la vitesse)

**Sur la machine cliente:**
- Windows 10/11 ou Windows Server 2016+
- PowerShell 5.1+
- Droits administrateur
- 2 GB d'espace disque minimum

---

## 2. Architecture du système

### 2.1 Vue architecturale globale

```
┌──────────────────────────────────────────────────────────────────┐
│                      SERVEUR D'HÉBERGEMENT                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  C:\DASHNOV\                                                     │
│  │                                                               │
│  ├── Server\                   ← Application Node.js            │
│  │   ├── server.js             ← Point d'entrée                 │
│  │   ├── node_modules\         ← Dépendances npm                │
│  │   ├── package.json          ← Descripteur npm                │
│  │   ├── SQL.env               ← Config SQL                     │
│  │   └── public\               ← Interface web (généré)         │
│  │       ├── index.html        ← DashNov5_GUI.html              │
│  │       └── assets\           ← CSS, JS, Fonts, Logo           │
│  │                                                               │
│  ├── DashNov5_GUI.html         ← Interface source               │
│  ├── assets\                   ← Assets source                  │
│  │                                                               │
│  ├── Scripts\                  ← Scripts de build               │
│  │   ├── build-installer.ps1  ← SCRIPT PRINCIPAL BUILD          │
│  │   └── fix-moment-issue.ps1 ← Correction moment               │
│  │                                                               │
│  └── Database\                                                   │
│      └── DashNovDB_backup.bak ← Backup créé lors du build       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ build-installer.ps1
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              DASHNOV_Setup_v1.3.zip (PACKAGE)                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ├── Server\                   ← Copie complète                 │
│  │   ├── server.js                                              │
│  │   ├── node_modules\         ← AVEC moment corrigé            │
│  │   ├── package.json                                           │
│  │   ├── SQL.env                                                │
│  │   └── public\               ← Interface déjà intégrée        │
│  │                                                               │
│  ├── Database\                                                   │
│  │   ├── DashNovDB_backup.bak ← Base de données complète        │
│  │   └── SQLEXPRADV_x64_FRA.exe (optionnel)                    │
│  │                                                               │
│  ├── NodeJS\                                                     │
│  │   └── node-v22.20.0-x64.msi                                  │
│  │                                                               │
│  ├── Tools\                                                      │
│  │   └── nssm-2.24.zip                                          │
│  │                                                               │
│  ├── Installer\                ← Scripts d'installation         │
│  │   ├── Install.ps1           ← SCRIPT PRINCIPAL INSTALL       │
│  │   ├── fix-client-installation.ps1                            │
│  │   └── update-interface-client.ps1                            │
│  │                                                               │
│  ├── Setup.bat                 ← LANCEUR (double-clic)          │
│  ├── README.txt                ← Guide rapide                   │
│  └── README_PREREQUISITES.md   ← Documentation complète         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ Extraction + Setup.bat
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      MACHINE CLIENTE                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  C:\DashNov\                   ← Dossier installation           │
│  │                                                               │
│  ├── Server\                   ← Application Node.js            │
│  │   ├── server.js                                              │
│  │   ├── node_modules\         ← Dépendances complètes          │
│  │   ├── public\               ← Interface prête                │
│  │   └── SQL.env               ← Config SQL (modifié)           │
│  │                                                               │
│  ├── Tools\                                                      │
│  │   └── nssm-2.24\            ← NSSM extrait                   │
│  │                                                               │
│  ├── Logs\                     ← Logs installation/service      │
│  │   ├── installation.log                                       │
│  │   ├── service.log                                            │
│  │   └── service-error.log                                      │
│  │                                                               │
│  └── Database\                 ← Backup restauré                │
│      └── DashNovDB (SQL Server)                                 │
│                                                                  │
│  Service Windows:                                                │
│  └── DashNovService            ← Service auto-démarré           │
│      └── node C:\DashNov\Server\server.js                       │
│                                                                  │
│  Application accessible:                                         │
│  └── http://localhost:8085                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Composants Node.js - Résolution des modules

**IMPORTANT:** Le package `moment` a nécessité une correction spéciale.

```
Problème initial:
C:\DASHNOV\
├── node_modules\              ← Modules racine (moment COMPLET)
│   └── moment\
│       └── package.json       ← Présent
└── Server\
    └── node_modules\          ← Modules serveur (moment INCOMPLET)
        └── moment\
            └── package.json   ← MANQUANT ❌

Solution appliquée:
Copie de C:\DASHNOV\node_modules\moment → C:\DASHNOV\Server\node_modules\moment

Script: fix-moment-issue.ps1
```

**Résolution Node.js:**
1. Node cherche `require('moment')` depuis `server.js`
2. Remonte l'arborescence: `Server/node_modules` → `node_modules` (racine)
3. Trouve `moment` dans `C:\DASHNOV\node_modules`
4. **Problème:** Le package doit être dans `Server/node_modules` pour l'installation client

---

## 3. Processus de build (Serveur d'hébergement)

### 3.1 Script principal: build-installer.ps1

**Emplacement:** `C:\DASHNOV\Scripts\build-installer.ps1`

**Utilisation:**
```powershell
# En tant qu'administrateur
cd C:\DASHNOV\Scripts
.\build-installer.ps1 -Version "1.3"
```

### 3.2 Étapes détaillées du build

#### Étape 1: Préparation du dossier de build
```powershell
# Crée: C:\DASHNOV_Installer_Build\
# Nettoie les anciens builds si existants
# Crée les sous-dossiers: Server, Database, NodeJS, Tools, Installer
```

#### Étape 2: Copie du serveur Node.js
```powershell
# Fichiers copiés:
Server/server.js          → Build/Server/server.js
Server/package.json       → Build/Server/package.json
Server/SQL.env            → Build/Server/SQL.env
Server/.env.example       → Build/Server/.env.example

# Interface web:
DashNov5_GUI.html         → Build/Server/public/index.html
assets/                   → Build/Server/public/assets/

# Dépendances:
Server/node_modules/      → Build/Server/node_modules/
```

**Code source (lignes 62-121):**
```powershell
# Créer le dossier public pour l'interface web
$publicDest = Join-Path $serverDest "public"
New-Item -ItemType Directory -Path $publicDest -Force | Out-Null

# Copier la vraie interface web : DashNov5_GUI.html → public/index.html
$dashnovGUI = "C:\DASHNOV\DashNov5_GUI.html"
if (Test-Path $dashnovGUI) {
    Copy-Item $dashnovGUI -Destination "$publicDest\index.html" -Force
    Write-ColorOutput "  Interface principale copiee (DashNov5_GUI.html -> index.html)" "SUCCESS"
} else {
    Write-ColorOutput "  ERREUR: DashNov5_GUI.html introuvable" "ERROR"
    exit 1
}

# Copier le dossier assets (CSS, JS, fonts, logo)
$assetsSource = "C:\DASHNOV\assets"
if (Test-Path $assetsSource) {
    Write-ColorOutput "  Copie du dossier assets/..." "INFO"
    Copy-Item $assetsSource -Destination "$publicDest\assets" -Recurse -Force
    Write-ColorOutput "  Dossier assets copie (css, js, fonts, logo)" "SUCCESS"
}

# Copier node_modules (OBLIGATOIRE pour installation hors-ligne)
$nodeModulesSource = Join-Path $serverSource "node_modules"
if (Test-Path $nodeModulesSource) {
    Write-ColorOutput "  Copie de node_modules..." "INFO"
    Copy-Item $nodeModulesSource -Destination $serverDest -Recurse -Force
    Write-ColorOutput "  node_modules copie" "SUCCESS"
} else {
    Write-ColorOutput "  ERREUR: node_modules absent" "ERROR"
    # Option d'exécuter npm install
}
```

#### Étape 3: Sauvegarde de la base de données
```powershell
# Utilise Invoke-Sqlcmd pour créer un backup .bak
# Paramètres SQL depuis SQL.env:
#   - SQL_SERVER
#   - SQL_DATABASE
#   - SQL_USER (si AUTH=sql)
#   - SQL_PASSWORD (si AUTH=sql)

# Commande exécutée:
BACKUP DATABASE [DashNovDB]
TO DISK = 'C:\DASHNOV\Database\DashNovDB_backup.bak'
WITH FORMAT, INIT, COMPRESSION

# Vérifie la taille du backup (doit être > 1 MB)
# Copie dans Build/Database/
```

**Code source (lignes 123-180):**
```powershell
# Lecture du fichier SQL.env
$envPath = "C:\DASHNOV\Server\SQL.env"
$envContent = Get-Content $envPath -Raw

# Extraction des variables
$sqlServer = [regex]::Match($envContent, 'SQL_SERVER=(.+)').Groups[1].Value.Trim()
$sqlDatabase = [regex]::Match($envContent, 'SQL_DATABASE=(.+)').Groups[1].Value.Trim()

# Construction de la requête SQL
$backupQuery = @"
BACKUP DATABASE [$sqlDatabase]
TO DISK = '$backupPath'
WITH FORMAT, INIT, COMPRESSION, NAME = 'Full Backup of $sqlDatabase';
"@

# Exécution avec Invoke-Sqlcmd
Invoke-Sqlcmd -Query $backupQuery -ServerInstance $sqlServer -TrustServerCertificate
```

#### Étape 4: Inclusion des installateurs
```powershell
# Node.js MSI
C:\Users\*\Downloads\node-v*.msi → Build/NodeJS/

# SQL Server Express (optionnel)
C:\Users\*\Downloads\SQLEXPR*.exe → Build/Database/ (si accepté)

# NSSM (Service Manager)
C:\DASHNOV\Tools\nssm-2.24.zip → Build/Tools/
```

#### Étape 5: Copie des scripts d'installation
```powershell
# Scripts copiés:
Installer/Install.ps1                    → Build/Installer/
Installer/fix-client-installation.ps1    → Build/Installer/
Installer/update-interface-client.ps1    → Build/Installer/
Installer/README_PREREQUISITES.md        → Build/

# Génération automatique:
Setup.bat                                → Build/Setup.bat
README.txt                               → Build/README.txt
```

#### Étape 6: Création du ZIP
```powershell
# Utilise 7-Zip si disponible (plus rapide)
& "C:\Program Files\7-Zip\7z.exe" a -tzip -mx=5 `
    "C:\DASHNOV_Installer_Build\DASHNOV_Setup_v1.3.zip" `
    "C:\DASHNOV_Installer_Build\*"

# Sinon utilise Compress-Archive (PowerShell natif, plus lent)
Compress-Archive -Path "C:\DASHNOV_Installer_Build\*" `
    -DestinationPath "DASHNOV_Setup_v1.3.zip" -CompressionLevel Optimal
```

### 3.3 Sortie du build

**Fichier créé:**
```
C:\DASHNOV_Installer_Build\DASHNOV_Setup_v1.3.zip
Taille: 65-70 MB (compressé)
Contenu: ~12,000 fichiers
Compression: 67% (de ~200 MB à ~65 MB)
```

---

## 4. Processus d'installation (Machine cliente)

### 4.1 Script principal: Install.ps1

**Emplacement:** `Installer\Install.ps1` (dans le ZIP extrait)
**Lanceur:** `Setup.bat`

### 4.2 Flux d'installation complet

```
┌──────────────────────────────────────────────────────────┐
│  1. DÉMARRAGE (Setup.bat)                               │
│     - Vérification droits admin                          │
│     - Lancement Install.ps1                              │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  2. PRÉPARATION (Install.ps1)                            │
│     - Création C:\DashNov\                               │
│     - Création sous-dossiers (Server, Logs, Database)    │
│     - Configuration logging                              │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  3. VÉRIFICATION PRÉREQUIS                               │
│     - PowerShell version ≥ 5.1                           │
│     - Droits administrateur                              │
│     - Espace disque (2 GB minimum)                       │
│     - Port 8085 disponible                               │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  4. INSTALLATION NODE.JS                                 │
│     - Détection version existante                        │
│     - Si absent/ancien: Install node-v22.20.0-x64.msi    │
│     - Installation silencieuse: /quiet /norestart        │
│     - Ajout au PATH système                              │
│     - Vérification: node --version                       │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  5. INSTALLATION/VÉRIFICATION SQL SERVER                 │
│     - Recherche instance locale                          │
│     - Si absent ET installateur inclus:                  │
│       * Installation SQL Express automatique             │
│       * Configuration: TCP/IP activé, port 1433          │
│       * Compte service: NetworkService                   │
│       * Mode mixte (Windows + SQL Auth)                  │
│     - Si présent: continuer                              │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  6. COPIE DES FICHIERS SERVEUR                           │
│     Source: Dossier_extraction\Server\                   │
│     Cible:  C:\DashNov\Server\                           │
│                                                          │
│     IMPORTANT: Utilise Copy-Item "$source\*"            │
│     (pas "$source" pour éviter Server\Server\)          │
│                                                          │
│     Fichiers copiés:                                    │
│     ├── server.js                                       │
│     ├── package.json                                    │
│     ├── SQL.env                                         │
│     ├── .env.example                                    │
│     ├── node_modules\       (tous les packages)         │
│     └── public\             (interface complète)        │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  7. CONFIGURATION SQL.env                                │
│     - Demande instance SQL (ou utilise localhost)        │
│     - Demande mode auth (Windows/SQL)                    │
│     - Si SQL: demande user/password                      │
│     - Modification de C:\DashNov\Server\SQL.env:         │
│       SQL_SERVER=localhost\SQLEXPRESS                    │
│       SQL_AUTH=windows                                   │
│       SQL_DATABASE=DashNovDB                             │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  8. RESTAURATION BASE DE DONNÉES                         │
│     Source: Database\DashNovDB_backup.bak                │
│     Cible:  SQL Server instance configurée               │
│                                                          │
│     Commande SQL:                                        │
│     RESTORE DATABASE [DashNovDB]                         │
│     FROM DISK = 'C:\temp\DashNovDB_backup.bak'           │
│     WITH MOVE 'DashNovDB' TO 'C:\...\DashNovDB.mdf',     │
│          MOVE 'DashNovDB_log' TO 'C:\...\DashNovDB.ldf', │
│          REPLACE                                         │
│                                                          │
│     Vérification: SELECT 1 FROM DashNovDB                │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  9. INSTALLATION NSSM                                    │
│     - Extraction Tools\nssm-2.24.zip                     │
│     - Copie vers C:\DashNov\Tools\nssm-2.24\             │
│     - Sélection version: nssm.exe (64-bit)               │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  10. CONFIGURATION SERVICE WINDOWS                       │
│      Service: DashNovService                             │
│      Display: DashNov Application Server                 │
│      Command: node C:\DashNov\Server\server.js           │
│      Startup: Automatic                                  │
│      Account: LocalSystem                                │
│                                                          │
│      Configuration NSSM:                                 │
│      nssm install DashNovService                         │
│           "C:\Program Files\nodejs\node.exe"             │
│           "C:\DashNov\Server\server.js"                  │
│      nssm set DashNovService AppDirectory                │
│           "C:\DashNov\Server"                            │
│      nssm set DashNovService AppStdout                   │
│           "C:\DashNov\Logs\service.log"                  │
│      nssm set DashNovService AppStderr                   │
│           "C:\DashNov\Logs\service-error.log"            │
│      nssm set DashNovService Start SERVICE_AUTO_START    │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  11. CONFIGURATION PARE-FEU                              │
│      Création règle:                                     │
│      - Nom: "DashNov Application - Port 8085"            │
│      - Port: 8085                                        │
│      - Direction: Inbound                                │
│      - Action: Allow                                     │
│      - Profile: Domain, Private, Public                  │
│      - Protocole: TCP                                    │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  12. DÉMARRAGE SERVICE                                   │
│      Start-Service DashNovService                        │
│      Attente: 10 secondes                                │
│      Vérification statut: Should be "Running"            │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  13. TESTS POST-INSTALLATION                             │
│      - Test HTTP: http://localhost:8085                  │
│      - Vérification réponse 200 OK                       │
│      - Test connexion SQL                                │
│      - Vérification logs (pas d'erreurs)                 │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  14. RAPPORT FINAL                                       │
│      ✅ Installation terminée avec succès                │
│      📊 Résumé:                                          │
│         - Node.js: v22.20.0                              │
│         - SQL Server: localhost\SQLEXPRESS               │
│         - Service: Running                               │
│         - URL: http://localhost:8085                     │
│      📝 Logs: C:\DashNov\Logs\installation.log           │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Code critique: Copie du serveur (correction v1.3)

**Problème avant v1.3:**
```powershell
# ❌ ANCIEN CODE (créait Server\Server\)
$sourceServer = Join-Path $scriptPath "Server"
$targetServer = "C:\DashNov\Server"
Copy-Item -Path $sourceServer -Destination $targetServer -Recurse -Force

# Résultat: C:\DashNov\Server\Server\server.js
```

**Solution v1.3:**
```powershell
# ✅ NOUVEAU CODE (lignes 280-295)
$sourceServer = Join-Path $scriptPath "Server"
$targetServer = "C:\DashNov\Server"

# Créer le répertoire cible s'il n'existe pas
if (-not (Test-Path $targetServer)) {
    New-Item -ItemType Directory -Path $targetServer -Force | Out-Null
    Write-Log "Repertoire Server cree : $targetServer" "Info"
}

# Copier le CONTENU du dossier Server (avec \*)
Copy-Item -Path "$sourceServer\*" -Destination $targetServer -Recurse -Force
Write-Log "Contenu du serveur copie" "Success"

# Résultat: C:\DashNov\Server\server.js ✅
```

---

## 5. Composants détaillés

### 5.1 Server/server.js

**Rôle:** Point d'entrée de l'application Node.js

**Corrections appliquées (v1.3):**

**Problème 1: Déclaration duplicate de `path`**
```javascript
// ❌ AVANT (lignes 7 et 19)
const path = require('path');
// ... autres require ...
const path = require('path');  // DUPLICATE!

// ✅ APRÈS
const path = require('path');
// ... autres require ...
// (ligne 19 supprimée)
```

**Problème 2: Utilisation de `app` avant déclaration**
```javascript
// ❌ AVANT
const express = require('express');
const path = require('path');
// ...
app.use(express.static(path.join(__dirname, 'public'))); // app pas défini!
// ...
const app = express(); // Défini APRÈS utilisation!

// ✅ APRÈS
const express = require('express');
const path = require('path');
// ...
const app = express(); // Défini AVANT
// ...
app.use(express.static(path.join(__dirname, 'public'))); // OK!
```

**Configuration:**
```javascript
// Port d'écoute
const PORT = process.env.PORT || 8085;

// Chargement configuration SQL
const envFilePath = path.join(__dirname, 'SQL.env');
const result = dotenv.config({ path: envFilePath });

// Connexion SQL Server
const pool = new sql.ConnectionPool({
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
});

// Démarrage serveur
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
```

### 5.2 Install.ps1

**Sections principales:**

#### Section 1: Fonctions utilitaires (lignes 1-120)
```powershell
function Write-Log { }           # Logging fichier + console
function Test-Administrator { }   # Vérification droits admin
function Test-Port { }           # Test disponibilité port
function Install-SqlServerExpress { } # Installation SQL auto
```

#### Section 2: Installation Node.js (lignes 244-274)
```powershell
function Install-NodeJS {
    # Détecte version existante
    $nodeVersion = & node --version 2>$null

    if ($nodeVersion -and $nodeVersion -ge "v22.0.0") {
        Write-Log "Node.js deja installe: $nodeVersion" "Success"
        return
    }

    # Installe MSI en mode silencieux
    $nodeMsi = Get-ChildItem "$scriptPath\NodeJS\*.msi" -ErrorAction SilentlyContinue
    Start-Process msiexec.exe -ArgumentList "/i `"$($nodeMsi.FullName)`" /quiet /norestart" -Wait

    # Rafraîchit PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
}
```

#### Section 3: Copie fichiers (lignes 280-295) - CRITIQUE
```powershell
# Création répertoire cible
if (-not (Test-Path $targetServer)) {
    New-Item -ItemType Directory -Path $targetServer -Force | Out-Null
}

# Copie CONTENU (avec \*)
Copy-Item -Path "$sourceServer\*" -Destination $targetServer -Recurse -Force
```

#### Section 4: Configuration SQL.env (lignes 338-398)
```powershell
# Demande interactive ou utilise défauts
$sqlServer = Read-Host "Instance SQL Server [localhost\SQLEXPRESS]"
$authMode = Read-Host "Mode authentification (windows/sql) [windows]"

# Modification fichier
$sqlEnvContent = Get-Content "$targetServer\SQL.env" -Raw
$sqlEnvContent = $sqlEnvContent -replace "SQL_SERVER=.*", "SQL_SERVER=$sqlServer"
$sqlEnvContent | Set-Content "$targetServer\SQL.env" -Force
```

#### Section 5: Restauration DB (lignes 400-487)
```powershell
# Construction requête RESTORE
$restoreQuery = @"
RESTORE DATABASE [$dbName]
FROM DISK = N'$backupPath'
WITH FILE = 1,
MOVE N'$logicalName' TO N'$mdfPath',
MOVE N'${logicalName}_log' TO N'$ldfPath',
NOUNLOAD, REPLACE, STATS = 5
"@

# Exécution
Invoke-Sqlcmd -Query $restoreQuery -ServerInstance $sqlServer -TrustServerCertificate
```

#### Section 6: Configuration NSSM (lignes 541-615)
```powershell
$serviceName = "DashNovService"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$serverScript = Join-Path $serverPath "server.js"

# Installation service
& $nssmExe install $serviceName $nodeExe $serverScript

# Configuration
& $nssmExe set $serviceName AppDirectory $serverPath
& $nssmExe set $serviceName AppStdout "$logsPath\service.log"
& $nssmExe set $serviceName AppStderr "$logsPath\service-error.log"
& $nssmExe set $serviceName Start SERVICE_AUTO_START
```

### 5.3 SQL.env

**Format:**
```ini
SQL_SERVER=localhost\SQLEXPRESS
SQL_DATABASE=DashNovDB
SQL_AUTH=windows
SQL_USER=
SQL_PASSWORD=
```

**Modes d'authentification:**

**Mode Windows (recommandé):**
```ini
SQL_AUTH=windows
SQL_USER=          # Laissé vide
SQL_PASSWORD=      # Laissé vide
```

**Mode SQL:**
```ini
SQL_AUTH=sql
SQL_USER=sa
SQL_PASSWORD=VotreMotDePasse123!
```

### 5.4 package.json

```json
{
  "devDependencies": {
    "inquirer": "^12.9.6"
  },
  "dependencies": {
    "bcryptjs": "^3.0.2",
    "body-parser": "^2.2.0",
    "cors": "^2.8.5",
    "crypto": "^1.0.1",
    "dotenv": "^17.2.3",
    "exceljs": "^4.4.0",
    "express": "^5.1.0",
    "fs": "^0.0.1-security",
    "jsonwebtoken": "^9.0.2",
    "jspdf": "^3.0.3",
    "jspdf-autotable": "^5.0.2",
    "moment-timezone": "^0.6.0",      ← Dépend de moment
    "mssql": "^12.0.0",
    "node-cron": "^4.2.1",
    "path": "^0.12.7",
    "pdfkit": "^0.17.2",
    "qrcode": "^1.5.4",
    "xmlbuilder": "^15.1.1"
  }
}
```

**Note:** `moment` n'est PAS listé dans dependencies mais est requis par `moment-timezone`

---

## 6. Structure du package d'installation

### 6.1 Arborescence complète

```
DASHNOV_Setup_v1.3.zip
│
├── Server/                                   [~190 MB décompressé]
│   ├── server.js                             [63 KB] - Application principale
│   ├── package.json                          [557 B] - Descripteur npm
│   ├── SQL.env                               [652 B] - Config SQL (template)
│   ├── .env.example                          [167 B] - Config exemple
│   │
│   ├── node_modules/                         [~180 MB] - 267 packages
│   │   ├── @azure/                           [Packages Azure]
│   │   ├── @types/                           [Définitions TypeScript]
│   │   ├── bcryptjs/                         [Hash passwords]
│   │   ├── cors/                             [CORS middleware]
│   │   ├── dotenv/                           [Variables environnement]
│   │   ├── exceljs/                          [Génération Excel]
│   │   ├── express/                          [Framework web]
│   │   ├── jsonwebtoken/                     [JWT auth]
│   │   ├── jspdf/                            [Génération PDF]
│   │   ├── moment/                           [Dates - CORRIGÉ v1.3]
│   │   │   ├── moment.js
│   │   │   ├── package.json                  [✅ PRÉSENT]
│   │   │   └── ...
│   │   ├── moment-timezone/                  [Fuseaux horaires]
│   │   ├── mssql/                            [SQL Server client]
│   │   └── ...
│   │
│   └── public/                               [Interface web]
│       ├── index.html                        [DashNov5_GUI.html copié]
│       └── assets/
│           ├── css/
│           │   ├── style.css
│           │   └── ...
│           ├── js/
│           │   ├── main.js
│           │   └── ...
│           ├── fonts/
│           └── images/
│               └── logo.png
│
├── Database/                                 [~45 MB]
│   ├── DashNovDB_backup.bak                  [41 MB] - Backup SQL
│   └── SQLEXPRADV_x64_FRA.exe                [500 MB] - Optionnel
│
├── NodeJS/                                   [~27 MB]
│   └── node-v22.20.0-x64.msi                 [27 MB] - Installateur Node
│
├── Tools/                                    [~800 KB]
│   └── nssm-2.24.zip                         [800 KB] - Service Manager
│
├── Installer/                                [~100 KB]
│   ├── Install.ps1                           [~30 KB] - Script principal
│   ├── fix-client-installation.ps1           [~15 KB] - Réparation
│   └── update-interface-client.ps1           [~10 KB] - MAJ interface
│
├── Setup.bat                                 [500 B] - Lanceur
├── README.txt                                [2 KB] - Guide rapide
└── README_PREREQUISITES.md                   [15 KB] - Doc complète
```

### 6.2 Taille et compression

```
Décompressé:  ~200 MB
Compressé:    ~65 MB
Ratio:        67.5%
Fichiers:     ~12,000
Dossiers:     ~1,600
```

---

## 7. Flux de données et dépendances

### 7.1 Flux de configuration

```
BUILD (Serveur hébergement)
│
├── DashNov5_GUI.html ──────────┐
├── assets/ ────────────────────┤
│                               ├──► Server/public/ (dans ZIP)
└── Server/                     │
    ├── server.js ──────────────┤
    ├── node_modules/ ──────────┤
    └── SQL.env (template) ─────┘

INSTALLATION (Machine cliente)
│
├── Extraction ZIP ──────────────┐
│                                │
├── Install.ps1 demande config:  │
│   ├── SQL Server instance      │
│   ├── Mode authentification    │
│   └── Credentials (si SQL)     │
│                                ▼
└── Modification SQL.env ────► Server/SQL.env (configuré)
                                │
                                ▼
                            Utilisation par server.js
```

### 7.2 Dépendances entre composants

```
                    ┌──────────────────┐
                    │  Setup.bat       │
                    └────────┬─────────┘
                             │ Lance
                             ▼
                    ┌──────────────────┐
                    │  Install.ps1     │◄────── Logging
                    └────────┬─────────┘        │
                             │                  │
                 ┌───────────┼───────────┐      │
                 │           │           │      │
                 ▼           ▼           ▼      │
        ┌────────────┐ ┌──────────┐ ┌────────────────┐
        │  Node.js   │ │ SQL      │ │  Server/       │
        │  MSI       │ │ Server   │ │  node_modules/ │
        └──────┬─────┘ └────┬─────┘ └────────┬───────┘
               │            │                 │
               │            │                 │
               └────────────┼─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  SQL.env        │
                   │  (configuré)    │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  server.js      │
                   │  (exécuté)      │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  NSSM Service   │
                   │  DashNovService │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────────────┐
                   │  Application running    │
                   │  http://localhost:8085  │
                   └─────────────────────────┘
```

### 7.3 Ports et communications

```
Machine Cliente
│
├── Port 8085 (HTTP)
│   └── Application Web DashNov
│       └── Serveur Express (Node.js)
│           └── Écoute sur 0.0.0.0:8085
│
├── Port 1433 (SQL)
│   └── SQL Server
│       └── Base DashNovDB
│           └── Connexion depuis server.js
│
└── Logs
    ├── C:\DashNov\Logs\service.log       (stdout)
    ├── C:\DashNov\Logs\service-error.log (stderr)
    └── C:\DashNov\Logs\installation.log  (install)
```

---

## 8. Diagnostics et dépannage

### 8.1 Vérifications post-installation

**1. Vérifier le service Windows**
```powershell
# Statut du service
Get-Service DashNovService

# Devrait afficher:
# Status   : Running
# StartType: Automatic
```

**2. Vérifier les logs**
```powershell
# Log de service (stdout)
Get-Content C:\DashNov\Logs\service.log -Tail 50

# Log d'erreurs (stderr)
Get-Content C:\DashNov\Logs\service-error.log -Tail 50

# Recherche d'erreurs
Select-String -Path C:\DashNov\Logs\service-error.log -Pattern "Error|Exception"
```

**3. Tester l'application**
```powershell
# Test HTTP local
Invoke-WebRequest -Uri http://localhost:8085 -UseBasicParsing

# Devrait retourner: StatusCode 200
```

**4. Vérifier la base de données**
```powershell
# Test connexion SQL
Invoke-Sqlcmd -Query "SELECT @@VERSION" -ServerInstance "localhost\SQLEXPRESS"

# Vérifier présence DB
Invoke-Sqlcmd -Query "SELECT name FROM sys.databases WHERE name='DashNovDB'" `
    -ServerInstance "localhost\SQLEXPRESS"
```

**5. Vérifier les fichiers**
```powershell
# Structure attendue
Test-Path C:\DashNov\Server\server.js                    # True
Test-Path C:\DashNov\Server\node_modules\moment          # True
Test-Path C:\DashNov\Server\public\index.html            # True
Test-Path C:\DashNov\Server\public\assets                # True
```

### 8.2 Problèmes courants

#### Problème 1: Service ne démarre pas

**Symptôme:**
```powershell
Get-Service DashNovService
# Status: Stopped
```

**Diagnostic:**
```powershell
# Vérifier logs d'erreur
Get-Content C:\DashNov\Logs\service-error.log
```

**Causes possibles:**

**A. Port 8085 déjà utilisé**
```
Error: listen EADDRINUSE: address already in use :::8085
```

**Solution:**
```powershell
# Identifier processus sur port 8085
netstat -ano | findstr :8085

# Tuer processus (PID trouvé ci-dessus)
Stop-Process -Id <PID> -Force

# Redémarrer service
Restart-Service DashNovService
```

**B. Node.js non trouvé**
```
Error: 'node' is not recognized as an internal or external command
```

**Solution:**
```powershell
# Vérifier installation Node
node --version

# Si absent, réinstaller
Start-Process msiexec.exe -ArgumentList "/i `"C:\DashNov\NodeJS\node-v22.20.0-x64.msi`" /quiet /norestart" -Wait

# Reconfigurer service
$nssmExe = "C:\DashNov\Tools\nssm-2.24\win64\nssm.exe"
& $nssmExe set DashNovService AppPath "C:\Program Files\nodejs\node.exe"
Restart-Service DashNovService
```

**C. Module manquant (ex: moment)**
```
Error: Cannot find module 'moment'
```

**Solution:**
```powershell
# Exécuter script de correction
cd C:\DashNov\Installer
.\fix-client-installation.ps1
```

#### Problème 2: Erreur connexion SQL

**Symptôme:**
```
Error: Login failed for user 'NT AUTHORITY\SYSTEM'
Error: Unable to connect to SQL Server
```

**Diagnostic:**
```powershell
# Tester connexion manuelle
Invoke-Sqlcmd -Query "SELECT 1" -ServerInstance "localhost\SQLEXPRESS"
```

**Solution 1: Mode Windows (Service LocalSystem)**
```powershell
# 1. Vérifier SQL.env
Get-Content C:\DashNov\Server\SQL.env

# Doit contenir:
# SQL_AUTH=windows
# SQL_USER=
# SQL_PASSWORD=

# 2. Donner droits LocalSystem sur SQL
# Dans SQL Server Management Studio:
# Security → Logins → Add Login
# Login name: NT AUTHORITY\SYSTEM
# Database: DashNovDB
# Role: db_owner
```

**Solution 2: Passer en mode SQL Auth**
```powershell
# Modifier SQL.env
$envPath = "C:\DashNov\Server\SQL.env"
$content = Get-Content $envPath -Raw
$content = $content -replace "SQL_AUTH=windows", "SQL_AUTH=sql"
$content = $content -replace "SQL_USER=", "SQL_USER=sa"
$content = $content -replace "SQL_PASSWORD=", "SQL_PASSWORD=VotreMotDePasse"
$content | Set-Content $envPath -Force

# Redémarrer service
Restart-Service DashNovService
```

#### Problème 3: Interface ne s'affiche pas

**Symptôme:**
- Page blanche à http://localhost:8085
- Erreur 404 sur /assets/

**Diagnostic:**
```powershell
# Vérifier présence fichiers
Test-Path C:\DashNov\Server\public\index.html
Test-Path C:\DashNov\Server\public\assets\css\style.css
```

**Solution:**
```powershell
# Exécuter script de mise à jour interface
cd C:\DashNov\Installer
.\update-interface-client.ps1

# Redémarrer service
Restart-Service DashNovService
```

#### Problème 4: Structure Server\Server\ créée

**Symptôme:**
```powershell
Test-Path C:\DashNov\Server\Server\server.js  # True (mauvais!)
```

**Cause:**
Installation avec ancienne version Install.ps1 (avant v1.3)

**Solution:**
```powershell
# Corriger manuellement
Move-Item C:\DashNov\Server\Server\* C:\DashNov\Server\ -Force
Remove-Item C:\DashNov\Server\Server -Recurse -Force

# Ou réinstaller avec version corrigée
```

### 8.3 Commandes de diagnostic utiles

```powershell
# === SERVICE ===
Get-Service DashNovService | Select-Object Status, StartType, DisplayName
Get-EventLog -LogName Application -Source DashNovService -Newest 10

# === RÉSEAU ===
netstat -ano | findstr :8085                    # Port application
netstat -ano | findstr :1433                    # Port SQL
Test-NetConnection -ComputerName localhost -Port 8085

# === SQL SERVER ===
Invoke-Sqlcmd -Query "SELECT @@VERSION" -ServerInstance "localhost\SQLEXPRESS"
Invoke-Sqlcmd -Query "SELECT name FROM sys.databases" -ServerInstance "localhost\SQLEXPRESS"
Invoke-Sqlcmd -Query "SELECT COUNT(*) FROM DashNovDB.INFORMATION_SCHEMA.TABLES" -ServerInstance "localhost\SQLEXPRESS"

# === NODE.JS ===
node --version
npm --version
Get-Command node | Select-Object Source

# === FICHIERS ===
Get-ChildItem C:\DashNov\Server -Recurse | Measure-Object -Property Length -Sum
Get-ChildItem C:\DashNov\Server\node_modules | Measure-Object
Test-Path C:\DashNov\Server\node_modules\moment\package.json

# === LOGS ===
Get-Content C:\DashNov\Logs\service.log -Tail 100
Get-Content C:\DashNov\Logs\service-error.log -Tail 100
Select-String -Path C:\DashNov\Logs\*.log -Pattern "Error|Exception|Failed"
```

---

## 9. Scripts de maintenance

### 9.1 fix-client-installation.ps1

**Usage:**
```powershell
cd C:\DashNov\Installer
.\fix-client-installation.ps1
```

**Actions:**
1. Vérifie structure Server/ (détecte Server\Server\)
2. Corrige si nécessaire (déplace fichiers)
3. Vérifie node_modules (package moment)
4. Copie moment depuis root si manquant
5. Redémarre service
6. Teste application

### 9.2 update-interface-client.ps1

**Usage:**
```powershell
cd C:\DashNov\Installer
.\update-interface-client.ps1
```

**Actions:**
1. Sauvegarde public/ existant
2. Extrait DashNov5_GUI.html depuis ZIP source
3. Copie vers public/index.html
4. Copie assets/ complet
5. Redémarre service

### 9.3 fix-moment-issue.ps1 (Serveur d'hébergement)

**Usage:**
```powershell
cd C:\DASHNOV\Scripts
.\fix-moment-issue.ps1
```

**Actions:**
1. Vérifie C:\DASHNOV\node_modules\moment
2. Vérifie C:\DASHNOV\Server\node_modules\moment
3. Copie si package.json manquant
4. Teste require('moment')

---

## 10. Problèmes connus et solutions

### 10.1 Historique des problèmes résolus

#### v1.0 → v1.1: Nom fichier serveur

**Problème:**
```
Error: Cannot find module 'C:\DashNov\Server\DashNov_Server.js'
```

**Cause:**
Install.ps1 cherchait `DashNov_Server.js` mais le fichier était `server.js`

**Solution:**
Modification Install.ps1 lignes 459, 558, 640, 659:
```powershell
$serverScript = Join-Path $serverPath "server.js"  # au lieu de DashNov_Server.js
```

#### v1.1 → v1.2: Interface provisoire affichée

**Problème:**
Client voyait interface `public/index.html` provisoire au lieu de DashNov5_GUI

**Cause:**
build-installer.ps1 ne copiait pas la vraie interface

**Solution:**
Ajout dans build-installer.ps1:
```powershell
Copy-Item "C:\DASHNOV\DashNov5_GUI.html" -Destination "$buildPath\Server\public\index.html"
Copy-Item "C:\DASHNOV\assets" -Destination "$buildPath\Server\public\assets" -Recurse
```

#### v1.2 → v1.3: Structure Server\Server\ et moment manquant

**Problème 1:**
```
C:\DashNov\Server\Server\server.js (structure incorrecte)
```

**Cause:**
```powershell
Copy-Item -Path $sourceServer -Destination $targetServer  # Copie le dossier lui-même
```

**Solution:**
```powershell
Copy-Item -Path "$sourceServer\*" -Destination $targetServer  # Copie le contenu
```

**Problème 2:**
```
Error: Cannot find module 'moment'
```

**Cause:**
`C:\DASHNOV\Server\node_modules\moment\` existait mais sans `package.json`
Node trouvait moment dans `C:\DASHNOV\node_modules` (root)

**Solution:**
Copie complète de moment depuis root:
```powershell
Copy-Item "C:\DASHNOV\node_modules\moment" `
    -Destination "C:\DASHNOV\Server\node_modules\moment" -Recurse -Force
```

### 10.2 Points d'attention pour les développeurs

**1. Ne jamais modifier node_modules manuellement**
- Toujours passer par npm install
- Exception: correction moment (cas spécial documenté)

**2. Tester sur machine vierge**
- Utiliser VM Windows propre
- Pas de Node.js préinstallé
- Pas de SQL Server préinstallé

**3. Vérifier les logs après chaque installation**
```powershell
Get-Content C:\DashNov\Logs\service-error.log
```

**4. Build toujours depuis serveur fonctionnel**
- Vérifier que DashNov tourne localement
- Tester accès DB avant build
- Vérifier node_modules complet

**5. Documentation des changements**
- Mettre à jour ce document à chaque modification
- Incrémenter version dans commit
- Noter breaking changes

---

## Annexes

### A. Commandes complètes

**Build complet:**
```powershell
# 1. Vérifier serveur fonctionne
cd C:\DASHNOV\Server
node server.js  # Doit démarrer sans erreur, Ctrl+C pour arrêter

# 2. Vérifier moment
Test-Path C:\DASHNOV\Server\node_modules\moment\package.json  # Doit être True

# 3. Builder
cd C:\DASHNOV\Scripts
.\build-installer.ps1 -Version "1.3"

# 4. Vérifier ZIP
Test-Path C:\DASHNOV_Installer_Build\DASHNOV_Setup_v1.3.zip  # Doit être True
```

**Installation complète:**
```powershell
# 1. Extraire ZIP
Expand-Archive -Path "DASHNOV_Setup_v1.3.zip" -DestinationPath "C:\Temp\DashNov_Install"

# 2. Installer (admin)
cd C:\Temp\DashNov_Install
.\Setup.bat

# 3. Vérifier installation
Get-Service DashNovService  # Running
Invoke-WebRequest http://localhost:8085  # StatusCode 200
```

### B. Checklist de validation

**Avant build:**
- [ ] Serveur DashNov fonctionne localement
- [ ] Base de données accessible
- [ ] Interface DashNov5_GUI.html à jour
- [ ] assets/ complet
- [ ] node_modules/ complet avec moment

**Après build:**
- [ ] ZIP créé (~65 MB)
- [ ] ZIP contient Server/public/index.html
- [ ] ZIP contient Server/public/assets/
- [ ] ZIP contient Server/node_modules/moment/package.json
- [ ] ZIP contient Database/DashNovDB_backup.bak (>1 MB)

**Après installation:**
- [ ] Service Running
- [ ] http://localhost:8085 accessible (200 OK)
- [ ] Interface s'affiche correctement
- [ ] Pas d'erreur dans service-error.log
- [ ] Base de données restaurée
- [ ] Connexion SQL fonctionne

### C. Références

**Documentation officielle:**
- Node.js: https://nodejs.org/docs/
- Express: https://expressjs.com/
- NSSM: https://nssm.cc/usage
- SQL Server: https://docs.microsoft.com/sql/

**Fichiers importants:**
- C:\DASHNOV\Scripts\build-installer.ps1
- C:\DASHNOV\Installer\Install.ps1
- C:\DASHNOV\Server\server.js
- C:\DASHNOV\Server\SQL.env

**Repository:**
- GitHub: git@github.com:DASHNOV/DASHNOV_PROJECT.git
- Branche: R-offlineInstaller

---

**FIN DU DOCUMENT**

Version: 1.3
Date de dernière mise à jour: 14 novembre 2025
