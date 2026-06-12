# Panduan Build .msi Installer

## Prasyarat (Install Sekali)

### 1. .NET 8 SDK
Download & install:
```
https://dotnet.microsoft.com/download/dotnet/8.0
```
Pilih **.NET 8.0 SDK** → Windows x64 Installer

### 2. WiX Toolset v4
```powershell
dotnet tool install --global wix
```

### 3. Node.js 20 (untuk App Server)
```
https://nodejs.org
```
Pilih **LTS** → Windows Installer (.msi) 64-bit

### 4. rclone (untuk Client)
```
https://rclone.org/downloads/
```
Download `rclone-current-windows-amd64.zip` — script akan auto-download jika belum ada.

---

## Build .msi

### Build Semua (Server + Client)

```powershell
cd D:\bot\git\sisbackup
.\scripts\build-all.ps1
```

### Build Server Saja

```powershell
.\scripts\build-server-msi.ps1
```

### Build Client Saja

```powershell
.\scripts\build-client-msi.ps1
```

### Self-Contained Mode (tidak perlu install .NET)

```powershell
# File .msi lebih besar (~150 MB) tapi user tidak perlu install .NET
.\scripts\build-all.ps1 -SelfContained
```

---

## Hasil Build

File `.msi` akan ada di folder `dist\`:

| File | Size (est.) | Keterangan |
|------|------------|------------|
| `SisbackupServer-2.6.0-x64.msi` | ~80 MB | App Server + Web Admin |
| `SisbackupClient-2.7.0-x64.msi` | ~120 MB | Native Client + rclone |

---

## Install .msi

### GUI (double-click)
Klik dua kali file `.msi` → Next → Next → Finish

### Silent Install (deployment massal)
```powershell
# Server
msiexec /i SisbackupServer-2.6.0-x64.msi /quiet /norestart

# Client  
msiexec /i SisbackupClient-2.7.0-x64.msi /quiet /norestart

# Client dengan auto-start
msiexec /i SisbackupClient-2.7.0-x64.msi /quiet AUTOSTART=1
```

### Uninstall
```powershell
msiexec /x SisbackupServer-2.6.0-x64.msi /quiet
msiexec /x SisbackupClient-2.7.0-x64.msi /quiet
```

### Deploy via Group Policy (Windows Domain)
1. Letakkan `.msi` di network share (misal: `\\server\deploy\`)
2. Buka Group Policy Management
3. Computer Configuration → Policies → Software Settings → Assigned Applications
4. New → Package → pilih `.msi` dari network share
5. Pilih "Assigned" → OK
6. Client akan auto-install saat reboot

---

## Struktur Installer

### Yang di-install oleh Server .msi:
```
C:\Program Files\Sisbackup Server\Server\
├── SisbackupServer.exe      ← WPF GUI app
├── NodeServer\               ← Node.js Fastify server
│   ├── node\node.exe        (jika self-contained)
│   ├── src\index.js
│   ├── web\dist\
│   └── node_modules\
└── rclone\rclone.exe
```

### Yang di-install oleh Client .msi:
```
C:\Program Files\Sisbackup Client\Client\
├── SisbackupClient.exe       ← WinUI 3 native app
├── rclone\rclone.exe         ← Sync engine
└── Assets\                   ← Icons, tray icons
```

### Registry yang dibuat:
- `HKLM\Software\Sisbackup\Server` — install path, version
- `HKLM\Software\Sisbackup\Client` — install path, version
- `HKCU\...\Run\SisbackupClient` — auto-start
- `HKCR\Directory\shell\Sisbackup.Backup` — context menu
