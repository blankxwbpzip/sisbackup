# ============================================================
# Build Sisbackup Desktop App Server .msi Installer
# ============================================================
# Prasyarat:
#   1. .NET 8 SDK      → https://dotnet.microsoft.com/download/dotnet/8.0
#   2. WiX Toolset v4   → dotnet tool install --global wix
#   3. Node.js 20       → https://nodejs.org (untuk bundle server)
# ============================================================

param(
    [string]$Version = "2.6.0",
    [string]$OutputDir = ".\dist",
    [switch]$SelfContained = $false
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Sisbackup Server .msi Builder v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ─── Step 1: Restore & Build Node.js Server ────────────────
Write-Host "`n[1/5] Building Node.js server..." -ForegroundColor Yellow
Push-Location "$root\server"
npm install --production
npm run db:init
Pop-Location

# ─── Step 2: Build Web Admin Dashboard ─────────────────────
Write-Host "`n[2/5] Building Web Admin UI..." -ForegroundColor Yellow
Push-Location "$root\server\web"
npm install
npm run build
Pop-Location

# ─── Step 3: Publish .NET WPF App ──────────────────────────
Write-Host "`n[3/5] Publishing .NET WPF application..." -ForegroundColor Yellow
$projectPath = "$root\desktop-server\SisbackupServer\SisbackupServer.csproj"
$publishDir = "$root\desktop-server\SisbackupServer\bin\Release\net8.0-windows\win-x64\publish"

if ($SelfContained) {
    dotnet publish $projectPath `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -o $publishDir
} else {
    dotnet publish $projectPath `
        -c Release `
        -r win-x64 `
        --self-contained false `
        -o $publishDir
}

# ─── Step 4: Copy Node.js server ke publish folder ─────────
Write-Host "`n[4/5] Bundling Node.js server..." -ForegroundColor Yellow
$nodeServerDir = "$publishDir\NodeServer"
if (Test-Path $nodeServerDir) { Remove-Item -Recurse -Force $nodeServerDir }

# Copy server source
Copy-Item -Recurse "$root\server\src" "$nodeServerDir\src"
Copy-Item -Recurse "$root\server\web\dist" "$nodeServerDir\web\dist"
Copy-Item "$root\server\package.json" "$nodeServerDir\package.json"
Copy-Item "$root\server\node_modules" "$nodeServerDir\node_modules" -Recurse

# Bundle Node.js runtime (opsional - untuk self-contained installer)
if ($SelfContained) {
    $nodeExe = (Get-Command node).Source
    $nodeDir = Split-Path -Parent $nodeExe
    Copy-Item $nodeExe "$nodeServerDir\node\node.exe"
    Write-Host "  Node.js bundled from: $nodeExe" -ForegroundColor Green
}

# ─── Step 5: Build .msi dengan WiX Toolset v4 ──────────────
Write-Host "`n[5/5] Building .msi installer..." -ForegroundColor Yellow

# Ensure WiX is installed
$wixInstalled = dotnet tool list --global | Select-String "wix"
if (-not $wixInstalled) {
    Write-Host "Installing WiX Toolset v4..." -ForegroundColor Yellow
    dotnet tool install --global wix
}

# Build MSI
$installerDir = "$root\desktop-server\Installer"
$wxsFile = "$installerDir\SisbackupServer.wxs"
$msiOutput = "$OutputDir\SisbackupServer-$Version-x64.msi"

# Create output directory
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force }

# Build menggunakan wix build
Push-Location "$root\desktop-server"
wix build -arch x64 -out $msiOutput $wxsFile `
    -d "INSTALLFOLDER=$publishDir" `
    -d "Version=$Version"
Pop-Location

if (Test-Path $msiOutput) {
    $size = (Get-Item $msiOutput).Length / 1MB
    Write-Host "`n✅ .msi berhasil dibuat!" -ForegroundColor Green
    Write-Host "   Path: $msiOutput" -ForegroundColor White
    Write-Host "   Size: $([math]::Round($size, 1)) MB" -ForegroundColor White
} else {
    Write-Host "`n❌ Gagal membuat .msi" -ForegroundColor Red
}
