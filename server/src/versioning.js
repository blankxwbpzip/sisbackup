/**
 * File Versioning & Point-in-Time Recovery
 *
 * Setiap kali file di-sync, versi sebelumnya disimpan.
 * User dapat me-restore versi file dari titik waktu tertentu.
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { db, getConfig } = require('./db');

// ─── Versions Table ───────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS file_versions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    version INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, file_path, version)
  );

  CREATE INDEX IF NOT EXISTS idx_file_versions_lookup
    ON file_versions(user_id, file_path);

  CREATE TABLE IF NOT EXISTS version_policy (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_versions INTEGER NOT NULL DEFAULT 10,
    max_age_days INTEGER NOT NULL DEFAULT 90,
    min_keep INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id)
  );
`);

// ─── Save a version ───────────────────────────────────────

function saveVersion(userId, filePath, buffer, sourcePath = null) {
  const versionsDir = path.join(
    getConfig('storage_path') || path.join(__dirname, '..', 'data', 'backups'),
    userId, '.versions', path.dirname(filePath)
  );
  fs.ensureDirSync(versionsDir);

  // Determine next version number
  const latest = db.prepare(
    'SELECT MAX(version) as maxVer FROM file_versions WHERE user_id = ? AND file_path = ?'
  ).get(userId, filePath);

  const version = (latest?.maxVer || 0) + 1;
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const versionFileName = `${path.basename(filePath)}.v${version}`;
  const versionPath = path.join(versionsDir, versionFileName);

  // Write version file
  fs.writeFileSync(versionPath, buffer);

  // Record in DB
  const { v4: uuid } = require('uuid');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO file_versions (id, user_id, file_path, version, file_size, file_hash, storage_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuid(), userId, filePath, version, buffer.length, hash, versionPath, now);

  // Enforce version policy
  enforceVersionPolicy(userId);

  return { version, hash, path: versionPath };
}

// ─── Get versions for a file ──────────────────────────────

function getVersions(userId, filePath) {
  return db.prepare(`
    SELECT id, version, file_size, file_hash, created_at
    FROM file_versions
    WHERE user_id = ? AND file_path = ?
    ORDER BY version DESC
  `).all(userId, filePath);
}

// ─── Restore a specific version ───────────────────────────

function restoreVersion(userId, filePath, version, targetPath = null) {
  const versionRecord = db.prepare(
    'SELECT * FROM file_versions WHERE user_id = ? AND file_path = ? AND version = ?'
  ).get(userId, filePath, version);

  if (!versionRecord) {
    throw new Error(`Version ${version} not found for ${filePath}`);
  }

  const sourcePath = versionRecord.storage_path;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Version file missing: ${sourcePath}`);
  }

  const destPath = targetPath || path.join(
    getConfig('storage_path') || path.join(__dirname, '..', 'data', 'backups'),
    userId, filePath
  );

  fs.ensureDirSync(path.dirname(destPath));
  fs.copyFileSync(sourcePath, destPath);

  return {
    restoredFrom: version,
    restoredTo: destPath,
    size: versionRecord.file_size,
    hash: versionRecord.file_hash,
  };
}

// ─── Delete old versions ──────────────────────────────────

function deleteVersion(userId, filePath, version) {
  const record = db.prepare(
    'SELECT * FROM file_versions WHERE user_id = ? AND file_path = ? AND version = ?'
  ).get(userId, filePath, version);

  if (record && fs.existsSync(record.storage_path)) {
    fs.removeSync(record.storage_path);
  }

  db.prepare(
    'DELETE FROM file_versions WHERE user_id = ? AND file_path = ? AND version = ?'
  ).run(userId, filePath, version);
}

// ─── Enforce version policy ───────────────────────────────

function enforceVersionPolicy(userId) {
  const policy = getVersionPolicy(userId);

  const files = db.prepare(`
    SELECT file_path, COUNT(*) as count
    FROM file_versions
    WHERE user_id = ?
    GROUP BY file_path
    HAVING count > ?
  `).all(userId, policy.maxVersions);

  for (const file of files) {
    // Delete oldest versions exceeding max
    const oldVersions = db.prepare(`
      SELECT * FROM file_versions
      WHERE user_id = ? AND file_path = ?
      ORDER BY version ASC
      LIMIT ?
    `).all(userId, file.file_path, file.count - policy.maxVersions + policy.minKeep);

    for (const v of oldVersions) {
      deleteVersion(userId, v.file_path, v.version);
    }
  }

  // Delete versions older than max_age_days
  const cutoffDate = new Date(Date.now() - policy.maxAgeDays * 86400 * 1000).toISOString();
  const expiredVersions = db.prepare(`
    SELECT * FROM file_versions
    WHERE user_id = ? AND created_at < ?
    ORDER BY created_at ASC
  `).all(userId, cutoffDate);

  let kept = 0;
  for (const v of expiredVersions) {
    if (kept < policy.minKeep) {
      kept++;
      continue; // Keep minimum versions
    }
    deleteVersion(userId, v.file_path, v.version);
  }
}

function getVersionPolicy(userId) {
  let policy = db.prepare('SELECT * FROM version_policy WHERE user_id = ?').get(userId);
  if (!policy) {
    // Insert defaults
    const { v4: uuid } = require('uuid');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO version_policy (id, user_id, max_versions, max_age_days, min_keep, created_at, updated_at)
      VALUES (?, ?, 10, 90, 3, ?, ?)
    `).run(uuid(), userId, now, now);
    policy = { maxVersions: 10, maxAgeDays: 90, minKeep: 3 };
  }
  return policy;
}

function setVersionPolicy(userId, { maxVersions, maxAgeDays, minKeep }) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO version_policy (id, user_id, max_versions, max_age_days, min_keep, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      max_versions = excluded.max_versions,
      max_age_days = excluded.max_age_days,
      min_keep = excluded.min_keep,
      updated_at = excluded.updated_at
  `).run(
    require('uuid').v4(), userId,
    maxVersions ?? 10, maxAgeDays ?? 90, minKeep ?? 3,
    now, now
  );
}

module.exports = {
  saveVersion,
  getVersions,
  restoreVersion,
  deleteVersion,
  getVersionPolicy,
  setVersionPolicy,
  enforceVersionPolicy,
};
