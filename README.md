# 📦 Sisbackup

**Sistem Backup Sekolah — Offline-First, Hybrid-Ready**

Sisbackup adalah sistem backup data untuk sekolah yang berjalan di jaringan lokal (offline) dengan opsi sinkronisasi ke cloud. Dirancang agar guru dan operator sekolah dapat mem-backup data penting dengan mudah, aman, dan otomatis.

---

## 📋 System Requirements

### Minimum (Windows)

| Komponen | App Server | Desktop Client |
|----------|-----------|----------------|
| **OS** | Windows 10 22H2 (Build 19045) atau lebih tinggi | Windows 10 22H2 (Build 19045) atau lebih tinggi |
| **OS (Server)** | Windows Server 2019 / 2022 | — |
| **RAM** | 2 GB (4 GB recommended) | 512 MB idle / 1 GB saat sync |
| **Disk** | 500 MB app + storage backup | 150 MB app + rclone (~40 MB) |
| **CPU** | x64, 1.5 GHz dual-core | x64, 1 GHz |

### Required Dependencies (Windows)

Dependency berikut **di-bundle otomatis** dalam installer `.msi` / `.exe` — Anda tidak perlu install manual:

| Dependency | Diperlukan Oleh | Size | Keterangan |
|------------|----------------|------|------------|
| **Microsoft Visual C++ 2015-2022 Redistributable (x64)** | rclone, native Node.js modules, WinFsp | ~14 MB | Wajib — di-bundle di installer |
| **.NET 8 Desktop Runtime (x64)** | Desktop App Server (Fase 6), Native Client (Fase 7) | ~55 MB | Di-bundle (self-contained) atau auto-download |
| **Node.js 20 LTS** | App Server | ~30 MB | Hanya untuk mode development; di-bundle di Fase 6 installer |
| **WinFsp** | Fitur mount drive (opsional) | ~5 MB | Opsional — untuk mounting cloud storage sebagai drive letter |

> **Catatan**: Windows 10 versi di bawah Build 19045 (termasuk Windows 10 1507-19044, Windows 8.1, Windows 7) **tidak didukung**. Minimal Windows 10 22H2 atau Windows 11. Windows 10 LTSC 2021 (Build 19044) dapat berfungsi tetapi tidak diuji secara resmi.

### Linux (App Server)

| Komponen | Minimum |
|----------|---------|
| **OS** | Ubuntu Server 22.04 / 24.04 LTS, Debian 12+ |
| **RAM** | 1 GB (2 GB recommended) |
| **Node.js** | v20 LTS |
| **Disk** | 500 MB app + storage backup |

---

## 🏗️ Arsitektur

```
App Server (On-Premise)  ←→  Client Desktop (Guru)
     │                            │
     │  LAN Sekolah               │  Multi-tujuan sync:
     │                            ├─ Server Sekolah (LAN)
     ▼                            ├─ Google Drive (personal)
  Storage                        └─ OneDrive (personal)
  (NAS/Local)
     │
     │  (Fase 3: Online)
     ▼
  Siscloud (Cloud)
```

## 📁 Struktur Proyek

```
sisbackup/
├── server/           # App Server (Node.js + Fastify + React admin)
│   ├── src/          # Backend: API, Auth, WebSocket, Database, OAuth
│   │   ├── routes/   # API routes (auth, users, sync, config, stats, oauth, rclone)
│   │   ├── oauth.js  # Google & Microsoft OAuth handler
│   │   ├── cloud-bridge.js  # Sync engine ke Siscloud
│   │   ├── versioning.js    # File versioning & recovery
│   │   ├── policy-engine.js # Backup policy & retention
│   │   ├── ldap.js   # Active Directory / LDAP integration
│   │   └── saas.js   # Subscription management
│   └── web/          # React + Vite admin dashboard
├── client/           # Desktop Client (Tauri v2 + React)
│   ├── src/          # React UI (Fase 1-2)
│   └── src-tauri/    # Rust backend, rclone, system tray
├── siscloud/         # Cloud server (Next.js + PostgreSQL + Docker)
│   ├── src/app/api/  # Sync API, health check
│   ├── src/lib/      # Auth, storage (S3/MinIO), Prisma
│   └── prisma/       # Database schema
├── docs/             # Dokumentasi instalasi & penggunaan
└── prd.md            # Product Requirements Document
```

