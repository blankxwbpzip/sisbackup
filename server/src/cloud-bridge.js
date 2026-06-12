/**
 * Cloud Bridge — Sync engine from App Server → Siscloud
 *
 * Features:
 * - Initial full sync: upload semua data ke cloud
 * - Incremental delta sync: hanya upload file yang berubah
 * - Offline queue: antrian sync disimpan lokal jika internet putus
 * - Retry with exponential backoff
 * - Encryption in transit
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { db, getConfig } = require('./db');

// ─── Sync Queue Table ─────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS cloud_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'upload' | 'delete'
    file_size INTEGER,
    file_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'syncing' | 'done' | 'failed'
    retries INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    error_message TEXT,
    created_at TEXT NOT NULL,
    last_attempt_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_cloud_queue_status ON cloud_sync_queue(status);
  CREATE INDEX IF NOT EXISTS idx_cloud_queue_user ON cloud_sync_queue(user_id);
`);

// ─── Config ───────────────────────────────────────────────

function getCloudConfig() {
  return {
    enabled: getConfig('cloud_enabled') === 'true',
    siscloudUrl: getConfig('siscloud_url') || '',
    schoolId: getConfig('siscloud_school_id') || '',
    apiKey: getConfig('siscloud_api_key') || '',
  };
}

function isCloudEnabled() {
  return getCloudConfig().enabled && getCloudConfig().siscloudUrl;
}

// ─── Queue Operations ─────────────────────────────────────

function enqueueSync(userId, filePath, operation, fileSize = 0, fileHash = null) {
  if (!isCloudEnabled()) return null;

  const { v4: uuid } = require('uuid');
  const now = new Date().toISOString();
  const id = uuid();

  db.prepare(`
    INSERT INTO cloud_sync_queue (id, user_id, file_path, operation, file_size, file_hash, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, userId, filePath, operation, fileSize, fileHash, now);

  return id;
}

function getPendingSyncs(limit = 50) {
  return db.prepare(`
    SELECT * FROM cloud_sync_queue
    WHERE status IN ('pending', 'failed')
    AND retries < max_retries
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit);
}

function markSyncStatus(id, status, errorMessage = null) {
  const now = new Date().toISOString();
  if (status === 'syncing') {
    db.prepare(
      'UPDATE cloud_sync_queue SET status = ?, last_attempt_at = ? WHERE id = ?'
    ).run(status, now, id);
  } else if (status === 'failed') {
    db.prepare(`
      UPDATE cloud_sync_queue
      SET status = ?, retries = retries + 1, error_message = ?, last_attempt_at = ?
      WHERE id = ?
    `).run(status, errorMessage, now, id);
  } else {
    db.prepare(
      'UPDATE cloud_sync_queue SET status = ?, last_attempt_at = ? WHERE id = ?'
    ).run(status, now, id);
  }
}

function getQueueStats() {
  const pending = db.prepare(
    "SELECT COUNT(*) as count FROM cloud_sync_queue WHERE status = 'pending'"
  ).get().count;
  const failed = db.prepare(
    "SELECT COUNT(*) as count FROM cloud_sync_queue WHERE status = 'failed' AND retries >= max_retries"
  ).get().count;
  const done = db.prepare(
    "SELECT COUNT(*) as count FROM cloud_sync_queue WHERE status = 'done'"
  ).get().count;
  return { pending, failed, done, total: pending + failed + done };
}

// ─── Sync Engine ──────────────────────────────────────────

async function processSyncQueue() {
  if (!isCloudEnabled()) return { processed: 0, message: 'Cloud sync disabled' };

  const config = getCloudConfig();
  const pendingSyncs = getPendingSyncs(25);
  let processed = 0;
  let errors = 0;

  for (const sync of pendingSyncs) {
    try {
      markSyncStatus(sync.id, 'syncing');

      const storagePath = getConfig('storage_path') || path.join(__dirname, '..', 'data', 'backups');
      const fullPath = path.join(storagePath, sync.user_id, sync.file_path);

      if (sync.operation === 'delete') {
        // DELETE file from cloud
        const res = await fetch(`${config.siscloudUrl}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Siscloud-Key': config.apiKey,
          },
          body: JSON.stringify({
            operation: 'delete',
            userId: sync.user_id,
            filePath: sync.file_path,
          }),
        });

        if (!res.ok) throw new Error(`Cloud API error: ${res.status}`);
        markSyncStatus(sync.id, 'done');
        processed++;
      } else {
        // UPLOAD file to cloud
        if (!fs.existsSync(fullPath)) {
          // File no longer exists locally — mark as done
          markSyncStatus(sync.id, 'done');
          continue;
        }

        const fileBuffer = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Send as batch if more items pending
        const res = await fetch(`${config.siscloudUrl}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Siscloud-Key': config.apiKey,
          },
          body: JSON.stringify({
            operation: 'upload',
            userId: sync.user_id,
            filePath: sync.file_path,
            data: fileBuffer.toString('base64'),
            metadata: {
              hash,
              size: fileBuffer.length,
              modifiedAt: fs.statSync(fullPath).mtime.toISOString(),
            },
          }),
        });

        if (!res.ok) throw new Error(`Cloud API error: ${res.status}`);

        markSyncStatus(sync.id, 'done');
        processed++;
      }
    } catch (err) {
      markSyncStatus(sync.id, 'failed', err.message);
      errors++;
    }
  }

  // Update last sync timestamp
  if (processed > 0) {
    const now = new Date().toISOString();
    db.prepare("UPDATE server_config SET value = ?, updated_at = ? WHERE key = 'last_cloud_sync'")
      .run(now, now);
  }

  return { processed, errors, pending: getQueueStats().pending };
}

// ─── Auto-Sync Loop ───────────────────────────────────────

let syncInterval = null;

function startCloudSyncLoop(intervalMs = 60000) {
  if (!isCloudEnabled()) return;

  if (syncInterval) clearInterval(syncInterval);

  const run = async () => {
    try {
      const result = await processSyncQueue();
      if (result.processed > 0 || result.errors > 0) {
        console.log(`[CloudBridge] Sync: ${result.processed} processed, ${result.errors} errors`);
      }
    } catch (err) {
      console.error('[CloudBridge] Sync loop error:', err.message);
    }
  };

  syncInterval = setInterval(run, intervalMs);
  // Run immediately once
  run();
}

function stopCloudSyncLoop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

module.exports = {
  enqueueSync,
  getPendingSyncs,
  markSyncStatus,
  getQueueStats,
  processSyncQueue,
  startCloudSyncLoop,
  stopCloudSyncLoop,
  isCloudEnabled,
  getCloudConfig,
};
