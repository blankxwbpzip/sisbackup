const { v4: uuid } = require('uuid');
const { db, getUserById } = require('../db');

async function syncRoutes(fastify, opts) {
  // All sync routes require auth
  fastify.addHook('preHandler', fastify.authenticate);

  // ─── Backup Sources ──────────────────────────────────────

  // List user's backup sources
  fastify.get('/api/sync/sources', async (request) => {
    const rows = db.prepare(
      'SELECT * FROM backup_sources WHERE user_id = ? ORDER BY created_at DESC'
    ).all(request.user.id);
    return rows.map(r => ({
      id: r.id,
      localPath: r.local_path,
      includePattern: r.include_pattern,
      excludePattern: r.exclude_pattern,
      syncSchedule: r.sync_schedule,
      syncIntervalMinutes: r.sync_interval_m,
      retentionDays: r.retention_days,
      isPaused: r.is_paused === 1,
      createdAt: r.created_at,
    }));
  });

  // Add backup source
  fastify.post('/api/sync/sources', async (request, reply) => {
    const { localPath, includePattern, excludePattern, syncSchedule, syncIntervalMinutes, retentionDays } = request.body || {};
    if (!localPath) {
      return reply.status(400).send({ error: 'localPath required' });
    }

    const now = new Date().toISOString();
    const id = uuid();
    const clientId = request.headers['x-client-id'] || 'unknown';

    db.prepare(`
      INSERT INTO backup_sources (id, user_id, client_id, local_path, include_pattern, exclude_pattern, sync_schedule, sync_interval_m, retention_days, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, request.user.id, clientId, localPath, includePattern || null, excludePattern || null,
      syncSchedule || 'realtime', syncIntervalMinutes || null, retentionDays || null, now, now);

    return { success: true, id };
  });

  // Update backup source
  fastify.patch('/api/sync/sources/:id', async (request, reply) => {
    const source = db.prepare('SELECT * FROM backup_sources WHERE id = ? AND user_id = ?')
      .get(request.params.id, request.user.id);
    if (!source) return reply.status(404).send({ error: 'Source not found' });

    const { isPaused, includePattern, excludePattern, syncSchedule, syncIntervalMinutes, retentionDays } = request.body || {};
    const now = new Date().toISOString();

    if (isPaused !== undefined) {
      db.prepare('UPDATE backup_sources SET is_paused = ?, updated_at = ? WHERE id = ?')
        .run(isPaused ? 1 : 0, now, request.params.id);
    }
    if (includePattern !== undefined) {
      db.prepare('UPDATE backup_sources SET include_pattern = ?, updated_at = ? WHERE id = ?')
        .run(includePattern, now, request.params.id);
    }
    if (excludePattern !== undefined) {
      db.prepare('UPDATE backup_sources SET exclude_pattern = ?, updated_at = ? WHERE id = ?')
        .run(excludePattern, now, request.params.id);
    }
    if (syncSchedule) {
      db.prepare('UPDATE backup_sources SET sync_schedule = ?, updated_at = ? WHERE id = ?')
        .run(syncSchedule, now, request.params.id);
    }
    if (syncIntervalMinutes !== undefined) {
      db.prepare('UPDATE backup_sources SET sync_interval_m = ?, updated_at = ? WHERE id = ?')
        .run(syncIntervalMinutes, now, request.params.id);
    }
    if (retentionDays !== undefined) {
      db.prepare('UPDATE backup_sources SET retention_days = ?, updated_at = ? WHERE id = ?')
        .run(retentionDays, now, request.params.id);
    }

    return { success: true };
  });

  // Delete backup source
  fastify.delete('/api/sync/sources/:id', async (request, reply) => {
    const source = db.prepare('SELECT * FROM backup_sources WHERE id = ? AND user_id = ?')
      .get(request.params.id, request.user.id);
    if (!source) return reply.status(404).send({ error: 'Source not found' });

    db.prepare('DELETE FROM backup_sources WHERE id = ?').run(request.params.id);
    return { success: true };
  });

  // ─── Backup Destinations ─────────────────────────────────

  // List user's backup destinations
  fastify.get('/api/sync/destinations', async (request) => {
    const rows = db.prepare(
      'SELECT * FROM backup_destinations WHERE user_id = ? ORDER BY priority ASC'
    ).all(request.user.id);
    return rows.map(r => ({
      id: r.id,
      destType: r.dest_type,
      destLabel: r.dest_label,
      isEnabled: r.is_enabled === 1,
      priority: r.priority,
      createdAt: r.created_at,
    }));
  });

  // Add backup destination
  fastify.post('/api/sync/destinations', async (request, reply) => {
    const { destType, destLabel, destConfig, priority } = request.body || {};
    if (!destType || !destLabel) {
      return reply.status(400).send({ error: 'destType and destLabel required' });
    }

    const now = new Date().toISOString();
    const id = uuid();

    db.prepare(`
      INSERT INTO backup_destinations (id, user_id, dest_type, dest_config, dest_label, is_enabled, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, request.user.id, destType, JSON.stringify(destConfig || {}), destLabel, priority || 1, now, now);

    return { success: true, id };
  });

  // Delete backup destination
  fastify.delete('/api/sync/destinations/:id', async (request, reply) => {
    const dest = db.prepare('SELECT * FROM backup_destinations WHERE id = ? AND user_id = ?')
      .get(request.params.id, request.user.id);
    if (!dest) return reply.status(404).send({ error: 'Destination not found' });

    db.prepare('DELETE FROM backup_destinations WHERE id = ?').run(request.params.id);
    return { success: true };
  });

  // Toggle destination
  fastify.patch('/api/sync/destinations/:id/toggle', async (request, reply) => {
    const dest = db.prepare('SELECT * FROM backup_destinations WHERE id = ? AND user_id = ?')
      .get(request.params.id, request.user.id);
    if (!dest) return reply.status(404).send({ error: 'Destination not found' });

    const now = new Date().toISOString();
    db.prepare('UPDATE backup_destinations SET is_enabled = ?, updated_at = ? WHERE id = ?')
      .run(dest.is_enabled ? 0 : 1, now, request.params.id);

    return { success: true, isEnabled: !dest.is_enabled };
  });

  // ─── Sync Logs ───────────────────────────────────────────

  // List sync logs
  fastify.get('/api/sync/logs', async (request) => {
    const { limit = 50, offset = 0 } = request.query;
    const rows = db.prepare(`
      SELECT sl.*, bs.local_path, bd.dest_label
      FROM sync_logs sl
      LEFT JOIN backup_sources bs ON sl.source_id = bs.id
      LEFT JOIN backup_destinations bd ON sl.dest_id = bd.id
      WHERE sl.user_id = ?
      ORDER BY sl.started_at DESC
      LIMIT ? OFFSET ?
    `).all(request.user.id, Number(limit), Number(offset));

    return rows.map(r => ({
      id: r.id,
      status: r.status,
      filesTotal: r.files_total,
      filesSynced: r.files_synced,
      filesFailed: r.files_failed,
      bytesTransfer: r.bytes_transfer,
      errorMessage: r.error_message,
      localPath: r.local_path,
      destLabel: r.dest_label,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    }));
  });

  // Create sync log entry (called by client when sync starts)
  fastify.post('/api/sync/logs', async (request, reply) => {
    const { sourceId, destId, status, filesTotal, filesSynced, filesFailed, bytesTransfer, errorMessage } = request.body || {};
    if (!sourceId || !destId) {
      return reply.status(400).send({ error: 'sourceId and destId required' });
    }

    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sync_logs (id, user_id, source_id, dest_id, status, files_total, files_synced, files_failed, bytes_transfer, error_message, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, request.user.id, sourceId, destId, status || 'completed', filesTotal || 0,
      filesSynced || 0, filesFailed || 0, bytesTransfer || 0, errorMessage || null, now, now);

    // Update user used_bytes
    if (status === 'completed' && bytesTransfer > 0) {
      db.prepare('UPDATE users SET used_bytes = used_bytes + ?, updated_at = ? WHERE id = ?')
        .run(bytesTransfer, now, request.user.id);
    }

    return { success: true, id };
  });

  // ─── File Upload for sync ────────────────────────────────

  // Receive file upload from client
  fastify.post('/api/sync/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const storagePath = db.prepare("SELECT value FROM server_config WHERE key = 'storage_path'").get().value;
    const userDir = require('path').join(storagePath, request.user.username);
    require('fs-extra').ensureDirSync(userDir);

    const destPath = require('path').join(userDir, data.filename);
    const writeStream = require('fs').createWriteStream(destPath);
    await data.file.pipe(writeStream);

    // Update user used bytes
    const stats = require('fs').statSync(destPath);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET used_bytes = used_bytes + ?, updated_at = ? WHERE id = ?')
      .run(stats.size, now, request.user.id);

    return { success: true, filename: data.filename, size: stats.size };
  });
}

module.exports = syncRoutes;
