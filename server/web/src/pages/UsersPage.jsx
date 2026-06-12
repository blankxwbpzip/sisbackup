import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUserQuota, updateUserStatus, resetUserPassword, deleteUser, importUsers } from '../lib/api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function UserRow({ user, onRefresh }) {
  const [showActions, setShowActions] = useState(false);
  const [showQuota, setShowQuota] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [quotaGB, setQuotaGB] = useState(Math.floor(user.quotaBytes / (1024 ** 3)));
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function handleToggleStatus() {
    setActionLoading(true);
    try {
      await updateUserStatus(user.id, !user.isActive);
      onRefresh();
    } finally { setActionLoading(false); }
  }

  async function handleQuota() {
    setActionLoading(true);
    try {
      await updateUserQuota(user.id, quotaGB * 1024 ** 3);
      setShowQuota(false);
      onRefresh();
    } finally { setActionLoading(false); }
  }

  async function handleResetPassword() {
    if (newPassword.length < 6) return;
    setActionLoading(true);
    try {
      await resetUserPassword(user.id, newPassword);
      setShowPassword(false);
      setNewPassword('');
    } finally { setActionLoading(false); }
  }

  async function handleDelete() {
    if (!confirm(`Hapus user ${user.username}?`)) return;
    setActionLoading(true);
    try {
      await deleteUser(user.id);
      onRefresh();
    } finally { setActionLoading(false); }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{user.displayName}</div>
        <div className="text-xs text-gray-500">{user.username}</div>
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatBytes(user.usedBytes)} / {formatBytes(user.quotaBytes)}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-500 ml-1">{user.isActive ? 'Aktif' : 'Nonaktif'}</span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(user.createdAt).toLocaleDateString('id-ID')}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="relative">
          <button onClick={() => setShowActions(!showActions)}
            className="text-gray-400 hover:text-gray-600 text-lg">⋮</button>

          {showActions && (
            <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 w-44"
              onMouseLeave={() => setShowActions(false)}>
              <button onClick={() => { setShowQuota(true); setShowActions(false); }}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">Atur Kuota</button>
              <button onClick={() => { setShowPassword(true); setShowActions(false); }}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">Reset Password</button>
              <button onClick={() => { handleToggleStatus(); setShowActions(false); }}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
                {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              {user.role !== 'admin' && (
                <button onClick={() => { handleDelete(); setShowActions(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Hapus</button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'user', quotaGB: 5 });
  const [formError, setFormError] = useState('');
  const [importData, setImportData] = useState('');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      const data = await getUsers();
      setUsers(data);
    } finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    try {
      await createUser({
        username: form.username,
        password: form.password,
        displayName: form.displayName,
        role: form.role,
        quotaBytes: form.quotaGB * 1024 ** 3,
      });
      setShowAdd(false);
      setForm({ username: '', password: '', displayName: '', role: 'user', quotaGB: 5 });
      loadUsers();
    } catch (err) { setFormError(err.message); }
  }

  async function handleImport(e) {
    e.preventDefault();
    try {
      const lines = importData.trim().split('\n').map(line => {
        const [username, password, displayName, role = 'user'] = line.split(',').map(s => s.trim());
        return { username, password, displayName, role };
      }).filter(u => u.username && u.password);
      if (lines.length === 0) return;
      const result = await importUsers(lines);
      alert(`Import selesai: ${result.created} dibuat, ${result.skipped} dilewati${result.errors.length ? `. Error: ${result.errors.map(e => e.error).join(', ')}` : ''}`);
      setImportData('');
      loadUsers();
    } catch (err) { alert('Import gagal: ' + err.message); }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex gap-3">
        <button onClick={() => setShowAdd(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          + Tambah User
        </button>
        <button onClick={() => setImportData(importData || 'username,password,displayName,role\n')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          📥 Import CSV
        </button>
      </div>

      {/* Add User Form */}
      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-medium text-gray-900 mb-4">Tambah Pengguna Baru</h3>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Username</label>
                <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Password</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm" required minLength={6} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Nama Lengkap</label>
                <input type="text" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Kuota (GB)</label>
                <input type="number" value={form.quotaGB} onChange={e => setForm({ ...form, quotaGB: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded text-sm" min={1} />
              </div>
            </div>
            {formError && <div className="text-sm text-red-600">{formError}</div>}
            <div className="flex gap-2">
              <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">Simpan</button>
              <button type="button" onClick={() => setShowAdd(false)} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Import Form */}
      {importData && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-medium text-gray-900 mb-2">Import CSV</h3>
          <p className="text-xs text-gray-500 mb-3">Format: username,password,displayName,role (role opsional, default: user)</p>
          <textarea value={importData} onChange={e => setImportData(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-mono" rows={6} placeholder="ana@sman1,pass123,Ana Sari,user" />
          <div className="flex gap-2 mt-2">
            <button onClick={handleImport} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">Import</button>
            <button onClick={() => setImportData('')} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">Batal</button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Pengguna</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Usage / Quota</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Dibuat</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? users.map(u => (
              <UserRow key={u.id} user={u} onRefresh={loadUsers} />
            )) : (
              <tr><td colSpan={6} className="text-center text-gray-400 py-10">Belum ada pengguna</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
