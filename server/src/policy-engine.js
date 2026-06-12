/**
 * Backup Policy Engine
 *
 * - Scheduled backups (cron-based)
 * - Retention policies (keep last N, keep daily/weekly/monthly)
 * - Regex include/exclude filters
 * - Backup tiers (hot/warm/cold)
 */

const { db } = require('./db');

// ─── Policies Table ───────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS backup_policies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schedule_cron TEXT,                    -- cron expression
    retention_count INTEGER DEFAULT 30,    -- keep last N backups
    retention_daily INTEGER DEFAULT 7,     -- keep N daily backups
    retention_weekly INTEGER DEFAULT 4,    -- keep N weekly backups
    retention_monthly INTEGER DEFAULT 12,  -- keep N monthly backups
    include_pattern TEXT,                  -- regex include
    exclude_pattern TEXT,                  -- regex exclude
    min_free_space_gb INTEGER DEFAULT 5,   -- pause if free space < N GB
    is_enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 1,
    tier TEXT NOT NULL DEFAULT 'hot',      -- 'hot' | 'warm' | 'cold'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS backup_snapshots (
    id TEXT PRIMARY KEY,
    policy_id TEXT REFERENCES backup_policies(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    files_total INTEGER DEFAULT 0,
    files_synced INTEGER DEFAULT 0,
    bytes_total INTEGER DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'hot',
    label TEXT,
    created_at TEXT NOT NULL
  );
`);

// ─── Cron Parser ──────────────────────────────────────────

function parseCron(cron) {
  // Simple cron parser: minute hour dom month dow
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function cronMatches(cron, date = new Date()) {
  const parsed = parseCron(cron);
  if (!parsed) return false;

  const matches = (field, value) => {
    if (field === '*') return true;
    if (field.includes(',')) {
      return field.split(',').some(f => matches(f.trim(), value));
    }
    if (field.includes('/')) {
      const [, step] = field.split('/');
      return value % parseInt(step) === 0;
    }
    return parseInt(field) === value;
  };

  return (
    matches(parsed.minute, date.getMinutes()) &&
    matches(parsed.hour, date.getHours()) &&
    matches(parsed.dayOfMonth, date.getDate()) &&
    matches(parsed.month, date.getMonth() + 1) &&
    matches(parsed.dayOfWeek, date.getDay())
  );
}

function getNextRunTime(cron, fromDate = new Date()) {
  // Find next matching time within next 24 hours
  const next = new Date(fromDate);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 1440; i++) { // Check every minute for 24h
    if (cronMatches(cron, next)) return new Date(next);
    next.setMinutes(next.getMinutes() + 1);
  }
  return null;
}

// ─── Pattern Matching ─────────────────────────────────────

function matchesPattern(filename, pattern) {
  if (!pattern) return false;
  try {
    const regex = new RegExp(
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    );
    return regex.test(filename);
  } catch {
    // If regex is invalid, treat as glob-like pattern
    return filename.includes(pattern.replace(/\*/g, ''));
  }
}

function shouldInclude(filename, policy) {
  if (policy.include_pattern && !matchesPattern(filename, policy.include_pattern)) {
    return false;
  }
  if (policy.exclude_pattern && matchesPattern(filename, policy.exclude_pattern)) {
    return false;
  }
  return true;
}

// ─── Policy CRUD ──────────────────────────────────────────

function createPolicy(userId, data) {
  const { v4: uuid } = require('uuid');
  const now = new Date().toISOString();
  const id = uuid();

  db.prepare(`
    INSERT INTO backup_policies (id, user_id, name, schedule_cron, retention_count,
      retention_daily, retention_weekly, retention_monthly, include_pattern,
      exclude_pattern, min_free_space_gb, is_enabled, priority, tier, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, data.name, data.scheduleCron || null,
    data.retentionCount ?? 30, data.retentionDaily ?? 7,
    data.retentionWeekly ?? 4, data.retentionMonthly ?? 12,
    data.includePattern || null, data.excludePattern || null,
    data.minFreeSpaceGb ?? 5, data.isEnabled !== false ? 1 : 0,
    data.priority ?? 1, data.tier || 'hot', now, now
  );

  return id;
}

