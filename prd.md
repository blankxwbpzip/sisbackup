# 📄 Product Requirements Document: Sisbackup v2.0

> **Sistem Backup Sekolah — Offline-First, Hybrid-Ready**

---

## Daftar Isi

1. [Visi & Tujuan Produk](#1-visi--tujuan-produk)
2. [Target Pengguna & Persona](#2-target-pengguna--persona)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Fase Pengembangan](#4-fase-pengembangan)
5. [Spesifikasi Fitur Detail](#5-spesifikasi-fitur-detail)
6. [Model Data](#6-model-data)
7. [Keamanan](#7-keamanan)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Roadmap & Milestones](#9-roadmap--milestones)
10. [Fase 6: Desktop App Server (Native Windows)](#10-fase-6-desktop-app-server-native-windows)
11. [Fase 7: Native Desktop Client (Windows)](#11-fase-7-native-desktop-client-windows)

---

## 1. Visi & Tujuan Produk

### Visi

Menjadi sistem backup data sekolah yang **dapat diandalkan dalam kondisi offline sekalipun** — memungkinkan guru dan operator sekolah menyimpan, mengelola, dan memulihkan data mereka dengan mudah, baik melalui server lokal sekolah maupun cloud pribadi mereka sendiri.

### Tujuan Utama

| # | Tujuan | Keterangan |
|---|--------|------------|
| T1 | **Offline-First** | Sistem berjalan penuh di jaringan lokal sekolah tanpa memerlukan internet |
| T2 | **Fleksibilitas Tujuan Sync** | Pengguna dapat memilih sync ke Server Lokal, Drive Pribadi (GDrive/dll), atau keduanya sekaligus |
| T3 | **Kemudahan Pengguna** | Guru tidak perlu memahami konsep teknis — cukup pilih folder, dan sistem bekerja otomatis |
| T4 | **Keamanan & Isolasi Data** | Data setiap pengguna terisolasi; enkripsi end-to-end untuk data sensitif |
| T5 | **Hybrid-Ready** | Dirancang agar dapat beralih dari mode offline ke online (sync server sekolah → cloud) tanpa migrasi ulang |

---

## 2. Target Pengguna & Persona

### Persona 1: Guru (End User)
- **Kebutuhan**: Backup file pembelajaran, RPP, soal ujian, nilai siswa
- **Skill teknis**: Rendah — hanya bisa operasi Windows Explorer dasar
- **Perangkat**: Laptop/PC sekolah dengan Windows 10/11, spesifikasi rendah-menengah
- **Ekspektasi**: "Saya simpan file di folder ini, otomatis aman. Kalau komputer rusak, data saya tidak hilang."

### Persona 2: Operator / Admin Sekolah
- **Kebutuhan**: Mengelola server backup, memonitor kapasitas, mengatur akun guru
- **Skill teknis**: Menengah — familiar dengan instalasi software dan administrasi dasar
- **Perangkat**: PC admin + akses ke server lokal sekolah
- **Ekspektasi**: "Saya bisa lihat semua backup berjalan baik, atur kuota per guru, dan pastikan server tidak penuh."

### Persona 3: Kepala Sekolah / Pengawas
- **Kebutuhan**: Laporan status backup, memastikan kepatuhan penyimpanan data
- **Skill teknis**: Rendah
- **Ekspektasi**: "Saya terima laporan bulanan bahwa semua data guru sudah di-backup."

---

## 3. Arsitektur Sistem

### 3.1 Gambaran Umum

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARSITEKTUR SISBACKUP                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ╔═══════════════════════════════════════════════════════════════╗ │
│   ║                 FASE 1: OFFLINE (LAN Sekolah)                 ║ │
│   ╠═══════════════════════════════════════════════════════════════╣ │
│   ║                                                               ║ │
│   ║  ┌──────────┐    ┌──────────┐    ┌────────────────────────┐  ║ │
│   ║  │ Client A  │    │ Client B  │    │   APP SERVER (On-Prem) │  ║ │
│   ║  │(Guru Ana) │    │(Guru Budi)│    │                        │  ║ │
│   ║  │           │    │           │    │  • Manajemen User      │  ║ │
│   ║  │ □→Server  │    │ □→Server  │    │  • Konfigurasi Backup  │  ║ │
│   ║  │ ☐→GDrive  │    │ ☑→Server  │    │  • Monitoring Kuota    │  ║ │
│   ║  │           │    │ ☑→GDrive  │    │  • Log & Reporting     │  ║ │
│   ║  └─────┬─────┘    └─────┬─────┘    │  • Storage Management  │  ║ │
│   ║        │                │          └───────────┬────────────┘  ║ │
│   ║        │    LAN (Ethernet / WiFi)             │               ║ │
│   ║        └────────────────┼─────────────────────┘               ║ │
│   ║                         │                                      ║ │
│   ║              ┌──────────┴──────────┐                           ║ │
│   ║              │   STORAGE SERVER     │                           ║ │
│   ║              │  (NAS / Local Disk)  │                           ║ │
│   ║              │  /data/backups/      │                           ║ │
│   ║              └─────────────────────┘                           ║ │
│   ╚═══════════════════════════════════════════════════════════════╝ │
│                                                                     │
│   ╔═══════════════════════════════════════════════════════════════╗ │
│   ║              FASE 2: HYBRID ONLINE (Internet)                 ║ │
│   ╠═══════════════════════════════════════════════════════════════╣ │
│   ║                                                               ║ │
│   ║  ┌────────────────────────┐         ☁️ INTERNET               ║ │
│   ║  │   APP SERVER (Sekolah) │           │                       ║ │
│   ║  │   (Mode: ONLINE)       │───────────┼───────────────────    ║ │
│   ║  └────────────────────────┘           │                       ║ │
│   ║                                       ├──► SISCLOUD           ║ │
│   ║  ┌──────────┐    ┌──────────┐         │    (Cloud Server)     ║ │
│   ║  │ Client A  │    │ Client B  │        │                      ║ │
│   ║  │           │    │           │        ├──► Google Drive       ║ │
│   ║  │ ☑→Server  │    │ ☑→Server  │        │    (Personal)         ║ │
│   ║  │ ☑→Siscloud│    │ ☑→GDrive  │        │                      ║ │
│   ║  └──────────┘    └──────────┘         ├──► OneDrive           ║ │
│   ║                                                                 ║ │
│   ║  ✨ Client bisa pilih kombinasi tujuan sync:                    ║ │
│   ║     • Server lokal saja                                         ║ │
│   ║     • Drive pribadi saja (GDrive, OneDrive, dll)                ║ │
│   ║     • Server lokal + Drive pribadi (dual backup)                ║ │
│   ║     • Server lokal + Siscloud (sync server→cloud otomatis)      ║ │
│   ╚═══════════════════════════════════════════════════════════════╝ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Komponen Sistem

#### A. App Server (On-Premise Server Sekolah)

Server yang diinstal di sekolah — menjadi pusat kendali seluruh sistem backup.

> **Strategi Dual-OS**: App Server mendukung **Windows dan Linux** sebagai first-class citizens.
> - **Windows**: Target utama — mayoritas sekolah menggunakan PC/server dengan Windows 10/11 atau Windows Server karena familiar dan mudah dikelola operator sekolah.
> - **Linux**: Didukung penuh — untuk sekolah dengan operator yang memiliki keahlian Linux (Ubuntu Server, Debian) yang menginginkan sistem lebih ringan, stabil, dan hemat resource.

| Aspek | Spesifikasi |
|-------|-------------|
| **OS Target** | **Windows**: Windows Server 2019/2022, Windows 10 22H2+, Windows 11 |
| | **Linux**: Ubuntu Server 22.04/24.04 LTS, Debian 12+ |
| **Runtime** | Node.js 20+ (backend API + WebSocket) — cross-platform, kode sama untuk kedua OS |
| **Framework** | Fastify (ringan, cepat, cocok untuk server lokal) |
| **Database** | SQLite via better-sqlite3 (offline, zero-config, portable) — file DB bisa dipindah antar OS |
| | Opsional: PostgreSQL untuk deployment skala besar |
| **Web UI** | React + Vite (dashboard admin berbasis web) |
| **File Storage** | Local disk / NAS / external HDD — mendukung path kustom (Windows: `D:\Backup`, Linux: `/mnt/backup`) |
| **Auth** | JWT-based local auth (offline) + optional LDAP/AD integration |
| **Port** | HTTP API di port 3001, WebSocket di port 3002, Web UI di port 3000 |
| **Service Manager** | Windows: Windows Service (via `node-windows` atau `winsw`) |
| | Linux: systemd service |

**Alasan Dual-OS untuk App Server:**
1. **Mayoritas sekolah** memiliki infrastruktur Windows — operator terbiasa dengan Windows GUI, update, dan manajemen dasar
2. **Sekolah dengan IT lebih mahir** sering memilih Linux untuk stabilitas, keamanan, dan efisiensi resource (bisa jalan di PC bekas dengan RAM 2GB)
3. **Keseragaman codebase** — Node.js dan SQLite bersifat cross-platform, sehingga tidak ada cabang kode berbeda untuk tiap OS
4. **Migrasi mudah** — database SQLite adalah file tunggal, bisa dipindahkan dari Windows ke Linux atau sebaliknya tanpa konversi

**Fungsi Utama App Server:**
- Manajemen user (admin dapat membuat/menghapus akun guru)
- Manajemen kuota penyimpanan per user
- Menerima dan menyimpan data backup dari client
- Monitoring status backup real-time
- Logging dan reporting
- (Fase 2) Menjadi bridge sync ke cloud (Siscloud / penyedia cloud lain)

#### B. Client Application (Desktop App untuk Guru/Staff)

Aplikasi yang berjalan di komputer masing-masing pengguna.

| Aspek | Spesifikasi |
|-------|-------------|
| **OS Target** | Windows 10/11 (primary), Linux (secondary) |
| **Framework** | Tauri v2 (Rust backend + React frontend) — ringan, hemat RAM |
| **Bundle Size** | < 50MB installer |
| **System Tray** | Selalu berjalan di background, notifikasi native OS |
| **Auto-Start** | Opsional: berjalan saat Windows boot |
| **Engine Sync** | rclone (di-bundle) — mendukung 40+ storage backend |

**Fungsi Utama Client:**
- Login ke App Server (atau login lokal jika standalone)
- Pilih folder yang akan di-backup
- Pilih tujuan backup (multi-select):
  - [x] Server lokal sekolah
  - [x] Google Drive pribadi
  - [x] OneDrive pribadi
  - [ ] Siscloud (jika tersedia)
- Monitoring status sync real-time + notifikasi
- Opsi: file versioning, retention policy, konflik resolution

#### C. Siscloud (Cloud Server — Fase 2)

Server cloud yang menjadi mirror dari App Server sekolah untuk akses online.

> **Deployment Target**: **Linux only** — di-deploy di VPS/Dedicated Server berbasis Linux untuk stabilitas, keamanan, dan efisiensi biaya operasional production server.

| Aspek | Spesifikasi |
|-------|-------------|
| **OS Target** | **Linux**: Ubuntu Server 24.04 LTS (recommended), Debian 12+, Rocky Linux 9+ |
| | **Tidak didukung**: Windows Server untuk Siscloud — fokus pada Linux untuk production server |
| **Deployment** | VPS / Dedicated Server (IDCloudHost, AWS EC2, GCP Compute Engine) |
| **Containerization** | Docker + Docker Compose (opsional: Kubernetes untuk skala besar) |
| **Framework** | Next.js (API Routes + SSR Web Dashboard) |
| **Database** | PostgreSQL 16+ (production-grade, multi-tenant) |
| **Storage** | S3-compatible object storage (MinIO self-hosted atau AWS S3 / CloudFlare R2) |
| **Reverse Proxy** | Nginx (SSL termination, rate limiting, static file serving) |
| **Sync Protocol** | WebSocket + delta sync (hanya kirim perubahan) |
| **Multi-Tenancy** | Satu instance Siscloud melayani banyak sekolah |
| **CI/CD** | GitHub Actions → Docker image → deploy ke VPS |

**Fungsi Utama Siscloud:**
- Menerima sync dari App Server sekolah
- Offsite backup (disaster recovery)
- Akses file dari luar sekolah via web
- Multi-tenancy untuk banyak sekolah
- Opsional: direktori drive personal (GDrive) yang sudah dikonfigurasi user

### 3.3 Decision Matrix — Rute Sync

| Mode | Server Lokal | Internet | Tujuan Sync yang Tersedia |
|------|-------------|----------|--------------------------|
| **Pure Offline** | ✅ Tersedia | ❌ Tidak ada | Server lokal saja |
| **Offline + Drive** | ✅ Tersedia | ✅ Ada (parsial) | Server lokal + GDrive/OneDrive personal |
| **Online Hybrid** | ✅ Tersedia | ✅ Ada | Server lokal + GDrive + Siscloud |
| **Cloud Only** | ❌ Tidak ada | ✅ Ada | GDrive + Siscloud (fallback) |

---

## 4. Fase Pengembangan

### Fase 1: Offline Core (MVP) 🎯 PRIORITAS UTAMA

**Tujuan**: Sistem backup berfungsi penuh di lingkungan sekolah tanpa internet.

```
Timeline: 8-12 minggu
```

**Deliverables:**
- [x] App Server dengan web admin dashboard **(Windows + Linux)**
- [x] Client desktop app (Windows) dengan integrasi rclone
- [x] Sync client → server lokal via rclone (SFTP/WebDAV/local)
- [x] Manajemen user & kuota di admin dashboard
- [x] System tray + notifikasi native
- [x] Installer untuk App Server: `.exe` (Windows) + `.deb` (Linux)
- [x] Installer Client: `.exe`/`.msi` (Windows)
- [x] Dokumentasi instalasi untuk operator sekolah (Windows & Linux)

### Fase 2: Personal Drive Integration

**Tujuan**: Client dapat sync ke Google Drive / OneDrive pribadi.

```
Timeline: 4-6 minggu
```

**Deliverables:**
- [x] OAuth integration untuk Google Drive
- [x] OAuth integration untuk Microsoft OneDrive
- [x] UI multi-select tujuan sync di client
- [x] Manajemen rclone config per user untuk multiple remote
- [x] Conflict resolution & deduplication logic

### Fase 3: Cloud Sync (Hybrid Online)

**Tujuan**: App Server dapat sync ke Siscloud, sehingga data dapat diakses dari mana saja.

```
Timeline: 8-10 minggu
```

**Deliverables:**
- [x] Siscloud server deployment
- [x] App Server → Siscloud sync engine (delta/incremental)
- [x] Multi-tenancy di Siscloud
- [x] Web portal untuk akses file via browser
- [x] Enkripsi data saat transit dan at-rest di cloud

### Fase 4: Advanced Features

**Tujuan**: Fitur enterprise dan monetisasi.

```
Timeline: 8-12 minggu (berkelanjutan)
```

**Deliverables:**
- [x] File versioning & point-in-time recovery
- [x] Backup policy engine (jadwal, retention, regex filter)
- [x] Centralized monitoring dashboard
- [x] SaaS subscription model untuk Siscloud
- [x] LDAP / Active Directory integration
- [x] Mobile companion app (read-only access)

### Fase 5: Mobile Companion App

**Tujuan**: Aplikasi mobile read-only untuk monitoring backup dan akses file.

```
Timeline: 8-10 minggu
```

**Deliverables:**
- [ ] Android app (Kotlin/Jetpack Compose)
- [ ] iOS app (Swift/SwiftUI) — opsional
- [ ] Read-only file browser terhubung ke Siscloud
- [ ] Push notification untuk status backup penting
- [ ] Quick share file via link
- [ ] Biometric login (fingerprint/face)

### Fase 6: Desktop App Server (Native Windows) 🖥️

**Tujuan**: Mengubah App Server menjadi aplikasi desktop Windows native dengan installer `.msi`/`.exe` yang bisa diinstal oleh operator sekolah tanpa perlu pengetahuan command line atau Node.js.

```
Timeline: 6-8 minggu
```

**Deliverables:**
- [ ] Desktop App Server → native Windows GUI application
- [ ] Bundled Node.js runtime (tidak perlu install Node.js terpisah)
- [ ] Server management dari system tray (start/stop/restart)
- [ ] GUI untuk konfigurasi server (storage path, network, port, SSL)
- [ ] Built-in web admin dashboard (embedded WebView atau launch browser)
- [ ] Auto-update engine dari file `.msi` lokal atau Siscloud
- [ ] One-click installer `.msi` (WiX Toolset) — tinggal next-next-finish
- [ ] Silent installer untuk deployment massal via Group Policy
- [ ] Integrasi dengan Windows Security Center / Windows Defender Firewall
- [ ] Service watchdog: auto-restart jika crash, kirim notifikasi ke admin

**Tech Stack:**
| Aspek | Spesifikasi |
|-------|-------------|
| **Bahasa** | C# .NET 8 (Windows Forms / WPF) atau C++ (Win32) |
| **Runtime** | .NET 8 Desktop Runtime (di-bundle) atau self-contained exe |
| **Node.js Bundle** | Node.js 20 LTS binary di-bundle dalam installer |
| **Web Server** | Fastify (Node.js) berjalan sebagai child process |
| **UI Framework** | WPF (Windows Presentation Foundation) — native look & feel |
| **System Tray** | Hardcodet NotifyIcon / native Windows Forms tray |
| **Installer** | WiX Toolset v4 — `.msi` + `.exe` bootstrapper |
| **Auto-update** | Squirrel.Windows atau custom update checker |
| **Logging** | Windows Event Log + file log |

**Dependency Runtime (di-bundle dalam installer):**
- .NET 8 Desktop Runtime (jika tidak self-contained)
- Node.js 20 LTS (di-bundle otomatis)
- Microsoft Visual C++ Redistributable 2015-2022 (jika diperlukan oleh native modules)

**System Requirements:**
- Windows 10 22H2 (Build 19045) atau lebih tinggi
- Windows 11 (semua build)
- Windows Server 2019 / 2022
- RAM: minimal 2 GB (4 GB recommended)
- Disk: 500 MB untuk aplikasi + ruang untuk data backup
- .NET 8 Desktop Runtime (otomatis diinstal jika belum ada)
- Microsoft Visual C++ 2015-2022 Redistributable (x64)

**GUI Features:**
```
┌──────────────────────────────────────────────────────┐
│  📦 Sisbackup Server                          ─ □ ✕  │
├──────────────────────────────────────────────────────┤
│  Status Server: 🟢 Running   Uptime: 14d 6h 32m      │
│  Alamat:       http://192.168.1.100:3001              │
│  Storage:      D:\BackupSekolah (234 GB / 500 GB)     │
│                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│  │  45 Guru    │ │  12 Aktif   │ │  Queue: 0   │     │
│  │  Terdaftar  │ │  Syncing    │ │  Pending    │     │
│  └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                      │
│  [Start] [Stop] [Restart]    [Buka Web Admin]        │
│                                                      │
│  ⚙️ Konfigurasi                                     │
│  ┌────────────────────────────────────────────────┐  │
│  │ Storage Path:  [D:\BackupSekolah    ] [Browse] │  │
│  │ Port:          [3001                   ]        │  │
│  │ Auto-start:    [✓] Start saat Windows boot     │  │
│  │ Firewall:      [✓] Allow port di firewall      │  │
│  │ SSL/TLS:       [ ] Enable HTTPS (beta)         │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  📋 Log Aktivitas                                    │
│  │ 10:30 - ana@sman1 - sync selesai (45 file)       │
│  │ 10:28 - budi@sman1 - upload 23 file              │
│  │ 10:25 - Server restart (user request)            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Installer Experience:**
1. User download `Sisbackup-Server-Setup-2.x.0.msi` (atau `.exe` bootstrapper)
2. Double-click → Windows SmartScreen → "Run anyway"
3. Welcome screen → pilih install path (default: `C:\Program Files\Sisbackup Server`)
4. Centang opsi: "Auto-start server after install" (default: yes)
5. Install → Progress bar → Selesai
6. First run wizard:
   - Pilih storage path (drive/folder untuk backup)
   - Buat admin account (username + password)
   - Test koneksi → Selesai
7. System tray icon muncul → server sudah berjalan

### Fase 7: Native Desktop Client (Windows) 💻

**Tujuan**: Membangun ulang client desktop sebagai aplikasi **100% native Windows** tanpa Tauri/Electron, untuk performa maksimal, RAM minimal, dan user experience yang benar-benar familiar untuk pengguna Windows.

> **Perbedaan dengan Fase 1 Client (Tauri v2)**:
> - Fase 1: Tauri v2 (Rust backend + React UI via WebView) — bagus, cross-platform
> - Fase 7: Native WinUI 3 / WPF — zero web tech, full native Windows API, lebih ringan & responsif

```
Timeline: 10-14 minggu
```

**Deliverables:**
- [ ] Native Windows desktop client — tidak ada WebView/Electron dependency
- [ ] WinUI 3 atau WPF untuk UI native Windows 10/11 (fluent design, acrylic, dll.)
- [ ] Integrasi penuh dengan Windows Shell (context menu, file explorer overlay icons)
- [ ] System tray dengan status sync real-time & quick actions
- [ ] Native file/folder picker (Windows IFileDialog)
- [ ] Background sync service (Windows Background Task API)
- [ ] Toast notifications via Windows Action Center
- [ ] Auto-start via Windows Startup atau Task Scheduler
- [ ] One-click installer `.msi` — next-next-finish
- [ ] Silent installer untuk deployment massal lewat Group Policy / Intune
- [ ] rclone binary di-bundle + auto-update
- [ ] Offline mode: sync ke server lokal tetap jalan tanpa internet
- [ ] Drive mounting via WinFsp (opsional: mount remote sebagai drive letter)

**Tech Stack:**
| Aspek | Spesifikasi |
|-------|-------------|
| **Bahasa** | C# .NET 8 |
| **UI Framework** | WinUI 3 (Windows App SDK) — native Win 10/11 |
| **Backup Engine** | C# wrapper untuk rclone (Process invocation + progress parsing) |
| **Background Service** | Windows Background Task API |
| **System Tray** | WinUI 3 + P/Invoke `Shell_NotifyIcon` |
| **Notifications** | Windows App SDK `AppNotificationManager` |
| **File Watching** | `System.IO.FileSystemWatcher` + Windows Change Journal |
| **Installer** | WiX Toolset v4 — `.msi` + `.exe` bootstrapper |
| **Auto-Update** | Custom update checker → download `.msi` → auto-install |
| **Konfigurasi** | Registry (`HKCU\Software\Sisbackup\Client`) + encrypted config file |
| **Login** | Windows Credential Manager untuk menyimpan token |

**System Requirements:**
- **OS**: Windows 10 22H2 (Build 19045) atau lebih tinggi
- **Windows 11**: semua build didukung penuh
- **RAM**: minimal 512 MB (idle), 1 GB saat sync
- **Disk**: 150 MB untuk aplikasi + rclone binary
- **Microsoft Visual C++ 2015-2022 Redistributable (x64)** — di-bundle di installer
- **.NET 8 Desktop Runtime** — di-bundle di installer (self-contained) atau auto-download
- **WinFsp** (opsional) — untuk fitur mount drive

**Dependency yang di-bundle dalam installer `.msi`:**
| Dependency | Size | Keterangan |
|------------|------|------------|
| .NET 8 Runtime | ~55 MB | Self-contained deployment (opsional) |
| VC++ Redist 2015-2022 | ~14 MB | Diperlukan oleh rclone & WinFsp |
| rclone.exe | ~40 MB | Core sync engine |
| WinFsp | ~5 MB | Opsional — untuk drive mounting |

**GUI Features (WinUI 3 — Fluent Design):**
```
┌──────────────────────────────────────────────────────────┐
│  📦 Sisbackup                                     ─ □ ✕  │
├──────────────────────────────────────────────────────────┤
│  👤 Ana Sari (ana@sman1.sch.id)                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 📊 Status Backup                   🔄 Sync Now   │    │
│  │                                                  │    │
│  │ Server Sekolah:  ████████░░  2.3/5 GB (46%)     │    │
│  │ Google Drive:    ██░░░░░░░░  1.1/15 GB (7%)     │    │
│  │                                                  │    │
│  │ Sync Terakhir: 2 menit lalu  ✅ Semua berhasil   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  📁 Folder yang Dibackup                                 │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 📂 D:\Data Guru        ✅ Synced   [⏸] [🗑]     │    │
│  │ 📂 D:\RPP 2026         🔄 45%     [⏸] [🗑]     │    │
│  │ 📂 D:\Nilai Siswa      ⏸ Paused  [▶] [🗑]     │    │
│  │                                    [+ Tambah]    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ☁️ Tujuan Backup                                        │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 🏫 Server Sekolah    🟢 Aktif     [Nonaktifkan]  │    │
│  │ 📗 Google Drive      🟢 Aktif     [Nonaktifkan]  │    │
│  │ 🔵 OneDrive          ⚪ Tidak aktif [Aktifkan]   │    │
│  │                                    [+ Tambah]    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [⚙️ Settings]  [📋 Log]  [❓ Help]  [🔒 Lock]          │
└──────────────────────────────────────────────────────────┘
```

**Native Windows Integration:**
- **Context Menu**: Klik kanan folder di Explorer → "Backup ke Sisbackup" / "Sync sekarang"
- **File Explorer Overlay**: Icon overlay pada folder yang sedang di-backup (✅ hijau / 🔄 biru / ❌ merah)
- **Share Target**: Share file langsung ke Sisbackup dari aplikasi apapun via Windows Share charm
- **Jump List**: Quick access ke folder yang sering di-backup, sync now, pause all
- **Action Center**: Notifikasi terintegrasi dengan Windows Action Center
- **Lock Screen**: Status backup muncul di lock screen (Windows 10/11)



---

## 5. Spesifikasi Fitur Detail

### 5.1 App Server — Web Admin Dashboard

#### 5.1.1 Halaman Login
- **Deskripsi**: Halaman login sederhana untuk admin/operator
- **Credentials**: Username + password (local auth)
- **Default Admin**: Dibuat saat instalasi pertama (wizard-based setup)
- **Rate Limiting**: 5 percobaan gagal → lock 15 menit (brute-force protection)

#### 5.1.2 Dashboard Utama
```
┌────────────────────────────────────────────────────┐
│  📊 Dashboard Sisbackup Server                     │
│                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 45 Guru   │ │ 12 Aktif │ │ 234 GB   │           │
│  │ Terdaftar│ │ Sync Now │ │ Terpakai │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                                                    │
│  Status Server: 🟢 Online   Uptime: 14d 6h         │
│  Storage: ████████░░ 234GB / 500GB (46%)           │
│  Koneksi Client Aktif: 12                          │
│  Backup Terakhir: 2 menit lalu                     │
│                                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Aktivitas Terbaru                            │   │
│  │ 10:30 - ana@sman1.sch.id - upload 45 file   │   │
│  │ 10:28 - budi@sman1.sch.id - sync selesai    │   │
│  │ 10:25 - citra@sman1.sch.id - hapus 3 file   │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

#### 5.1.3 Manajemen User
- **List User**: Tabel semua user terdaftar dengan status dan kuota
- **Tambah User**: Form sederhana (nama, email/username, password awal, kuota)
- **Edit User**: Ubah kuota, reset password, suspend/activate akun
- **Hapus User**: Soft-delete dengan opsi retain data (30 hari) atau hapus permanen
- **Import Massal**: Upload CSV untuk membuat banyak akun sekaligus (berguna untuk sekolah besar)

#### 5.1.4 Monitoring Backup
- **Per User**: Lihat status backup terakhir, ukuran data, file count
- **Log Real-Time**: WebSocket-based live log viewer
- **History**: Riwayat sync per user (timestamp, status, ukuran, file count)

#### 5.1.5 Pengaturan Server
- **Storage Path**: Konfigurasi lokasi penyimpanan di disk
- **Kuota Default**: Kuota default untuk user baru
- **Retention Policy**: Aturan retensi data global
- **Backup Config**: Backup database SQLite ke path tertentu (jadwal)
- **(Fase 2) Cloud Bridge**: Konfigurasi koneksi ke Siscloud

### 5.2 Client Desktop App

#### 5.2.1 Onboarding / Setup Wizard

```
┌────────────────────────────────────────────────┐
│  🚀 Selamat Datang di Sisbackup                │
│                                                │
│  Pilih mode koneksi:                           │
│                                                │
│  ● Saya terhubung ke server sekolah            │
│    Masukkan alamat server: [192.168.1.100]     │
│                                                │
│  ○ Saya ingin menggunakan Drive pribadi        │
│    (Google Drive, OneDrive, dll)               │
│                                                │
│  ○ Keduanya                                    │
│                                                │
│  [Lanjutkan]                                    │
└────────────────────────────────────────────────┘
```

#### 5.2.2 Halaman Utama — My Backup

```
┌────────────────────────────────────────────────────┐
│  📁 Sisbackup - ana@sman1.sch.id                   │
│                                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Folder yang di-backup:                       │   │
│  │                                              │   │
│  │ 📂 D:\Data Guru          ✅ Sinkron (2m lalu) │   │
│  │ 📂 D:\RPP 2026           🔄 Syncing... 45%   │   │
│  │ 📂 D:\Soal Ujian         ⏸ Paused           │   │
│  │                                              │   │
│  │ [+ Tambah Folder]                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Tujuan Backup:                               │   │
│  │                                              │   │
│  │ ☑ Server Sekolah (192.168.1.100)            │   │
│  │    📊 2.3 GB / 5 GB  ──██░░░░░░ 46%         │   │
│  │                                              │   │
│  │ ☑ Google Drive (ana@gmail.com)              │   │
│  │    📊 1.1 GB / 15 GB ──░░░░░░░░ 7%          │   │
│  │                                              │   │
│  │ [+ Tambah Tujuan]                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
│  ⚙️ Pengaturan    🔔 Notifikasi (3)               │
└────────────────────────────────────────────────────┘
```

#### 5.2.3 Fitur Tambah Folder Backup

- **Browse Folder**: GUI file picker
- **Filter Ekstensi**: Opsional — hanya backup file tertentu (misal: `*.docx,*.pdf,*.xlsx`)
- **Exclude Pattern**: Regex pattern untuk mengecualikan file/folder (misal: `node_modules`, `*.tmp`)
- **Jadwal Sync**: 
  - Real-time (watch folder changes)
  - Periodik (setiap N menit/jam)
  - Manual only
- **Retention Lokal**: Hapus file lokal yang sudah di-backup setelah N hari (opsional — hemat disk)

#### 5.2.4 Fitur Tambah Tujuan Backup

- **Server Sekolah**: 
  - Masukkan IP/hostname App Server
  - Login dengan akun yang diberikan admin
  - Koneksi aman via HTTPS (self-signed cert) atau HTTP (opsi untuk jaringan trusted)
  
- **Google Drive**:
  - Klik "Hubungkan Google Drive"
  - Browser-based OAuth flow
  - Pilih folder root di Google Drive (default: `Sisbackup/`)
  
- **OneDrive**:
  - Klik "Hubungkan OneDrive"
  - OAuth flow Microsoft
  - Pilih folder root

- **Multiple Destination**:
  - User dapat mencentang kombinasi tujuan mana saja
  - Sync dilakukan paralel atau berurutan ke setiap tujuan
  - Masing-masing tujuan punya status independen

#### 5.2.5 System Tray & Notifikasi

- **Icon Tray**: Status sync terlihat dari icon (hijau=idle/selesai, biru=syncing, merah=error, abu=paused)
- **Menu Klik Kanan**:
  - Status backup terbaru
  - Buka aplikasi
  - Pause/Resume semua sync
  - Sync sekarang (force)
  - Keluar
- **Notifikasi Toast**:
  - "Backup selesai: 45 file ke Server Sekolah"
  - "Gagal sync ke Google Drive: koneksi timeout"
  - "Konflik terdeteksi pada 3 file"
  - "Kuota hampir penuh (90%)"

#### 5.2.6 Conflict Resolution

```
┌────────────────────────────────────────────────────┐
│  ⚠️ Konflik Terdeteksi                              │
│                                                    │
│  File: RPP Matematika Kelas X.docx                 │
│                                                    │
│  Versi Lokal:    2.4 MB - 10 Jun 2026 14:30       │
│  Versi Remote:   2.2 MB - 10 Jun 2026 09:15       │
│                                                    │
│  ● Timpa remote dengan lokal (upload)              │
│  ○ Unduh remote, timpa lokal                       │
│  ○ Simpan keduanya (rename: ..._conflict.docx)     │
│  ○ Lewati file ini                                 │
│                                                    │
│  ☐ Terapkan untuk semua konflik                    │
│  [Proses]                                          │
└────────────────────────────────────────────────────┘
```

### 5.3 Siscloud — Cloud Portal (Fase 2-3)

#### 5.3.1 School-to-Cloud Sync

- App Server mendaftarkan diri ke Siscloud dengan **School ID** unik
- Admin di App Server mengaktifkan "Cloud Sync" dan memasukkan kredensial Siscloud
- Sync engine di App Server melakukan:
  - **Initial full sync**: Upload semua data yang ada ke cloud
  - **Incremental delta sync**: Hanya upload file yang berubah/ditambah
  - **Two-way sync**: Jika ada file yang diedit via web portal, di-sync kembali ke App Server
- Jika internet putus → antrian sync disimpan lokal, dilanjutkan saat koneksi pulih

#### 5.3.2 Web Portal (Siscloud)

- **Login**: Admin sekolah dan user (guru) bisa login via browser
- **File Browser**: Lihat, download, upload file dari mana saja
- **Sharing**: Share file/folder via link (dengan expiry date opsional)
- **Multi-School Dashboard**: Untuk super-admin melihat status semua sekolah

---

## 6. Model Data

### 6.1 App Server (SQLite)

```sql
-- ============================================
-- Tabel: users
-- ============================================
CREATE TABLE users (
    id              TEXT PRIMARY KEY,          -- UUID
    username        TEXT NOT NULL UNIQUE,      -- email atau username
    password_hash   TEXT NOT NULL,             -- bcrypt hash
    display_name    TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
    quota_bytes     INTEGER NOT NULL DEFAULT 5368709120, -- 5GB default
    used_bytes      INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL,             -- ISO 8601
    updated_at      TEXT NOT NULL
);

-- ============================================
-- Tabel: backup_sources (folder yang di-backup client)
-- ============================================
CREATE TABLE backup_sources (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    client_id       TEXT NOT NULL,             -- ID unik instalasi client
    local_path      TEXT NOT NULL,            -- D:\Data Guru
    include_pattern TEXT,                      -- *.docx,*.pdf (nullable = all)
    exclude_pattern TEXT,                      -- *.tmp,node_modules
    sync_schedule   TEXT NOT NULL DEFAULT 'realtime', -- 'realtime'|'periodic'|'manual'
    sync_interval_m INTEGER,                   -- menit, untuk periodic
    retention_days  INTEGER,                   -- hapus lokal setelah N hari (nullable)
    is_paused       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ============================================
-- Tabel: backup_destinations (tujuan sync per user)
-- ============================================
CREATE TABLE backup_destinations (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    dest_type       TEXT NOT NULL,             -- 'local_server'|'google_drive'|'onedrive'|'siscloud'
    dest_config     TEXT NOT NULL,             -- JSON: rclone config fragment
    dest_label      TEXT NOT NULL,             -- "Server Sekolah" / "GDrive Ana"
    is_enabled      INTEGER NOT NULL DEFAULT 1,
    priority        INTEGER NOT NULL DEFAULT 1, -- urutan sync (1 = pertama)
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ============================================
-- Tabel: sync_logs
-- ============================================
CREATE TABLE sync_logs (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    source_id       TEXT NOT NULL REFERENCES backup_sources(id),
    dest_id         TEXT NOT NULL REFERENCES backup_destinations(id),
    status          TEXT NOT NULL,             -- 'success'|'partial'|'failed'|'conflict'
    files_total     INTEGER NOT NULL DEFAULT 0,
    files_synced    INTEGER NOT NULL DEFAULT 0,
    files_failed    INTEGER NOT NULL DEFAULT 0,
    bytes_transfer  INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    started_at      TEXT NOT NULL,
    completed_at    TEXT
);

-- ============================================
-- Tabel: server_config
-- ============================================
CREATE TABLE server_config (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
-- Config keys: storage_path, default_quota, retention_days, 
--              cloud_enabled, siscloud_url, siscloud_school_id, siscloud_token
```

### 6.2 Siscloud (PostgreSQL — Fase 2+)

```sql
-- ============================================
-- Tabel: schools (multi-tenancy)
-- ============================================
CREATE TABLE schools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name     TEXT NOT NULL,
    school_id       TEXT NOT NULL UNIQUE,       -- kode unik dari App Server
    contact_email   TEXT NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'free', -- 'free'|'basic'|'premium'
    storage_limit_gb INTEGER NOT NULL DEFAULT 50,
    storage_used_gb INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_sync_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Tabel: school_users (mirror dari App Server)
-- ============================================
CREATE TABLE school_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    username        TEXT NOT NULL,
    quota_bytes     BIGINT NOT NULL DEFAULT 5368709120,
    used_bytes      BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(school_id, username)
);

-- ============================================
-- Tabel: sync_journal (track perubahan per file)
-- ============================================
CREATE TABLE sync_journal (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    user_id         UUID NOT NULL REFERENCES school_users(id),
    file_path       TEXT NOT NULL,              -- relative path dari root backup
    operation       TEXT NOT NULL,              -- 'create'|'update'|'delete'
    file_size       BIGINT,
    file_hash       TEXT,                       -- SHA-256
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7. Keamanan

### 7.1 Offline Mode (App Server)

| Aspek | Implementasi |
|-------|-------------|
| **Authentication** | JWT dengan expiry 24 jam; refresh token di HTTP-only cookie |
| **Password Storage** | bcrypt (cost factor 12) |
| **Data in Transit** | HTTPS/TLS antara client dan server (self-signed cert untuk LAN) |
| **Data at Rest** | Opsional: AES-256-GCM enkripsi file sebelum disimpan di storage server |
| **Isolasi Data** | Setiap user hanya dapat mengakses direktorinya sendiri di storage |
| **API Security** | Rate limiting, input validation (Zod), CORS restricted ke LAN subnet |
| **Audit Trail** | Semua operasi CRUD di-log dengan timestamp dan IP |

### 7.2 Cloud Mode (Siscloud)

| Aspek | Implementasi |
|-------|-------------|
| **Authentication** | OAuth 2.0 + JWT; support SSO (Google/Microsoft) |
| **Data in Transit** | TLS 1.3 mandatory |
| **Data at Rest** | Enkripsi server-side (AES-256); opsional client-side encryption key |
| **API Security** | API key untuk App Server → Siscloud; rate limiting per tenant |
| **OAuth Tokens** | Refresh token disimpan terenkripsi di database; access token hanya di memori |
| **GDPR/Privacy** | Data sekolah diisolasi per tenant; right-to-deletion support |

### 7.3 Enkripsi End-to-End (Future)

- **Client-side encryption**: File dienkripsi di client SEBELUM upload
- **Zero-knowledge**: Server tidak dapat membaca isi file
- **Key management**: Encryption key derived dari password user (PBKDF2) + recovery key

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metric | Target |
|--------|--------|
| **App Server boot time** | < 5 detik |
| **Client app cold start** | < 3 detik |
| **Memory usage (App Server idle)** | < 200 MB RAM |
| **Memory usage (Client idle)** | < 100 MB RAM |
| **Sync throughput (LAN)** | > 50 MB/s (tergantung disk I/O) |
| **Max concurrent client connections** | 100 (App Server) |
| **Database query latency** | < 50ms (p95) |

### 8.2 Reliability

| Metric | Target |
|--------|--------|
| **Uptime App Server** | 99.9% (saat server menyala) |
| **Data consistency** | Checksum verification setelah setiap sync |
| **Crash recovery** | Resume sync dari titik terakhir setelah restart |
| **Network resilience** | Auto-retry dengan exponential backoff (3x, lalu skip) |
| **Disk full handling** | Peringatan dini di 80% dan 90%; auto-pause sync di 95% |

### 8.3 Usability

| Metric | Target |
|--------|--------|
| **Wizard setup (client)** | < 3 langkah, < 2 menit |
| **Wizard setup (server)** | < 5 langkah, < 10 menit (termasuk konfigurasi storage) |
| **Menambah folder backup** | < 5 klik |
| **Menambah tujuan sync** | < 5 klik |
| **Bahasa** | Indonesia (default), English (opsional) |

### 8.4 Compatibility

| Komponen | Support |
|----------|---------|
| **Client OS (Fase 1-4)** | Windows 10 22H2+, Windows 11 |
| **Client OS (Fase 7 Native)** | Windows 10 22H2+ (Build 19045), Windows 11 (semua build) |
| **App Server OS (Lokal)** | **Windows**: Windows Server 2019/2022, Windows 10 22H2+, Windows 11 |
| | **Linux**: Ubuntu Server 22.04/24.04 LTS, Debian 12+ |
| **Siscloud OS (Production)** | **Linux only**: Ubuntu Server 24.04 LTS (recommended), Debian 12+, Rocky Linux 9+ |
| **Browser (Web Admin)** | Chrome 90+, Firefox 90+, Edge 90+ |
| **Network** | IPv4 LAN, WiFi, Ethernet |
| **Storage Backend (rclone)** | Local, SFTP, WebDAV, Google Drive, OneDrive, S3, +36 lainnya |

### 8.5 Minimum System Requirements (Windows)

| Komponen | Minimum | Recommended |
|----------|---------|-------------|
| **OS** | Windows 10 22H2 (Build 19045) | Windows 11 23H2+ |
| **RAM (App Server)** | 2 GB | 4 GB+ |
| **RAM (Client)** | 512 MB (idle) | 1 GB+ |
| **Disk (App Server)** | 500 MB app + storage data | 1 GB app + storage data |
| **Disk (Client)** | 150 MB app + rclone | 250 MB |
| **.NET Runtime** | .NET 8 Desktop Runtime (di-bundle) | Self-contained (no external dep) |
| **VC++ Redist** | Visual C++ 2015-2022 Redist (x64) | Di-bundle di installer |
| **WinFsp** | Opsional — untuk drive mounting | v2.0+ |
| **Network** | Ethernet 100 Mbps / WiFi | Gigabit Ethernet |

### 8.6 Matriks Dukungan OS

| Komponen | Windows | Linux | Alasan |
|----------|---------|-------|--------|
| **Client Desktop (Fase 1)** | ✅ Tauri v2 | 🔄 Future | Mayoritas guru pakai Windows |
| **Client Desktop (Fase 7)** | ✅ WinUI 3 Native | ❌ | Native Windows-only untuk UX maksimal |
| **App Server (lokal)** | ✅ Primary | ✅ Primary | Dual first-class |
| **Desktop App Server (Fase 6)** | ✅ WPF/.NET 8 | ❌ | Khusus Windows untuk kemudahan operator |
| **Siscloud (cloud)** | ❌ | ✅ Exclusive | Production server → Linux |
| **Web Admin UI** | ✅ Browser | ✅ Browser | Cross-platform via browser |

---

## 9. Roadmap & Milestones

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ROADMAP SISBACKUP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  2026 Q3                     2026 Q4                     2027 Q1            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ FASE 1: OFFLINE   │  │ FASE 2: PERSONAL  │  │ FASE 3: HYBRID   │           │
│  │       CORE ✅      │  │      DRIVE ✅      │  │      ONLINE ✅    │           │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤           │
│  │ M1: App Server   │  │ M5: GDrive OAuth │  │ M8: Siscloud     │           │
│  │   • API & Auth   │  │   integration    │  │   • Linux VPS    │           │
│  │   • Web Admin    │  │                  │  │   • Multi-tenant │           │
│  │   • Win & Linux  │  │ M6: OneDrive     │  │   • Sync engine  │           │
│  │                  │  │   OAuth integ.   │  │                  │           │
│  │ M2: Client App   │  │                  │  │ M9: Web Portal   │           │
│  │   • Tauri v2     │  │ M7: Multi-dest   │  │   • File browser │           │
│  │   • rclone integ │  │   UI & logic     │  │   • Sharing      │           │
│  │                  │  │                  │  │                  │           │
│  │ M3: Sync Engine  │  │   Conflict       │  │ M10: Cloud       │           │
│  │   • LAN sync     │  │   Resolution     │  │   Bridge sync    │           │
│  │   • Real-time    │  │   Engine         │  │   engine         │           │
│  │                  │  │                  │  │                  │           │
│  │ M4: Installer    │  │                  │  │                  │           │
│  │   • EXE & DEB    │  │                  │  │                  │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                             │
│  2027 Q2                     2027 Q3-Q4                2028 Q1-Q2           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ FASE 4: ADVANCED  │  │ FASE 5: MOBILE    │  │ FASE 6: DESKTOP   │           │
│  │       ✅           │  │                   │  │    APP SERVER 🖥️  │           │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤           │
│  │ • File versioning│  │ • Android app     │  │ • Native Windows  │           │
│  │ • Backup policy  │  │ • iOS app (ops)   │  │   GUI (WPF/C#)    │           │
│  │ • SaaS monetize  │  │ • Push notif      │  │ • .msi installer  │           │
│  │ • Central monitor│  │ • Biometric login │  │ • Bundled Node.js │           │
│  │ • LDAP/AD integ  │  │ • Quick share     │  │ • System tray mgr │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                             │
│  2028 Q3-Q4                                                        Future  │
│  ┌──────────────────────┐  ┌──────────────────────┐                          │
│  │ FASE 7: NATIVE        │  │ BEYOND               │                          │
│  │   CLIENT (WinUI 3) 💻 │  │                      │                          │
│  ├──────────────────────┤  ├──────────────────────┤                          │
│  │ • 100% native C#     │  │ • E2E encryption     │                          │
│  │ • WinUI 3 Fluent UI  │  │ • AI dedup           │                          │
│  │ • Shell integration  │  │ • Ransomware detect  │                          │
│  │ • Context menu ext   │  │ • Blockchain verify  │                          │
│  │ • File overlay icons │  │ • Multi-school SaaS  │                          │
│  │ • Win Action Center  │  │ • ISO 27001 cert     │                          │
│  └──────────────────────┘  └──────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Tech Stack Summary

| Layer | Fase 1 (Offline) | Fase 3 (Cloud) |
|-------|-----------------|----------------|
| **App Server OS** | Windows 10+/Server 2019+ & Ubuntu 22.04+ | — (dikelola App Server lokal) |
| **Siscloud OS** | — | Linux (Ubuntu 24.04 LTS) via Docker |
| **App Server Backend** | Node.js + Fastify | Next.js API Routes |
| **App Server DB** | SQLite (better-sqlite3) | PostgreSQL + Prisma |
| **App Server UI** | React + Vite + Tailwind + Shadcn | Next.js + Tailwind + Shadcn |
| **Client Desktop** | Tauri v2 (Rust + React) | Tauri v2 (Rust + React) |
| **Client OS** | Windows 10/11 | Windows 10/11 |
| **Sync Engine** | rclone (bundled binary) | rclone + custom delta sync |
| **Real-time Comms** | WebSocket (ws) | WebSocket + Server-Sent Events |
| **Auth** | JWT (jsonwebtoken) + bcrypt | NextAuth.js + OAuth providers |
| **Cloud Storage** | — | MinIO / AWS S3 / CloudFlare R2 |
| **CI/CD** | GitHub Actions | GitHub Actions + Docker |

## Appendix B: Installer & Deployment Strategy

### App Server Deployment

#### Windows (Primary)
1. Operator menjalankan `Sisbackup-Server-Setup.exe` (NSIS/Inno Setup installer)
2. Wizard memandu: pilih storage path (misal `D:\BackupSekolah`), buat admin account, konfigurasi network
3. Server otomatis terdaftar sebagai **Windows Service** — auto-start saat boot, restart jika crash
4. Web admin dapat diakses via `http://[server-ip]:3000` dari jaringan lokal
5. Shortcut desktop & Start Menu otomatis dibuat untuk akses cepat Web Admin

#### Linux (Untuk Operator Mahir)
1. Tersedia paket `.deb` (Ubuntu/Debian) dan script instalasi `install.sh`
2. Instalasi via terminal:
   ```bash
   curl -fsSL https://sisbackup.com/install-server.sh | bash
   # atau untuk offline:
   sudo dpkg -i sisbackup-server_2.0.0_amd64.deb
   ```
3. Wizard konfigurasi via terminal (NCurses-based) atau file `.env`:
   - Storage path (default: `/var/lib/sisbackup/data`)
   - Admin credentials
   - Network bind address & port
4. Server auto-register sebagai **systemd service** (`sisbackup-server.service`):
   ```bash
   sudo systemctl enable --now sisbackup-server
   sudo systemctl status sisbackup-server
   ```
5. Web admin diakses via `http://[server-ip]:3000`

### Client Deployment
1. Operator menginstal via `Sisbackup-Client-Setup.exe` di setiap komputer guru
2. Atau: deploy via Group Policy (Windows domain) — MSI silent install
3. Pre-configure server address via registry key atau config file

### Update Strategy
- **App Server (Windows)**: Notifikasi update via Web Admin → download installer baru → in-place upgrade (data dipertahankan)
- **App Server (Linux)**: `sudo apt upgrade sisbackup-server` atau auto-update via systemd timer
- **Client**: Auto-update binary dari App Server di jaringan lokal (tanpa perlu internet)
- **rclone binary**: Di-bundle dan di-update bersama client/server

## Appendix C: Perbedaan dengan PRD v1.0

| Aspek | PRD v1.0 | PRD v2.0 |
|-------|---------|---------|
| **Fokus** | SaaS-first, cloud-only | Offline-first, hybrid-ready |
| **Arsitektur** | Web portal + desktop client → Google Drive | App Server + Client + Opsional Cloud |
| **Target Pengguna** | Individual user (B2C SaaS) | Sekolah (B2B/B2G institutional) |
| **Tujuan Sync** | Hanya Google Drive (Siscloud) | Server lokal, GDrive, OneDrive, kombinasi |
| **Offline Capability** | Tidak ada | Full offline operation |
| **Deployment** | Cloud-only | On-premise + cloud hybrid |
| **Monetisasi** | SaaS subscription (individu) | Freemium cloud sync + enterprise features |
| **Database** | PostgreSQL (cloud) | SQLite (offline) → PostgreSQL (cloud) |

---

> **Status Dokumen**: Final Draft  
> **Versi**: 2.0  
> **Tanggal**: 12 Juni 2026  
> **Next Review**: Setelah Fase 1 selesai (Q3 2026)
