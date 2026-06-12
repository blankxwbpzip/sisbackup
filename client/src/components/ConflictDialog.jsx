import { useState } from 'react';

/**
 * Conflict resolution dialog
 * Shown when a file exists both locally and on the remote with different content
 */
const RESOLVE_ACTIONS = {
  OVERWRITE_REMOTE: 'overwrite_remote',
  OVERWRITE_LOCAL: 'overwrite_local',
  KEEP_BOTH: 'keep_both',
  SKIP: 'skip',
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(iso) {
  if (!iso) return '?';
  return new Date(iso).toLocaleString('id-ID');
}

export default function ConflictDialog({ conflicts, onResolve, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState({});
  const [applyAll, setApplyAll] = useState(false);

  const conflict = conflicts[currentIndex];
  if (!conflict) {
    // All conflicts resolved
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 m-4 text-center" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-4">✅</div>
          <h3 className="font-medium text-gray-900 mb-2">Semua Konflik Terselesaikan</h3>
          <p className="text-sm text-gray-500 mb-4">{conflicts.length} konflik telah diproses</p>
          <button onClick={() => onResolve(decisions)}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
            Lanjutkan Sync
          </button>
        </div>
      </div>
    );
  }

  function handleAction(action) {
    const newDecisions = {
      ...decisions,
      [conflict.filePath]: action,
    };

    if (applyAll) {
      // Apply same action to all remaining conflicts
      for (let i = currentIndex; i < conflicts.length; i++) {
        newDecisions[conflicts[i].filePath] = action;
      }
    }

    setDecisions(newDecisions);

    if (applyAll) {
      onResolve(newDecisions);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">
            Konflik {currentIndex + 1} dari {conflicts.length}
          </span>
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div className="bg-primary-500 h-1.5 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / conflicts.length) * 100}%` }} />
          </div>
        </div>

        {/* File Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">⚠️</span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {conflict.fileName || conflict.filePath}
              </div>
              <div className="text-xs text-gray-400 truncate">{conflict.filePath}</div>
            </div>
          </div>

          {/* Version comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <div className="text-xs text-amber-600 font-medium mb-1">💻 Versi Lokal</div>
              <div className="text-xs text-gray-600">{formatBytes(conflict.localSize)}</div>
              <div className="text-xs text-gray-400">{formatDate(conflict.localModified)}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-600 font-medium mb-1">☁️ Versi Remote</div>
              <div className="text-xs text-gray-600">{formatBytes(conflict.remoteSize)}</div>
              <div className="text-xs text-gray-400">{formatDate(conflict.remoteModified)}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 mb-4">
          <button onClick={() => handleAction(RESOLVE_ACTIONS.OVERWRITE_REMOTE)}
            className="w-full text-left px-4 py-2.5 border border-primary-200 rounded-lg hover:bg-primary-50 text-sm">
            <span className="font-medium">📤 Timpa remote dengan versi lokal</span>
            <span className="text-gray-400 ml-2 text-xs">(upload file lokal)</span>
          </button>

          <button onClick={() => handleAction(RESOLVE_ACTIONS.OVERWRITE_LOCAL)}
            className="w-full text-left px-4 py-2.5 border border-blue-200 rounded-lg hover:bg-blue-50 text-sm">
            <span className="font-medium">📥 Unduh remote, timpa versi lokal</span>
            <span className="text-gray-400 ml-2 text-xs">(download file remote)</span>
          </button>

          <button onClick={() => handleAction(RESOLVE_ACTIONS.KEEP_BOTH)}
            className="w-full text-left px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
            <span className="font-medium">📋 Simpan keduanya</span>
            <span className="text-gray-400 ml-2 text-xs">(rename: file_conflict.ext)</span>
          </button>

          <button onClick={() => handleAction(RESOLVE_ACTIONS.SKIP)}
            className="w-full text-left px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
            <span className="font-medium">⏭ Lewati file ini</span>
          </button>
        </div>

        {/* Apply all toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={applyAll}
            onChange={e => setApplyAll(e.target.checked)}
            className="rounded"
          />
          Terapkan pilihan yang sama untuk semua konflik yang tersisa ({conflicts.length - currentIndex})
        </label>

        <button onClick={onClose}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-1">
          Tunda (proses nanti)
        </button>
      </div>
    </div>
  );
}

export { RESOLVE_ACTIONS };