function getUserPolicies(userId) {
  return db.prepare(
    'SELECT * FROM backup_policies WHERE user_id = ? ORDER BY priority ASC'
  ).all(userId);
}

function updatePolicy(policyId, updates) {
  const now = new Date().toISOString();
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    fields.push(`${col} = ?`);
    values.push(value);
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(policyId);

  db.prepare(`UPDATE backup_policies SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deletePolicy(policyId) {
  db.prepare('DELETE FROM backup_policies WHERE id = ?').run(policyId);
}

// ─── Snapshot Management ──────────────────────────────────

function createSnapshot(policyId, userId, label = null) {
  const { v4: uuid } = require('uuid');
  const now = new Date().toISOString();
  const id = uuid();

  const policy = db.prepare('SELECT tier FROM backup_policies WHERE id = ?').get(policyId);

  db.prepare(`
    INSERT INTO backup_snapshots (id, policy_id, user_id, started_at, status, tier, label, created_at)
    VALUES (?, ?, ?, ?, 'running', ?, ?, ?)
  `).run(id, policyId, userId, now, policy?.tier || 'hot', label || null, now);

  return id;
}

function completeSnapshot(snapshotId, stats) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE backup_snapshots
    SET status = 'completed', completed_at = ?, files_total = ?, files_synced = ?, bytes_total = ?
    WHERE id = ?
  `).run(now, stats.filesTotal || 0, stats.filesSynced || 0, stats.bytesTotal || 0, snapshotId);
}

// ─── Retention Enforcement ────────────────────────────────

function enforceRetention(userId) {
  const policy = db.prepare(
    'SELECT * FROM backup_policies WHERE user_id = ? AND is_enabled = 1 LIMIT 1'
  ).get(userId);
  if (!policy) return;

  const snapshots = db.prepare(`
    SELECT * FROM backup_snapshots
    WHERE user_id = ? AND status = 'completed'
    ORDER BY started_at DESC
  `).all(userId);

  // Keep last N overall
  const toKeep = policy.retention_count;
  if (snapshots.length > toKeep) {
    const toDelete = snapshots.slice(toKeep);
    for (const snap of toDelete) {
      db.prepare('DELETE FROM backup_snapshots WHERE id = ?').run(snap.id);
    }
  }

  // Daily retention: keep one per day for last N days
  // Weekly: keep one per week
  // Monthly: keep one per month
  // Implementation depends on snapshot labels and dates
}

// ─── Free Space Check ─────────────────────────────────────

function checkFreeSpace(path) {
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      const drive = path.substring(0, 2);
      const result = execSync(
        `powershell -Command "(Get-PSDrive ${drive}).Free"`,
        { encoding: 'utf8', timeout: 5000 }
      );
      return parseInt(result.trim()) || 0;
    } else {
      const result = execSync(`df -B1 "${path}" | tail -1`, { encoding: 'utf8', timeout: 5000 });
      return parseInt(result.trim().split(/\s+/)[3]) || 0;
    }
  } catch {
    return Infinity; // Assume space OK if can't check
  }
}

function isBackupAllowed(userId) {
  const policies = getUserPolicies(userId);
  if (policies.length === 0) return true; // No policy = always allowed

  const storagePath = require('./db').getConfig('storage_path') ||
    require('path').join(__dirname, '..', 'data', 'backups');

  for (const policy of policies) {
    if (!policy.is_enabled) continue;
    const freeSpaceGb = checkFreeSpace(storagePath) / (1024 ** 3);
    if (freeSpaceGb < policy.min_free_space_gb) {
      return false;
    }
  }

  return true;
}

module.exports = {
  parseCron,
  cronMatches,
  getNextRunTime,
  matchesPattern,
  shouldInclude,
  createPolicy,
  getUserPolicies,
  updatePolicy,
  deletePolicy,
  createSnapshot,
  completeSnapshot,
  enforceRetention,
  isBackupAllowed,
};
