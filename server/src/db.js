const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sisbackup.db');

// Ensure data directory exists
fs.ensureDirSync(path.dirname(DB_PATH));

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      quota_bytes INTEGER NOT NULL DEFAULT 5368709120,
      used_bytes INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      local_path TEXT NOT NULL,
      include_pattern TEXT,
      exclude_pattern TEXT,
      sync_schedule TEXT NOT NULL DEFAULT 'realtime',
      sync_interval_m INTEGER,
      retention_days INTEGER,
      is_paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_destinations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dest_type TEXT NOT NULL,
      dest_config TEXT NOT NULL,
      dest_label TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES backup_sources(id) ON DELETE CASCADE,
      dest_id TEXT NOT NULL REFERENCES backup_destinations(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      files_total INTEGER NOT NULL DEFAULT 0,
      files_synced INTEGER NOT NULL DEFAULT 0,
      files_failed INTEGER NOT NULL DEFAULT 0,
      bytes_transfer INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS server_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Insert default configs
  const defaults = {
    storage_path: path.join(__dirname, '..', 'data', 'backups'),
    default_quota: String(5 * 1024 * 1024 * 1024), // 5GB
    retention_days: '0',
    cloud_enabled: 'false',
    siscloud_url: '',
    siscloud_school_id: '',
    siscloud_token: '',
  };

  const now = new Date().toISOString();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO server_config (key, value, updated_at) VALUES (?, ?, ?)'
  );
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value, now);
  }

  // Ensure storage directory exists
  const storagePath = db.prepare(
    "SELECT value FROM server_config WHERE key = 'storage_path'"
  ).get().value;
  fs.ensureDirSync(storagePath);

  console.log('[DB] Database initialized:', DB_PATH);
  console.log('[DB] Storage path:', storagePath);
}

// ─── User helpers ─────────────────────────────────────────

function createUser({ username, passwordHash, displayName, role = 'user', quotaBytes = 5 * 1024 * 1024 * 1024 }) {
  const { v4: uuid } = require('uuid');
  const now = new Date().toISOString();
  const stmt = db.prepare(
    'INSERT INTO users (id, username, password_hash, display_name, role, quota_bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  return stmt.run(uuid(), username, passwordHash, displayName, role, quotaBytes, now, now);
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getAllUsers() {
  return db.prepare('SELECT id, username, display_name, role, quota_bytes, used_bytes, is_active, created_at, updated_at FROM users ORDER BY created_at DESC').all();
}

function updateUserQuota(id, quotaBytes) {
  const now = new Date().toISOString();
  return db.prepare('UPDATE users SET quota_bytes = ?, updated_at = ? WHERE id = ?').run(quotaBytes, now, id);
}

function updateUserStatus(id, isActive) {
  const now = new Date().toISOString();
  return db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now, id);
}

function updateUserPassword(id, passwordHash) {
  const now = new Date().toISOString();
  return db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, id);
}

function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function getStats() {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
  const totalUsedBytes = db.prepare('SELECT COALESCE(SUM(used_bytes), 0) as total FROM users').get().total;
  const recentSyncs = db.prepare(
    "SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 20"
  ).all();
  const storagePath = db.prepare("SELECT value FROM server_config WHERE key = 'storage_path'").get().value;
  return { totalUsers, activeUsers, totalUsedBytes, recentSyncs, storagePath };
}

// ─── Config helpers ────────────────────────────────────────

function getConfig(key) {
  const row = db.prepare('SELECT value FROM server_config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  const now = new Date().toISOString();
  return db.prepare(
    'INSERT INTO server_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, now);
}

function getAllConfig() {
  return db.prepare('SELECT key, value, updated_at FROM server_config').all();
}

module.exports = {
  db,
  initialize,
  createUser,
  getUserByUsername,
  getUserById,
  getAllUsers,
  updateUserQuota,
  updateUserStatus,
  updateUserPassword,
  deleteUser,
  getStats,
  getConfig,
  setConfig,
  getAllConfig,
};
