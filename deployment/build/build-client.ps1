# Build Client pour Production
# Ce script copie les fichiers sources de src/client vers dist/client

$sourceDir = "c:\DASHNOV\src\client"
$destDir = "c:\DASHNOV\dist\client"

Write-Host "Build Client DASHNOV" -ForegroundColor Cyan
Write-Host "Source: $sourceDir" -ForegroundColor Gray
Write-Host "Destination: $destDir" -ForegroundColor Gray
Write-Host ""

# Nettoyer dist/client si existe
if (Test-Path $destDir) {
    Write-Host "Nettoyage de $destDir..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $destDir
}

# Creer le dossier de destination
Write-Host "Creation du dossier de destination..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $destDir -Force | Out-Null

# Copier tous les fichiers
Write-Host "Copie des fichiers..." -ForegroundColor Yellow
Copy-Item -Recurse -Path "$sourceDir\*" -Destination $destDir -Force

Write-Host ""
Write-Host "Build client termine avec succes !" -ForegroundColor Green
Write-Host "Fichiers disponibles dans: $destDir" -ForegroundColor Green

# Afficher un resume
$fileCount = (Get-ChildItem -Recurse -File $destDir | Measure-Object).Count
$folderCount = (Get-ChildItem -Recurse -Directory $destDir | Measure-Object).Count

Write-Host ""
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "   - Fichiers copies: $fileCount" -ForegroundColor Gray
Write-Host "   - Dossiers crees: $folderCount" -ForegroundColor Gray
