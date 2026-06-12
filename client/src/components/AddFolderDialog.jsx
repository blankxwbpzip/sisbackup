import { useState } from 'react';

export default function AddFolderDialog({ onAdd, onClose }) {
  const [localPath, setLocalPath] = useState('D:\\Data Guru');
  const [syncSchedule, setSyncSchedule] = useState('realtime');
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const [syncInterval, setSyncInterval] = useState(15);

  function handleSubmit(e) {
    e.preventDefault();
    onAdd({
      localPath,
      syncSchedule,
      includePattern: includePattern || null,
      excludePattern: excludePattern || null,
      syncIntervalMinutes: syncSchedule === 'periodic' ? syncInterval : null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-medium text-gray-900 mb-4">Tambah Folder Backup</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Lokasi Folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localPath}
                onChange={e => setLocalPath(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
                placeholder="D:\Data Guru"
                required
              />
              <button type="button" className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                onClick={() => {
                  // In Tauri, we'd use the file dialog
                  // For now, just a placeholder
                }}>
                📁
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Jadwal Sync</label>
            <select value={syncSchedule}
              onChange={e => setSyncSchedule(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="realtime">Real-time (perubahan langsung disync)</option>
              <option value="periodic">Periodik (setiap N menit)</option>
              <option value="manual">Manual (sync saat diminta)</option>
            </select>
          </div>

          {syncSchedule === 'periodic' && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">Interval (menit)</label>
              <input type="number" value={syncInterval}
                onChange={e => setSyncInterval(parseInt(e.target.value) || 15)}
                className="w-full px-3 py-2 border rounded-lg text-sm" min={1} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Include (opsional)</label>
              <input type="text" value={includePattern}
                onChange={e => setIncludePattern(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="*.docx,*.pdf" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Exclude (opsional)</label>
              <input type="text" value={excludePattern}
                onChange={e => setExcludePattern(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="*.tmp,node_modules" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit"
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
              Tambah Folder
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
