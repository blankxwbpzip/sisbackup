const destIcons = {
  local_server: '🏫',
  google_drive: '📗',
  onedrive: '🔵',
  local: '💾',
  siscloud: '☁️',
};

const destLabels = {
  local_server: 'Server Sekolah',
  google_drive: 'Google Drive',
  onedrive: 'OneDrive',
  local: 'Penyimpanan Lokal',
  siscloud: 'Siscloud',
};

export default function DestinationList({ destinations, onDelete, onToggle }) {
  if (destinations.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        🎯 Belum ada tujuan backup. Klik "Tambah" untuk menambahkan.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {destinations.map(dest => (
        <div key={dest.id} className="px-5 py-3 flex items-center gap-4">
          {/* Icon */}
          <span className="text-2xl">{destIcons[dest.destType] || '📁'}</span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">{dest.destLabel}</div>
            <div className="text-xs text-gray-400">
              {destLabels[dest.destType] || dest.destType}
              <span className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${dest.isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="ml-1">{dest.isEnabled ? 'Aktif' : 'Nonaktif'}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggle(dest.id)}
              className={`px-2 py-1 rounded text-xs ${dest.isEnabled ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'}`}
            >
              {dest.isEnabled ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button
              onClick={() => onDelete(dest.id)}
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