## 🚀 Quick Start

### Prasyarat

- **Windows 10 22H2+** atau Windows 11 (client & app server)
- **Linux Ubuntu 22.04+** (opsional untuk app server)
- **Node.js 20+** (untuk development / App Server Fase 1-4)
- **Rust** (untuk build Tauri client)
- **Storage**: Minimal 10GB ruang kosong untuk testing

### App Server (Fase 1-4)

```bash
cd server
npm install
npm run db:init
npm run dev
# Server berjalan di http://localhost:3001
# Buka http://localhost:3001 di browser
# Setup admin account di halaman setup
```

Untuk membangun web admin dashboard:

```bash
cd server/web
npm install
npm run build
# File hasil build di server/web/dist/
# App Server otomatis serve static files dari dist/
```

### Client Desktop (Tauri v2 — Fase 1-2)

```bash
cd client
npm install
npm run tauri dev
# Aplikasi desktop akan terbuka
```

### Siscloud (Fase 3)

```bash
cd siscloud
npm install
npx prisma generate
npm run dev
# Server cloud berjalan di http://localhost:3000
```

Docker:
```bash
cd siscloud
docker build -t siscloud .
docker run -p 3000:3000 --env-file .env siscloud
```

## 🔧 Tech Stack

| Komponen | Fase 1-4 | Fase 6-7 (Native Windows) |
|----------|----------|--------------------------|
| App Server | Node.js, Fastify, SQLite | C# .NET 8 WPF + bundled Node.js |
| Admin UI | React, Vite, Tailwind | Embedded WebView2 |
| Desktop Client | Tauri v2, Rust, React | C# .NET 8 WinUI 3 (100% native) |
| Sync Engine | rclone (40+ backend) | rclone (via C# Process wrapper) |
| Cloud | Next.js, PostgreSQL, MinIO/S3 | Same |
| Installer | Manual / script | WiX Toolset `.msi` / `.exe` |

## 📋 Fase Pengembangan

| Fase | Status | Deskripsi |
|------|--------|-----------|
| **Fase 1** | ✅ Complete | Offline Core: App Server + Client + LAN Sync |
| **Fase 2** | ✅ Complete | Personal Drive: Google OAuth, OneDrive OAuth, Conflict Resolution |
| **Fase 3** | ✅ Complete | Cloud Sync: Siscloud server + Cloud Bridge |
| **Fase 4** | ✅ Complete | Advanced: Versioning, Policy Engine, LDAP, SaaS |
| **Fase 5** | 📅 Planned | Mobile Companion App (Android/iOS) |
| **Fase 6** | 📅 Planned | 🖥️ Desktop App Server (Native Windows `.msi`) |
| **Fase 7** | 📅 Planned | 💻 Native Desktop Client (WinUI 3, 100% C#) |

## 📖 Dokumentasi

- [PRD (Product Requirements Document)](prd.md)
- [Panduan Instalasi](docs/install.md)

## 🏫 Target Pengguna

- **Guru**: Backup otomatis file pembelajaran (RPP, soal, nilai)
- **Operator Sekolah**: Mengelola server backup, user, dan kuota
- **Kepala Sekolah**: Laporan status backup

## 🔒 Keamanan

- JWT authentication dengan expiry 24 jam
- bcrypt password hashing (cost 12)
- Data isolasi per user
- HTTPS/TLS untuk komunikasi client-server
- Rate limiting & input validation
- Opsional: AES-256 enkripsi data at-rest
- Encrypted OAuth token storage
- API Key auth untuk App Server → Siscloud

## 📄 Lisensi

Copyright © 2026 Sisbackup. Internal use only.

---

> **Status**: Fase 1-4 Complete | **Fase 5-7 Planned**
> **Branch**: `dev`
> **Repo**: https://github.com/blankxwbpzip/sisbackup
