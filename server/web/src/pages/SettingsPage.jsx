import { useState, useEffect } from 'react';
import { getConfig, updateConfig, changePassword } from '../lib/api';

export default function SettingsPage() {
  const [config, setConfig] = useState({});
  const [originalConfig, setOriginalConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  useEffect(() => {
    getConfig().then(data => {
      setConfig(data);
      setOriginalConfig(data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      await updateConfig(config);
      setOriginalConfig(config);
      setMessage('✅ Pengaturan berhasil disimpan');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMessage('');
    try {
      await changePassword(currentPassword, newPassword);
      setPwMessage('✅ Password berhasil diubah');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwMessage('❌ ' + err.message);
    }
  }

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Server Settings */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="font-medium text-gray-900">Pengaturan Server</h3>
          <p className="text-xs text-gray-500 mt-0.5">Konfigurasi penyimpanan dan kuota default</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Path Penyimpanan</label>
            <input
              type="text"
              value={config.storage_path || ''}
              onChange={e => setConfig({ ...config, storage_path: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Lokasi file backup disimpan (absolute path)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Kuota (GB)</label>
              <input
                type="number"
                value={Math.floor((parseInt(config.default_quota) || 0) / (1024 ** 3))}
                onChange={e => setConfig({ ...config, default_quota: String(e.target.value * 1024 ** 3) })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retensi Data (hari)</label>
              <input
                type="number"
                value={config.retention_days || '0'}
                onChange={e => setConfig({ ...config, retention_days: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                min={0}
              />
              <p className="text-xs text-gray-400 mt-1">0 = tanpa batas</p>
            </div>
          </div>

          {/* Cloud Bridge (Fase 2 placeholder) */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Cloud Bridge (Fase 2)</h4>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-500">
              <p>Fitur sync ke Siscloud akan tersedia di Fase 2.</p>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={config.cloud_enabled === 'true'}
                  onChange={e => setConfig({ ...config, cloud_enabled: String(e.target.checked) })}
                  className="rounded"
                  disabled
                />
                <span className="text-xs">Cloud sync (belum tersedia)</span>
              </div>
              <input
                type="text"
                value={config.siscloud_url || ''}
                placeholder="https://siscloud.example.com"
                className="w-full px-3 py-1.5 border rounded text-sm mt-2"
                disabled
              />
            </div>
          </div>
        </div>

        {hasChanges && (
          <div className="px-6 pb-4 flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            <button onClick={() => { setConfig(originalConfig); setMessage(''); }}
              className="text-sm text-gray-500 hover:text-gray-700">
              Reset
            </button>
            {message && <span className="text-sm">{message}</span>}
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="font-medium text-gray-900">Ubah Password</h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Password Saat Ini</label>
              <input type="password" value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Password Baru</label>
              <input type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" required minLength={6} />
            </div>
            {pwMessage && <div className="text-sm">{pwMessage}</div>}
            <button type="submit"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
              Ubah Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
