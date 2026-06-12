# Panduan Instalasi Sisbackup

## Daftar Isi

1. [System Requirements](#system-requirements)
2. [Instalasi App Server (Windows)](#instalasi-app-server-windows)
3. [Instalasi App Server (Linux)](#instalasi-app-server-linux)
4. [Instalasi Client Desktop](#instalasi-client-desktop)
5. [Verifikasi Instalasi](#verifikasi-instalasi)
6. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Windows (App Server & Client)

| Komponen | Minimum | Recommended |
|----------|---------|-------------|
| **OS** | Windows 10 22H2 (Build 19045) | Windows 11 23H2+ |
| **OS (Server)** | Windows Server 2019/2022 | Windows Server 2022 |
| **RAM** | 2 GB (Server) / 512 MB (Client) | 4 GB / 1 GB |
| **Disk** | 500 MB app + storage | 1 GB app + storage |
| **CPU** | x64, 1.5 GHz dual-core | x64, 2 GHz quad-core |

> ⚠️ **PENTING**: Windows 10 versi di bawah Build 19045 (Windows 10 1507-21H2, Windows 8.1, Windows 7) **tidak didukung**. Pastikan Windows Anda sudah di-update ke versi terbaru.

### Required Dependencies (di-bundle otomatis di installer)

Dependency berikut **sudah termasuk** dalam installer `.msi`/`.exe`. Anda tidak perlu install manual:

| Dependency | Diperlukan Oleh | Di-bundle? |
|------------|----------------|------------|
| **Microsoft Visual C++ 2015-2022 Redistributable (x64)** | rclone, native Node.js modules, WinFsp | ✅ Ya (~14 MB) |
| **.NET 8 Desktop Runtime (x64)** | Fase 6 Server GUI, Fase 7 Client | ✅ Ya (self-contained) |
| **Node.js 20 LTS** | App Server | ✅ Ya (Fase 6+) |
| **WinFsp 2.0+** | Fitur mount drive | ✅ Ya (opsional, ~5 MB) |

> Jika Anda melakukan instalasi **manual** (development mode), install dependency di atas secara terpisah sebelum menjalankan aplikasi.

---

## Instalasi App Server (Windows)

### Prasyarat

- Windows 10 22H2+ / Windows 11 / Windows Server 2019+
- Minimal RAM: 2GB (4GB recommended)
- Ruang disk untuk backup data
- .NET Framework 4.8 (untuk beberapa dependency)

### Langkah Instalasi

#### 1. Jalankan Installer

Download dan jalankan `Sisbackup-Server-Setup-2.0.0.exe`.

Atau, install manual:

```powershell
# Download dan extract
# Pastikan Node.js 20+ sudah terinstall
node --version  # harus v20.x.x atau lebih tinggi

# Clone / copy folder server ke PC
cd server
npm install

# Inisialisasi database
npm run db:init

# Jalankan server
npm run dev
```

#### 2. Konfigurasi Awal

1. Buka browser, akses `http://localhost:3001`
2. Anda akan diarahkan ke halaman **Setup**
3. Isi nama admin, username, dan password
4. Klik **Selesai Setup**

#### 3. Konfigurasi Storage

1. Login sebagai admin
2. Buka menu **Pengaturan**
3. Atur **Path Penyimpanan** (default: `server/data/backups`)
   - Untuk drive eksternal: `D:\BackupSekolah`
   - Untuk NAS: `\\192.168.1.50\share\backup`
4. Atur **Default Kuota** per user (default: 5GB)
5. Klik **Simpan Perubahan**

#### 4. Menjalankan sebagai Windows Service (Opsional)

```powershell
# Install node-windows (jika belum)
npm install -g node-windows

# Jalankan script service
node install-service.js
```

### Akses dari Komputer Lain

1. Pastikan firewall mengizinkan port 3001:
   ```powershell
   New-NetFirewallRule -DisplayName "Sisbackup Server" -Direction Inbound -Port 3001 -Protocol TCP -Action Allow
   ```

2. Akses dari komputer lain di LAN: `http://[IP-SERVER]:3001`

---

## Instalasi App Server (Linux)

### Prasyarat

- Ubuntu Server 22.04/24.04 LTS atau Debian 12+
- Minimal RAM: 1GB (2GB recommended)
- Node.js 20+

### Langkah Instalasi

#### 1. Install Node.js

```bash
# Menggunakan NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi
node --version
```

#### 2. Install Sisbackup Server

**Via `.deb` package:**

```bash
sudo dpkg -i sisbackup-server_2.0.0_amd64.deb
sudo apt install -f  # install dependencies jika diperlukan
```

**Manual install:**

```bash
# Copy folder server ke /opt/sisbackup
sudo mkdir -p /opt/sisbackup
sudo cp -r server/* /opt/sisbackup/

cd /opt/sisbackup
npm install
npm run db:init
```

#### 3. Setup systemd Service

```bash
sudo tee /etc/systemd/system/sisbackup-server.service << 'EOF'
[Unit]
Description=Sisbackup App Server
After=network.target

[Service]
Type=simple
User=sisbackup
WorkingDirectory=/opt/sisbackup
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF

# Buat user dan atur permission
sudo useradd -r -s /bin/false sisbackup
sudo chown -R sisbackup:sisbackup /opt/sisbackup

# Start service
sudo systemctl daemon-reload
sudo systemctl enable --now sisbackup-server
sudo systemctl status sisbackup-server
```

#### 4. Konfigurasi Firewall (UFW)

```bash
sudo ufw allow 3001/tcp
```

#### 5. Akses Web Admin

Buka browser: `http://[IP-SERVER]:3001`

---

## Instalasi Client Desktop

### Prasyarat

- Windows 10 22H2+ / Windows 11
- 100 MB ruang disk untuk aplikasi
- rclone (otomatis di-bundle, tidak perlu install manual)

### Langkah Instalasi

#### 1. Install Aplikasi

Jalankan `Sisbackup-Client-Setup-2.0.0.exe` dan ikuti wizard.

Atau **silent install via command line:**

```powershell
Sisbackup-Client-Setup-2.0.0.exe /S /D=C:\Program Files\Sisbackup
```

#### 2. Setup Awal

1. Buka aplikasi Sisbackup dari desktop shortcut
2. **Setup Wizard** akan muncul:
   - Masukkan alamat server sekolah (contoh: `http://192.168.1.100:3001`)
   - Klik **Test Koneksi** untuk memastikan server terjangkau
   - Pilih apakah juga ingin backup ke Drive pribadi
3. Klik **Mulai Gunakan Sisbackup**

#### 3. Login

1. Masukkan username dan password (diberikan oleh admin/operator)
2. Setelah login, Anda akan melihat dashboard utama

#### 4. Tambah Folder Backup

1. Klik **+ Tambah** di bagian "Folder yang Dibackup"
2. Pilih folder yang ingin di-backup (misal: `D:\Data Guru`)
3. Atur jadwal sync (realtime / periodik / manual)
4. Opsional: atur filter include/exclude
5. Klik **Tambah Folder**

#### 5. Tambah Tujuan Backup

1. Klik **+ Tambah** di bagian "Tujuan Backup"
2. Pilih tipe tujuan:
   - **Server Sekolah**: Sync ke App Server
   - **Google Drive**: Sync ke GDrive pribadi
   - **OneDrive**: Sync ke OneDrive pribadi
3. Klik **Tambah Tujuan**

---

## Verifikasi Instalasi

### Cek Server

```bash
curl http://localhost:3001/api/health
```

Response yang diharapkan:

```json
{
  "status": "ok",
  "uptime": 123.45,
  "version": "2.0.0",
  "platform": "win32",
  "arch": "x64",
  "nodeVersion": "v20.x.x",
  "connections": { "totalConnections": 0, "uniqueUsers": 0 }
}
```

### Cek Client

1. System tray icon akan muncul di taskbar (ikon 📦)
2. Klik kanan icon → pilih **Buka Sisbackup**
3. Dashboard utama menampilkan folder dan tujuan yang sudah dikonfigurasi

---

## Troubleshooting

### Server tidak bisa diakses dari client

1. Cek firewall: pastikan port 3001 terbuka
2. Cek server berjalan: `curl http://localhost:3001/api/health`
3. Cek IP server: `ipconfig` (Windows) atau `ip a` (Linux)
4. Cek client dan server dalam subnet yang sama

### Client gagal sync

1. Pastikan rclone terinstall (di-bundle dalam aplikasi)
2. Cek log: lihat di folder `%APPDATA%\Sisbackup\logs`
3. Cek koneksi ke server: test lewat browser
4. Cek kuota: pastikan belum melebihi batas

### Database corrupt

```bash
# Backup database
copy server\data\sisbackup.db server\data\sisbackup.db.backup

# Re-inisialisasi
cd server
npm run db:init
```

### Reset password admin

```bash
# Hapus database dan setup ulang
rm server/data/sisbackup.db
cd server && npm run db:init
# Buka http://localhost:3001 - akan muncul halaman setup
```

---

> **Versi Dokumen**: 1.0
> **Tanggal**: 12 Juni 2026
