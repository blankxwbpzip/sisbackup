import { useState, useEffect } from 'react';

/**
 * OAuth connection UI for Google Drive & OneDrive
 *
 * Flow:
 * 1. User clicks "Connect" → gets auth URL from server
 * 2. Opens browser for user authorization
 * 3. Server exchanges code for tokens (via callback endpoint)
 * 4. Polls status until connected
 */
export default function OAuthConnect({ provider, onConnected, onDisconnect }) {
  const [status, setStatus] = useState({ connected: false, loading: true, email: null });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const isGoogle = provider === 'google';
  const providerName = isGoogle ? 'Google Drive' : 'Microsoft OneDrive';
  const providerIcon = isGoogle ? '📗' : '🔵';

  const apiBase = window.__TAURI_INTERNALS__
    ? localStorage.getItem('sisbackup_server') || ''
    : '';

  useEffect(() => {
    checkStatus();
  }, [provider]);

  async function checkStatus() {
    try {
      const token = localStorage.getItem('sisbackup_token');
      if (!token) { setStatus({ connected: false, loading: false }); return; }

      const res = await fetch(`${apiBase}/api/oauth/${provider}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStatus({ ...data, loading: false });
    } catch {
      setStatus({ connected: false, loading: false });
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setError('');
    try {
      const token = localStorage.getItem('sisbackup_token');
      if (!token) throw new Error('Not logged in');

      // Step 1: Get OAuth URL from server
      const urlRes = await fetch(`${apiBase}/api/oauth/${provider}/url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { url, state } = await urlRes.json();

      // Step 2: Open browser for user authorization
      // In Tauri, use shell open; in browser dev mode, open new tab
      if (window.__TAURI_INTERNALS__) {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
      } else {
        window.open(url, '_blank', 'width=600,height=700');
      }

      // Step 3: Show manual code entry (fallback for Tauri)
      // In production, Tauri would intercept the redirect with a custom protocol.
      // For now, we poll the server or let the user paste the code.
      const code = prompt(
        `Setelah otorisasi, Anda akan diarahkan ke halaman dengan kode.\n\n` +
        `Salin kode "code=" dari URL dan tempel di sini:\n\n` +
        `(URL otorisasi telah dibuka di browser)`
      );

      if (!code) {
        setConnecting(false);
        return;
      }

      // Step 4: Send code to server for token exchange
      const cbRes = await fetch(`${apiBase}/api/oauth/${provider}/callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!cbRes.ok) {
        const err = await cbRes.json();
        throw new Error(err.error || 'Token exchange failed');
      }

      const data = await cbRes.json();
      setStatus({ connected: true, email: data.email, loading: false });

      if (onConnected) {
        onConnected({
          provider,
          email: data.email,
          rcloneConfig: data.rcloneConfig,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Putuskan koneksi ${providerName}?`)) return;
    try {
      const token = localStorage.getItem('sisbackup_token');
      await fetch(`${apiBase}/api/oauth/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus({ connected: false, loading: false, email: null });
      if (onDisconnect) onDisconnect(provider);
    } catch (err) {
      setError(err.message);
    }
  }

  if (status.loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
        <span className="text-sm text-gray-500">Memeriksa koneksi...</span>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{providerIcon}</span>
          <div>
            <div className="font-medium text-sm">{providerName}</div>
            {status.connected && status.email ? (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Terhubung: {status.email}
              </div>
            ) : (
              <div className="text-xs text-gray-400">Belum terhubung</div>
            )}
          </div>
        </div>

        {status.connected ? (
          <button
            onClick={handleDisconnect}
            className="text-xs text-red-500 hover:text-red-700 px-3 py-1 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Putuskan
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="text-xs bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            {connecting ? 'Menghubungkan...' : 'Hubungkan'}
          </button>
        )}
      </div>

      {connecting && (
        <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
          Buka browser Anda dan izinkan akses, lalu tempel kode dari URL di dialog.
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
      )}
    </div>
  );
}
