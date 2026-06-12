/**
 * Sync engine - integrates with rclone via Tauri commands
 */

// Check if running inside Tauri
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

let rcloneAvailable = false;

export async function checkRclone() {
  if (isTauri) {
    try {
      const { invoke } = window.__TAURI_INTERNALS__
        ? await import('@tauri-apps/api/core')
        : { invoke: null };
      if (invoke) {
        rcloneAvailable = await invoke('check_rclone');
        return rcloneAvailable;
      }
    } catch {
      // Not running in Tauri or command not available
    }
  }
  // Try running rclone directly in browser/dev mode
  return false;
}

export async function getRcloneVersion() {
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_rclone_version');
    } catch { /* fall through */ }
  }
  return null;
}

export async function startSync(sourcePath, destType, destConfig) {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('start_sync', {
      sourcePath,
      destType,
      destConfig: JSON.stringify(destConfig),
    });
  }
  throw new Error('Sync requires Tauri runtime');
}

export async function stopSync(syncId) {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('stop_sync', { syncId });
  }
}

export async function getSyncStatus() {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('get_sync_status');
  }
  return [];
}

/**
 * Determine rclone remote string based on destination type and config
 */
export function buildRcloneDestination(destType, config) {
  switch (destType) {
    case 'local_server': {
      const { host, username, path } = config;
      return `:sftp:${username}@${host}:${path}`;
    }
    case 'google_drive': {
      const { folder = 'Sisbackup' } = config;
      return `gdrive:${folder}`;
    }
    case 'onedrive': {
      const { folder = 'Sisbackup' } = config;
      return `onedrive:${folder}`;
    }
    case 'local': {
      return config.path || './backup';
    }
    default:
      throw new Error(`Unknown destination type: ${destType}`);
  }
}

/**
 * Simulate rclone command (for reference/documentation)
 *
 * rclone sync "D:\Data Guru" gdrive:Sisbackup/Ana \
 *   --progress --stats 5s \
 *   --exclude "*.tmp" \
 *   --exclude "node_modules/**"
 */
export function buildRcloneArgs(sourcePath, destConfig, excludePattern = null) {
  const args = [
    'sync',
    sourcePath,
    buildRcloneDestination(destConfig.destType, destConfig),
    '--progress',
    '--stats', '5s',
  ];

  if (excludePattern) {
    const patterns = excludePattern.split(',').map(p => p.trim()).filter(Boolean);
    patterns.forEach(p => args.push('--exclude', p));
  }

  return args;
}

/**
 * Watch folder for changes (polling-based, platform-independent)
 */
export class FolderWatcher {
  constructor(path, onChange, intervalMs = 5000) {
    this.path = path;
    this.onChange = onChange;
    this.intervalMs = intervalMs;
    this.interval = null;
    this.lastSnapshot = null;
  }

  start() {
    this.interval = setInterval(() => this.check(), this.intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async check() {
    // In a real implementation, this would use Tauri's filesystem API
    // to check for file changes. For now, it's a placeholder that triggers
    // the onChange callback periodically for polling-based sync.
    if (this.onChange) {
      this.onChange(this.path);
    }
  }
}
