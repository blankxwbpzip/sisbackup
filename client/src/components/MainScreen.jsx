import { useState, useEffect, useCallback } from 'react';
import {
  getSyncSources, addSyncSource, deleteSyncSource, updateSyncSource,
  getSyncDestinations, addSyncDestination, deleteSyncDestination, toggleSyncDestination,
  getMyStats, logout,
} from '../lib/api';
import FolderList from './FolderList';
import DestinationList from './DestinationList';
import SyncStatusBar from './SyncStatusBar';
import AddFolderDialog from './AddFolderDialog';
import AddDestinationDialog from './AddDestinationDialog';

export default function MainScreen({ user, onLogout }) {
  const [sources, setSources] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddDest, setShowAddDest] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [s, d, st] = await Promise.all([
        getSyncSources(),
        getSyncDestinations(),
        getMyStats(),
      ]);
      setSources(s);
      setDestinations(d);
      setStats(st);
    } catch {
      // Server might be offline
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFolder(folderData) {
    try {
      await addSyncSource(folderData);
      setShowAddFolder(false);
      loadData();
    } catch (err) {
      alert('Gagal menambah folder: ' + err.message);
    }
  }

  async function handleDeleteFolder(id) {
    if (!confirm('Hapus folder backup ini?')) return;
    try {
      await deleteSyncSource(id);
      loadData();
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  }

  async function handleToggleFolder(id, isPaused) {
    try {
      await updateSyncSource(id, { isPaused });
      loadData();
    } catch {
      // offline
    }
  }

  async function handleAddDestination(destData) {
    try {
      await addSyncDestination(destData);
      setShowAddDest(false);
      loadData();
    } catch (err) {
      alert('Gagal menambah tujuan: ' + err.message);
    }
  }

  async function handleDeleteDestination(id) {
    if (!confirm('Hapus tujuan backup ini?')) return;
    try {
      await deleteSyncDestination(id);
      loadData();
    } catch {
      // offline
    }
  }

  async function handleToggleDestination(id) {
    try {
      await toggleSyncDestination(id);
      loadData();
    } catch {
      // offline
    }
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📦</span>
          <div>
            <h1 className="font-bold text-lg">Sisbackup</h1>
            <p className="text-primary-200 text-xs">{user.displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPaused(!paused)}
            className={`text-sm px-3 py-1 rounded-full ${paused ? 'bg-amber-500 text-white' : 'bg-primary-700 text-primary-200'}`}>
            {paused ? '⏸ Paused' : '▶ Running'}
          </button>
          <button onClick={handleLogout} className="text-primary-300 hover:text-white text-sm">
            Logout
          </button>
        </div>
      </header>

      {/* Storage Bar */}
      {stats && (
        <div className="px-6 py-3 bg-white border-b">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">
              Penyimpanan: {formatBytes(stats.usedBytes)} / {formatBytes(stats.quotaBytes)}
            </span>
            <span className="text-xs text-gray-400">
              {stats.totalSyncs} sync • {stats.successfulSyncs} sukses
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all"
              style={{ width: `${Math.min(100, (stats.usedBytes / stats.quotaBytes) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Sync Status */}
      <SyncStatusBar paused={paused} />

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-6 max-w-3xl mx-auto w-full">
        {/* Folder Backup */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Folder yang Dibackup</h3>
              <p className="text-xs text-gray-500">Pilih folder di komputer ini untuk di-backup otomatis</p>
            </div>
            <button onClick={() => setShowAddFolder(true)}
              className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700">
              + Tambah
            </button>
          </div>
          <FolderList
            folders={sources}
            onDelete={handleDeleteFolder}
            onToggle={handleToggleFolder}
          />
        </div>

        {/* Tujuan Backup */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Tujuan Backup</h3>
              <p className="text-xs text-gray-500">Ke mana data akan disimpan</p>
            </div>
            <button onClick={() => setShowAddDest(true)}
              className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700">
              + Tambah
            </button>
          </div>
          <DestinationList
            destinations={destinations}
            onDelete={handleDeleteDestination}
            onToggle={handleToggleDestination}
          />
        </div>
      </div>

      {/* Dialogs */}
      {showAddFolder && (
        <AddFolderDialog
          onAdd={handleAddFolder}
          onClose={() => setShowAddFolder(false)}
        />
      )}
      {showAddDest && (
        <AddDestinationDialog
          onAdd={handleAddDestination}
          onClose={() => setShowAddDest(false)}
        />
      )}
    </div>
  );
}
