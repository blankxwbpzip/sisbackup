# 📦 Sisbackup

**Sistem Backup Sekolah — Offline-First, Hybrid-Ready**

Sisbackup adalah sistem backup data untuk sekolah yang berjalan di jaringan lokal (offline) dengan opsi sinkronisasi ke cloud. Dirancang agar guru dan operator sekolah dapat mem-backup data penting dengan mudah, aman, dan otomatis.

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
     │  (Fase 2: Online)
     ▼
  Siscloud (Cloud)
```

## 📁 Struktur Proyek

```
sisbackup/
├── server/           # App Server (Node.js + Fastify + React admin)
│   ├── src/          # Backend: API, Auth, WebSocket, Database
│   └── web/          # Frontend: React + Vite admin dashboard
├── client/           # Desktop Client (Tauri v2 + React)
│   ├── src/          # React UI components
│   └── src-tauri/    # Rust backend, rclone integration, system tray
├── docs/             # Dokumentasi instalasi & penggunaan
└── prd.md            # Product Requirements Document
```

## 🚀 Quick Start

### Prasyarat

- **App Server**: Node.js 20+, Windows 10+/Windows Server 2019+ atau Ubuntu 22.04+
- **Client**: Windows 10 22H2+ atau Windows 11
- **Storage**: Minimal 10GB ruang kosong untuk testing

### App Server

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

### Client Desktop

```bash
cd client
npm install
npm run tauri dev
# Aplikasi desktop akan terbuka
```

## 🔧 Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| App Server | Node.js, Fastify, SQLite, WebSocket |
| Admin UI | React, Vite, Tailwind CSS |
| Desktop Client | Tauri v2, Rust, React, rclone |
| Sync Engine | rclone (40+ backend) |
| Cloud (Fase 2) | Next.js, PostgreSQL, MinIO/S3 |

## 📋 Fase Pengembangan

| Fase | Status | Deskripsi |
|------|--------|-----------|
| **Fase 1** | 🚧 In Progress | Offline Core: App Server + Client + LAN Sync |
| **Fase 2** | 📅 Planned | Personal Drive Integration (GDrive, OneDrive) |
| **Fase 3** | 📅 Planned | Cloud Sync: Siscloud + Hybrid Online |
| **Fase 4** | 📅 Planned | Advanced: Versioning, LDAP, Mobile App |

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

## 📄 Lisensi

Copyright © 2026 Sisbackup. Internal use only.

---

> **Status**: Fase 1 — MVP Development
> **Branch**: `dev`
