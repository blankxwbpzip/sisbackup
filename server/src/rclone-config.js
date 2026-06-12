/**
 * rclone config manager
 * Builds and manages rclone configuration for multiple remotes per user.
 */

const path = require('path');
const fs = require('fs-extra');
const { db, getConfig } = require('./db');
const { getToken } = require('./oauth');

// Ensure rclone_configs table
db.exec(`
  CREATE TABLE IF NOT EXISTS rclone_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remote_name TEXT NOT NULL,
    remote_type TEXT NOT NULL,
    remote_config TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, remote_name)
  );
`);

/**
 * Build complete rclone config for a user with all their active remotes
 */
function buildUserRcloneConfig(userId) {
  const rows = db.prepare(
    'SELECT * FROM rclone_configs WHERE user_id = ? AND is_active = 1'
  ).all(userId);

  const config = {};

  for (const row of rows) {
    const remoteConfig = JSON.parse(row.remote_config);
    config[row.remote_name] = {
      type: remoteConfig.type,
      ...remoteConfig,
    };
  }

  return config;
}

/**
 * Generate rclone.conf file content
 */
function generateRcloneConf(userId) {
  const userConfig = buildUserRcloneConfig(userId);
  let confText = '';

  for (const [remoteName, config] of Object.entries(userConfig)) {
    confText += `[${remoteName}]\n`;
    for (const [key, value] of Object.entries(config)) {
      confText += `${key} = ${value}\n`;
    }
    confText += '\n';
  }

  return confText;
}

/**
 * Add or update a remote for a user
 */
function saveRemoteConfig(userId, remoteName, remoteType, remoteConfig) {
  const { v4: uuid } = require('uuid');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO rclone_configs (id, user_id, remote_name, remote_type, remote_config, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(user_id, remote_name) DO UPDATE SET
      remote_type = excluded.remote_type,
      remote_config = excluded.remote_config,
      updated_at = excluded.updated_at
  `).run(uuid(), userId, remoteName, remoteType, JSON.stringify(remoteConfig), now, now);
}

/**
 * Get all remotes for a user
 */
function getUserRemotes(userId) {
  return db.prepare(
    'SELECT * FROM rclone_configs WHERE user_id = ? ORDER BY created_at ASC'
  ).all(userId).map(r => ({
    id: r.id,
    remoteName: r.remote_name,
    remoteType: r.remote_type,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
  }));
}

/**
 * Delete a remote config
 */
function deleteRemoteConfig(userId, remoteName) {
  db.prepare(
    'DELETE FROM rclone_configs WHERE user_id = ? AND remote_name = ?'
  ).run(userId, remoteName);
}

/**
 * Toggle a remote active/inactive
 */
function toggleRemote(userId, remoteName) {
  const row = db.prepare(
    'SELECT * FROM rclone_configs WHERE user_id = ? AND remote_name = ?'
  ).get(userId, remoteName);
  if (!row) return false;

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE rclone_configs SET is_active = ?, updated_at = ? WHERE user_id = ? AND remote_name = ?'
  ).run(row.is_active ? 0 : 1, now, userId, remoteName);
  return true;
}

/**
 * Write rclone.conf to disk for a user
 */
function writeRcloneConfFile(userId, outputPath = null) {
  const confText = generateRcloneConf(userId);
  const destPath = outputPath || path.join(
    getConfig('storage_path') || path.join(__dirname, '..', 'data', 'backups'),
    userId, '.rclone.conf'
  );

  fs.ensureDirSync(path.dirname(destPath));
  fs.writeFileSync(destPath, confText, 'utf8');
  return destPath;
}

module.exports = {
  buildUserRcloneConfig,
  generateRcloneConf,
  saveRemoteConfig,
  getUserRemotes,
  deleteRemoteConfig,
  toggleRemote,
  writeRcloneConfFile,
};
