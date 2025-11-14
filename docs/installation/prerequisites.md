# DashNov - Guide d'Installation Hors-Ligne

## 📋 Prérequis Système

### Système d'exploitation
- **Windows 10** ou supérieur (64-bit)
- **Droits administrateur** requis

### Logiciels requis

#### 1. SQL Server (OBLIGATOIRE)
**Option A - Installation automatique (recommandé)** :
- SQL Server Express sera installé automatiquement si inclus dans le package
- Aucune action requise de votre part

**Option B - Installation manuelle** :
Si SQL Server Express n'est pas inclus dans le package, vous devez l'installer avant :
1. Télécharger SQL Server Express : https://www.microsoft.com/fr-fr/sql-server/sql-server-downloads
2. Installer avec l'instance nommée : `SQLEXPRESS`
3. Activer l'authentification mixte (Windows + SQL Server)
4. Mot de passe SA : `Sql2022!` (ou personnalisé dans SQL.env)

#### 2. Node.js (OPTIONNEL)
- Node.js sera installé automatiquement si inclus dans le package
- Version recommandée : 18.x LTS ou supérieur

---

## 📦 Contenu du Package

```
DASHNOV_Setup_vX.X/
│
├── Setup.bat                  # Lanceur d'installation (double-clic)
├── Install.ps1                # Script d'installation PowerShell
├── README.txt                 # Instructions rapides
│
├── Server/                    # Application Node.js
│   ├── server.js              # Serveur principal
│   ├── package.json           # Dépendances
│   ├── node_modules/          # Modules Node.js (installation hors-ligne)
│   ├── public/                # Interface web
│   └── SQL.env                # Configuration base de données
│
├── Database/                  # Base de données
│   ├── Amadeus5.bak           # Backup SQL Server
│   └── SQLEXPR*.exe           # [OPTIONNEL] Installeur SQL Server Express
│
├── NodeJS/                    # Node.js
│   └── node-v*.msi            # Installeur Node.js
│
└── Tools/                     # Outils
    └── nssm-2.24/             # NSSM (service Windows)
```

---

## 🚀 Installation

### Étape 1 : Extraction
1. Extraire le fichier ZIP complet
2. Placer le dossier sur la machine cliente

### Étape 2 : Lancement
1. Ouvrir le dossier extrait
2. **Clic droit** sur `Setup.bat`
3. Sélectionner **"Exécuter en tant qu'administrateur"**

### Étape 3 : Processus automatique
Le script va automatiquement :
1. ✅ Vérifier les prérequis Windows
2. ✅ Installer Node.js (si nécessaire)
3. ✅ Installer SQL Server Express (si inclus et non installé)
4. ✅ Copier les fichiers dans `C:\DashNov`
5. ✅ Restaurer la base de données `Amadeus5`
6. ✅ Configurer le service Windows `DashNovService`
7. ✅ Démarrer l'application

### Étape 4 : Vérification
- L'application sera accessible sur : **http://localhost:8085**
- Service Windows : `DashNovService` (démarrage automatique)
- Logs d'installation : `C:\DashNov\Logs\install.log`

---

## ⚙️ Configuration

### Chemins d'installation (par défaut)
- **Application** : `C:\DashNov\Server\`
- **Logs** : `C:\DashNov\Logs\`
- **Base de données SQL** : Dépend de l'instance SQL Server

### Ports réseau
- **Port HTTP** : `8085` (modifiable dans `SQL.env`)

### Base de données
- **Instance SQL** : Détection automatique (ex: `.\SQLEXPRESS`)
- **Nom BDD** : `Amadeus5`
- **Authentification** : Windows Authentication + SQL Authentication

Fichier de configuration : `C:\DashNov\Server\SQL.env`

```env
DB_SERVER=.\SQLEXPRESS
DB_DATABASE=Amadeus5
DB_USER=sa
DB_PASSWORD=Sql2022!
```

---

## 🔧 Dépannage

### ❌ Erreur : "SQL Server n'est pas installé"
**Solution** :
- Si SQL Server Express est dans le package → Il s'installera automatiquement
- Sinon, installer SQL Server Express manuellement avant de relancer Setup.bat

### ❌ Erreur : "node_modules manquant"
**Cause** : Le package d'installation est incomplet
**Solution** :
- Le créateur du package doit inclure `node_modules` pour une installation hors-ligne
- Recréer le package avec `build-installer.ps1`

### ❌ Service ne démarre pas
**Vérifications** :
1. Vérifier que le fichier `C:\DashNov\Server\server.js` existe
2. Vérifier les logs : `C:\DashNov\Logs\service-error.log`
3. Tester le démarrage manuel :
   ```cmd
   cd C:\DashNov\Server
   node server.js
   ```

### ❌ Port 8085 déjà utilisé
**Solution** :
1. Modifier le port dans `C:\DashNov\Server\SQL.env`
2. Redémarrer le service : `Restart-Service DashNovService`

---

## 📝 Gestion du Service

### Commandes PowerShell (Administrateur)

**Démarrer le service** :
```powershell
Start-Service DashNovService
```

**Arrêter le service** :
```powershell
Stop-Service DashNovService
```

**Redémarrer le service** :
```powershell
Restart-Service DashNovService
```

**Vérifier l'état** :
```powershell
Get-Service DashNovService
```

**Démarrage manuel (sans service)** :
```powershell
cd C:\DashNov\Server
node server.js
```

---

## 📞 Support

### Logs disponibles
- **Installation** : `C:\DashNov\Logs\install.log`
- **Service (stdout)** : `C:\DashNov\Logs\service.log`
- **Service (erreurs)** : `C:\DashNov\Logs\service-error.log`

### Vérification de santé
- URL : http://localhost:8085
- Si la page s'affiche → Installation réussie ✅

---

## 🔐 Sécurité

### Pare-feu Windows
Le port 8085 peut nécessiter une règle de pare-feu pour l'accès distant.

**Autoriser le port** :
```powershell
New-NetFirewallRule -DisplayName "DashNov HTTP" -Direction Inbound -LocalPort 8085 -Protocol TCP -Action Allow
```

### Mots de passe par défaut
⚠️ **IMPORTANT** : Modifier le mot de passe SQL Server `sa` après l'installation :
```sql
ALTER LOGIN sa WITH PASSWORD = 'VotreNouveauMotDePasseComplexe!';
```

Puis mettre à jour `C:\DashNov\Server\SQL.env`.

---

## ✅ Checklist d'Installation

- [ ] Windows 10+ (64-bit)
- [ ] Droits administrateur
- [ ] Package ZIP extrait
- [ ] Setup.bat exécuté en administrateur
- [ ] SQL Server installé (automatique ou manuel)
- [ ] Node.js installé (automatique)
- [ ] Service DashNovService démarré
- [ ] http://localhost:8085 accessible

---

**Date de création** : Novembre 2024
**Version** : 1.0
