# DashNov Application

Application de gestion DashNov avec installation offline complete.

## Structure du Projet

```
DASHNOV/
â”œâ”€â”€ docs/              Documentation complete
â”œâ”€â”€ src/               Code source
â”œâ”€â”€ deployment/        Scripts installation et build
â”œâ”€â”€ config/            Configuration
â”œâ”€â”€ database/          Base de donnees
â”œâ”€â”€ tests/             Tests unitaires et integration
â”œâ”€â”€ dist/              Build output (genere)
â””â”€â”€ logs/              Logs application (genere)
```

## Demarrage Rapide

### Developpement

```powershell
cd src/server
npm install
node index.js
```

### Production

Voir [docs/installation/offline-installation.md](docs/installation/offline-installation.md)

## Documentation

- [Guide Installation Offline](docs/installation/offline-installation.md)
- [Prerequisites](docs/installation/prerequisites.md)
- [Architecture](docs/development/architecture.md)

## Scripts Utiles

```powershell
# Build installer offline
.\deployment\build\build-installer.ps1 -Version "1.4"

# Installer sur client
.\deployment\installer\Setup.bat

# Maintenance
.\deployment\maintenance\Fix-service.ps1
```

## License

Proprietary - DashNov Project
