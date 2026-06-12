import { useState, useEffect } from 'react';
import { getSyncSources, getSyncLogs } from '../lib/api';

export default function SyncStatusBar({ paused }) {
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadStatus() {
    try {
      const logs = await getSyncLogs(5);
      if (logs.length > 0) {
        setLastSync(logs[0]);
        setError('');
      }
    } catch {
      setError('Tidak dapat terhubung ke server');
    }
  }

  const statusColor = paused ? 'bg-amber-500' :
    error ? 'bg-red-500' :
    lastSync?.status === 'failed' ? 'bg-red-500' :
    lastSync?.status === 'success' ? 'bg-green-500' :
    'bg-blue-500';

  const statusText = paused ? 'Sync dijeda' :
    error ? 'Server tidak terjangkau' :
    lastSync?.status === 'failed' ? 'Sync terakhir gagal' :
    lastSync?.status === 'success' ? 'Sync terakhir berhasil' :
    'Menunggu sync...';

  const timeAgo = lastSync?.completedAt
    ? Math.round((Date.now() - new Date(lastSync.completedAt).getTime()) / 60000)
    : null;

  return (
    <div className={`px-6 py-2 flex items-center gap-3 text-sm text-white ${statusColor} transition-colors`}>
      <span className={`w-2 h-2 rounded-full bg-white ${paused ? '' : 'animate-pulse'}`} />
      <span>{statusText}</span>
      {timeAgo !== null && timeAgo >= 0 && (
        <span className="text-white/70 text-xs">
          {timeAgo === 0 ? 'baru saja' : `${timeAgo} menit lalu`}
        </span>
      )}
    </div>
  );
}
