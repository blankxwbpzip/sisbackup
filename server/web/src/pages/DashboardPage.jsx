import { useState, useEffect } from 'react';
import { getStats, getHealth } from '../lib/api';

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}h`);
  if (h > 0) parts.push(`${h}j`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default function DashboardPage({ user }) {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getHealth()])
      .then(([s, h]) => { setStats(s); setHealth(h); })
      .finally(() => setLoading(false));

    const interval = setInterval(() => getStats().then(setStats), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">Server: {health?.status === 'ok' ? 'Online' : 'Offline'}</span>
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-500">Uptime: {health?.uptime ? formatUptime(health.uptime) : '...'}</span>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-500">Node: {health?.nodeVersion || '...'}</span>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-500">OS: {health?.platform || '...'}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Total Pengguna" value={stats?.totalUsers || 0} />
        <StatCard icon="🟢" label="Sync Hari Ini" value={stats?.todaySyncs || 0} sub="dalam 24 jam" />
        <StatCard icon="💾" label="Storage Terpakai" value={formatBytes(stats?.totalUsedBytes || 0)} />
        <StatCard icon="🔌" label="Client Aktif" value={stats?.activeClients || 0} sub="10 menit terakhir" />
      </div>

      {/* Storage Bar */}
      {stats && stats.totalStorage > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Penggunaan Storage</span>
            <span className="text-sm text-gray-500">
              {formatBytes(stats.totalUsedBytes)} / {formatBytes(stats.totalStorage)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-gradient-to-r from-primary-500 to-primary-700"
              style={{ width: `${Math.min(100, (stats.totalUsedBytes / stats.totalStorage) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Free: {formatBytes(stats.freeStorage)} ({stats.freeStorage && stats.totalStorage ? Math.round((stats.freeStorage / stats.totalStorage) * 100) : 0}%)
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b">
          <h3 className="font-medium text-gray-900">Aktivitas Terbaru</h3>
        </div>
        <div className="divide-y">
          {stats?.recentSyncs?.length > 0 ? stats.recentSyncs.slice(0, 10).map(sync => (
            <div key={sync.id} className="px-5 py-3 flex items-center gap-4 text-sm">
              <span className={
                sync.status === 'success' ? 'text-green-500' :
                sync.status === 'failed' ? 'text-red-500' : 'text-amber-500'
              }>
                {sync.status === 'success' ? '✅' : sync.status === 'failed' ? '❌' : '⚠️'}
              </span>
              <span className="text-gray-600 flex-1">
                {sync.filesTotal} file ({formatBytes(sync.bytesTransfer)})
              </span>
              <span className="text-gray-400 text-xs">
                {new Date(sync.startedAt).toLocaleString('id-ID')}
              </span>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              Belum ada aktivitas sync
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
