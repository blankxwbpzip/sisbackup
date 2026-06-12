import { useState, useEffect } from 'react';
import { getSyncLogs } from '../lib/api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

const statusConfig = {
  success: { icon: '✅', label: 'Sukses', color: 'text-green-700 bg-green-50' },
  failed: { icon: '❌', label: 'Gagal', color: 'text-red-700 bg-red-50' },
  partial: { icon: '⚠️', label: 'Partial', color: 'text-amber-700 bg-amber-50' },
  conflict: { icon: '🔀', label: 'Konflik', color: 'text-purple-700 bg-purple-50' },
  syncing: { icon: '🔄', label: 'Syncing', color: 'text-blue-700 bg-blue-50' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    getSyncLogs(200).then(setLogs).finally(() => setLoading(false));
    const interval = setInterval(() => getSyncLogs(200).then(setLogs), 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'Semua' },
          { value: 'success', label: '✅ Sukses' },
          { value: 'failed', label: '❌ Gagal' },
          { value: 'partial', label: '⚠️ Partial' },
          { value: 'conflict', label: '🔀 Konflik' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source → Dest</th>
              <th className="px-4 py-3">Files</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(log => {
              const sc = statusConfig[log.status] || statusConfig.partial;
              return (
                <tr key={log.id} className="border-b hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${sc.color}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="text-xs font-mono">{log.localPath || '?'}</span>
                    {log.destLabel && <span className="text-gray-400"> → {log.destLabel}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.filesSynced}/{log.filesTotal}
                    {log.filesFailed > 0 && <span className="text-red-500 ml-1">({log.filesFailed} gagal)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatBytes(log.bytesTransfer)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(log.startedAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    {log.errorMessage && <span className="text-xs text-red-500">{log.errorMessage}</span>}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="text-center text-gray-400 py-10">Tidak ada log</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
