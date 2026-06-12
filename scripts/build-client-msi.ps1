# ============================================================
# Build Sisbackup Native Desktop Client .msi Installer
# ============================================================
# Prasyarat:
#   1. .NET 8 SDK      → https://dotnet.microsoft.com/download/dotnet/8.0
#   2. WiX Toolset v4   → dotnet tool install --global wix
#   3. Windows App SDK  → (included in .NET 8 workload)
#   4. rclone.exe       → download dari https://rclone.org/downloads/
# ============================================================

param(
    [string]$Version = "2.7.0",
    [string]$OutputDir = ".\dist",
    [switch]$SelfContained = $false
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Sisbackup Client .msi Builder v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ─── Step 1: Download rclone (jika belum ada) ──────────────
Write-Host "`n[1/5] Checking rclone..." -ForegroundColor Yellow
$rcloneDir = "$root\native-client\deps"
$rcloneExe = "$rcloneDir\rclone.exe"

if (-not (Test-Path $rcloneExe)) {
    Write-Host "  Downloading rclone for Windows..." -ForegroundColor Yellow
    if (-not (Test-Path $rcloneDir)) { New-Item -ItemType Directory -Path $rcloneDir -Force }

    $rcloneUrl = "https://downloads.rclone.org/rclone-current-windows-amd64.zip"
    $rcloneZip = "$rcloneDir\rclone.zip"
    Invoke-WebRequest -Uri $rcloneUrl -OutFile $rcloneZip

    Expand-Archive -Path $rcloneZip -DestinationPath $rcloneDir -Force
    $extracted = Get-ChildItem -Path $rcloneDir -Directory | Where-Object { $_.Name -like "rclone-*" } | Select-Object -First 1
    Copy-Item "$($extracted.FullName)\rclone.exe" $rcloneExe
    Remove-Item $rcloneZip
    Remove-Item $extracted.FullName -Recurse -Force

    Write-Host "  rclone downloaded: $rcloneExe" -ForegroundColor Green
} else {
    Write-Host "  rclone found: $rcloneExe" -ForegroundColor Green
}

# ─── Step 2: Restore NuGet packages ────────────────────────
Write-Host "`n[2/5] Restoring NuGet packages..." -ForegroundColor Yellow
$projectPath = "$root\native-client\SisbackupClient\SisbackupClient.csproj"
dotnet restore $projectPath -r win-x64

# ─── Step 3: Publish WinUI 3 App ───────────────────────────
Write-Host "`n[3/5] Publishing WinUI 3 application..." -ForegroundColor Yellow
$publishDir = "$root\native-client\SisbackupClient\bin\Release\net8.0-windows10.0.19041.0\win-x64\publish"

if ($SelfContained) {
    # Self-contained = includes .NET runtime + Windows App SDK
    dotnet publish $projectPath `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -p:WindowsAppSDKSelfContained=true `
        -p:PublishSingleFile=true `
        -o $publishDir
} else {
    # Framework-dependent = user needs .NET 8 runtime
    dotnet publish $projectPath `
        -c Release `
        -r win-x64 `
        --self-contained false `
        -p:WindowsAppSDKSelfContained=false `
        -o $publishDir
}

# ─── Step 4: Bundle rclone ke publish folder ───────────────
Write-Host "`n[4/5] Bundling rclone..." -ForegroundColor Yellow
$rcloneDest = "$publishDir\rclone"
if (Test-Path $rcloneDest) { Remove-Item -Recurse -Force $rcloneDest }
New-Item -ItemType Directory -Path $rcloneDest -Force
Copy-Item $rcloneExe "$rcloneDest\rclone.exe"
Write-Host "  rclone bundled: $rcloneDest\rclone.exe" -ForegroundColor Green

# Copy tray icons (placeholder - use real icons in production)
$assetsDir = "$publishDir\Assets"
if (-not (Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir -Force }

# ─── Step 5: Build .msi dengan WiX Toolset v4 ──────────────
Write-Host "`n[5/5] Building .msi installer..." -ForegroundColor Yellow

$installerDir = "$root\native-client\Installer"
$wxsFile = "$installerDir\SisbackupClient.wxs"
$msiOutput = "$OutputDir\SisbackupClient-$Version-x64.msi"

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force }

Push-Location "$root\native-client"
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
