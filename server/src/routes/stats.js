const { getStats, db } = require('../db');

async function statsRoutes(fastify, opts) {
  // Dashboard stats (admin only)
  fastify.get('/api/stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    await fastify.requireAdmin(request, reply);
    if (reply.sent) return;

    const stats = getStats();

    // Get today's sync count
    const today = new Date().toISOString().substring(0, 10);
    const todaySyncs = db.prepare(
      "SELECT COUNT(*) as count FROM sync_logs WHERE started_at >= ?"
    ).get(today).count;

    // Get active clients (unique client_ids with sync in last 10 minutes)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const activeClients = db.prepare(
      "SELECT COUNT(DISTINCT client_id) as count FROM backup_sources bs JOIN sync_logs sl ON bs.id = sl.source_id WHERE sl.started_at >= ?"
    ).get(tenMinAgo).count;

    // Get storage info
    const storagePath = stats.storagePath;
    let totalStorage = 0;
    let freeStorage = 0;
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        // Windows: use PowerShell to get disk info
        const drive = storagePath.substring(0, 2);
        const result = execSync(`powershell -Command "Get-PSDrive ${drive} | Select-Object Used,Free | ConvertTo-Json"`, { encoding: 'utf8', timeout: 5000 });
        const disk = JSON.parse(result);
        totalStorage = (disk.Used || 0) + (disk.Free || 0);
        freeStorage = disk.Free || 0;
      } else {
        // Linux: use df
        const result = execSync(`df -B1 "${storagePath}" | tail -1`, { encoding: 'utf8', timeout: 5000 });
        const parts = result.trim().split(/\s+/);
        totalStorage = parseInt(parts[1]) || 0;
        freeStorage = parseInt(parts[3]) || 0;
      }
    } catch {
      // Fallback: unable to get disk info
    }

    return {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeUsers,
      totalUsedBytes: stats.totalUsedBytes,
      todaySyncs,
      activeClients,
      storagePath,
      totalStorage,
      freeStorage,
      recentSyncs: stats.recentSyncs.map(r => ({
        id: r.id,
        userId: r.user_id,
        status: r.status,
        filesTotal: r.files_total,
        bytesTransfer: r.bytes_transfer,
        startedAt: r.started_at,
      })),
    };
  });

  // User's own stats
  fastify.get('/api/stats/my', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.id;
    const totalSyncs = db.prepare('SELECT COUNT(*) as count FROM sync_logs WHERE user_id = ?').get(userId).count;
    const successfulSyncs = db.prepare("SELECT COUNT(*) as count FROM sync_logs WHERE user_id = ? AND status = 'success'").get(userId).count;
    const lastSync = db.prepare('SELECT * FROM sync_logs WHERE user_id = ? ORDER BY started_at DESC LIMIT 1').get(userId);

    return {
      username: request.user.username,
      displayName: request.user.display_name,
      quotaBytes: request.user.quota_bytes,
      usedBytes: request.user.used_bytes,
      totalSyncs,
      successfulSyncs,
      lastSync: lastSync ? {
        status: lastSync.status,
        filesTotal: lastSync.files_total,
        bytesTransfer: lastSync.bytes_transfer,
        startedAt: lastSync.started_at,
      } : null,
    };
  });
}

module.exports = statsRoutes;
