# ============================================================
# Sisbackup Server Installer
# ============================================================
# Cara pakai:
#   PowerShell (Run as Administrator):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\install.ps1
# ============================================================

param(
    [string]$InstallPath = "C:\Program Files\Sisbackup Server",
    [int]$Port = 3001,
    [string]$StoragePath = "D:\BackupSekolah"
)

$ErrorActionPreference = "Stop"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Sisbackup Server v2.6.0 Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check Windows version
$build = [Environment]::OSVersion.Version.Build
if ($build -lt 19045) {
    Write-Host "ERROR: Windows 10 22H2 (Build 19045) or higher required. Current build: $build" -ForegroundColor Red
    exit 1
}

# Create install directory
Write-Host "`n[1/4] Installing to $InstallPath..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) { New-Item -ItemType Directory -Path $InstallPath -Force }
Copy-Item -Recurse "$PSScriptRoot\server\*" $InstallPath -Force

# Create storage directory
Write-Host "[2/4] Creating storage at $StoragePath..." -ForegroundColor Yellow
if (-not (Test-Path $StoragePath)) { New-Item -ItemType Directory -Path $StoragePath -Force }

# Configure firewall
Write-Host "[3/4] Configuring Windows Firewall..." -ForegroundColor Yellow
try {
    netsh advfirewall firewall add rule name="Sisbackup Server" dir=in action=allow protocol=TCP localport=$Port profile=private,domain 2>$null
    Write-Host "  Firewall rule added for port $Port" -ForegroundColor Green
} catch {
    Write-Host "  Warning: Could not add firewall rule (run as admin)" -ForegroundColor Yellow
}

# Create shortcuts
Write-Host "[4/4] Creating shortcuts..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell

# Desktop shortcut
$DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Sisbackup Server.lnk")
$DesktopShortcut.TargetPath = "$InstallPath\SisbackupServer.exe"
$DesktopShortcut.WorkingDirectory = $InstallPath
$DesktopShortcut.Save()

# Start Menu
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Sisbackup"
if (-not (Test-Path $StartMenuDir)) { New-Item -ItemType Directory -Path $StartMenuDir -Force }
$StartShortcut = $WshShell.CreateShortcut("$StartMenuDir\Sisbackup Server.lnk")
$StartShortcut.TargetPath = "$InstallPath\SisbackupServer.exe"
$StartShortcut.WorkingDirectory = $InstallPath
$StartShortcut.Save()

Write-Host "`n✅ Installation complete!" -ForegroundColor Green
Write-Host "   Install Path : $InstallPath" -ForegroundColor White
Write-Host "   Storage Path : $StoragePath" -ForegroundColor White
Write-Host "   Server Port  : $Port" -ForegroundColor White
Write-Host "   Web Admin    : http://localhost:$Port" -ForegroundColor White
Write-Host "`n   Double-click 'Sisbackup Server' on your desktop to start!" -ForegroundColor Yellow
