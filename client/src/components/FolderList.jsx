const scheduleLabels = {
  realtime: 'Real-time',
  periodic: 'Periodik',
  manual: 'Manual',
};

export default function FolderList({ folders, onDelete, onToggle }) {
  if (folders.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        📂 Belum ada folder yang di-backup. Klik "Tambah" untuk memulai.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {folders.map(folder => (
        <div key={folder.id} className="px-5 py-3 flex items-center gap-4">
          {/* Status icon */}
          <span className="text-xl">
            {folder.isPaused ? '⏸' : '📂'}
          </span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{folder.localPath}</div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span>{scheduleLabels[folder.syncSchedule] || folder.syncSchedule}</span>
              {folder.includePattern && <span>Filter: {folder.includePattern}</span>}
              {folder.excludePattern && <span>Exclude: {folder.excludePattern}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggle(folder.id, !folder.isPaused)}
              className={`px-2 py-1 rounded text-xs ${folder.isPaused ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}
            >
              {folder.isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              onClick={() => onDelete(folder.id)}
              className="px-2 py-1 rounded text-xs bg-red-50 text-red-500 hover:bg-red-100"
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
