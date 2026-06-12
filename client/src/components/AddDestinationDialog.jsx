import { useState } from 'react';
import { getServerUrl, getOAuthUrl, oauthCallback } from '../lib/api';
import OAuthConnect from './OAuthConnect';

export default function AddDestinationDialog({ onAdd, onClose }) {
  const [destType, setDestType] = useState('local_server');
  const [destLabel, setDestLabel] = useState('Server Sekolah');
  const [config, setConfig] = useState({});
  const [oauthConfig, setOauthConfig] = useState(null);

  const serverUrl = getServerUrl() || 'http://192.168.1.100:3001';

  function handleSubmit(e) {
    e.preventDefault();
    onAdd({
      destType,
      destLabel,
      destConfig: oauthConfig || config,
      priority: 1,
    });
  }

  function handleOAuthConnected({ provider, email, rcloneConfig }) {
    setOauthConfig(rcloneConfig);
    setDestLabel(provider === 'google' ? `Google Drive - ${email}` : `OneDrive - ${email}`);
  }

  function handleOAuthDisconnected() {
    setOauthConfig(null);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-medium text-gray-900 mb-4">Tambah Tujuan Backup</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Tipe Tujuan</label>
            <select value={destType}
              onChange={e => {
                setDestType(e.target.value);
                setOauthConfig(null);
                setDestLabel(
                  e.target.value === 'local_server' ? 'Server Sekolah' :
                  e.target.value === 'google_drive' ? 'Google Drive' :
                  e.target.value === 'onedrive' ? 'OneDrive' : 'Lokal'
                );
                setConfig({});
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="local_server">🏫 Server Sekolah (LAN)</option>
              <option value="google_drive">📗 Google Drive (OAuth)</option>
              <option value="onedrive">🔵 Microsoft OneDrive (OAuth)</option>
              <option value="local">💾 Folder Lokal / External</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Label</label>
            <input type="text" value={destLabel}
              onChange={e => setDestLabel(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>

          {/* Config fields per dest type */}
          {destType === 'local_server' && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Alamat Server</label>
                <input type="text" value={config.host || new URL(serverUrl).hostname}
                  onChange={e => setConfig({ ...config, host: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-0.5">Username</label>
                  <input type="text" value={config.username || ''}
                    onChange={e => setConfig({ ...config, username: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-0.5">Path Remote</label>
                  <input type="text" value={config.path || '/backup'}
                    onChange={e => setConfig({ ...config, path: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded text-sm font-mono" />
                </div>
              </div>
            </div>
          )}

          {/* Google Drive OAuth */}
          {destType === 'google_drive' && (
            <div className="space-y-3">
              <OAuthConnect
                provider="google"
                onConnected={handleOAuthConnected}
                onDisconnect={handleOAuthDisconnected}
              />
              {oauthConfig && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                  ✅ Google Drive terhubung dan siap digunakan
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Folder (opsional)</label>
                <input type="text" value={config.folder || 'Sisbackup'}
                  onChange={e => setConfig({ ...config, folder: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
            </div>
          )}

          {/* OneDrive OAuth */}
          {destType === 'onedrive' && (
            <div className="space-y-3">
              <OAuthConnect
                provider="microsoft"
                onConnected={handleOAuthConnected}
                onDisconnect={handleOAuthDisconnected}
              />
              {oauthConfig && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                  ✅ OneDrive terhubung dan siap digunakan
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Folder (opsional)</label>
                <input type="text" value={config.folder || 'Sisbackup'}
                  onChange={e => setConfig({ ...config, folder: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
            </div>
          )}

          {destType === 'local' && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Path Folder</label>
                <input type="text" value={config.path || 'D:\\Backup'}
                  onChange={e => setConfig({ ...config, path: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm font-mono" />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit"
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
              Tambah Tujuan
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
