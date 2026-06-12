# ============================================================
# Build ALL Sisbackup Windows Installers
# ============================================================
# Usage:
#   .\scripts\build-all.ps1                    # Build both (framework-dependent)
#   .\scripts\build-all.ps1 -SelfContained     # Build both (self-contained)
# ============================================================

param(
    [switch]$SelfContained,
    [string]$Version = "2.7.0",
    [string]$OutputDir = ".\dist"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent

Write-Host @"
╔══════════════════════════════════════════════════════╗
║     Sisbackup Windows Installer Builder              ║
║     Version: $Version                                    ║
║     Mode: $(if ($SelfContained) { 'Self-Contained' } else { 'Framework-Dependent' })           ║
╚══════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Create output dir
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force }

# ─── Build Server .msi ────────────────────────────────────
Write-Host "`n🔨 Building Desktop App Server .msi..." -ForegroundColor Yellow
& "$root\scripts\build-server-msi.ps1" -Version $Version -OutputDir $OutputDir -SelfContained:$SelfContained

# ─── Build Client .msi ────────────────────────────────────
Write-Host "`n🔨 Building Native Desktop Client .msi..." -ForegroundColor Yellow
& "$root\scripts\build-client-msi.ps1" -Version $Version -OutputDir $OutputDir -SelfContained:$SelfContained

# ─── Summary ──────────────────────────────────────────────
Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Build Complete!                                  ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green

Get-ChildItem $OutputDir *.msi | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 1)
    Write-Host "  📦 $($_.Name) — $sizeMB MB" -ForegroundColor White
}

Write-Host "`nInstall dengan:" -ForegroundColor Yellow
Write-Host "  msiexec /i dist\SisbackupServer-$Version-x64.msi /quiet" -ForegroundColor Gray
Write-Host "  msiexec /i dist\SisbackupClient-$Version-x64.msi /quiet" -ForegroundColor Gray
