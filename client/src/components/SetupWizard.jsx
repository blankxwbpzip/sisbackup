import { useState } from 'react';
import { setServerUrl } from '../lib/api';

const STEPS = ['Selamat Datang', 'Koneksi Server', 'Selesai'];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [serverAddress, setServerAddress] = useState('http://192.168.1.100:3001');
  const [usePersonalDrive, setUsePersonalDrive] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  async function testConnection() {
    setTesting(true);
    setTestResult('');
    try {
      const url = serverAddress.replace(/\/+$/, '');
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setTestResult(`✅ Terhubung! Server: v${data.version}, ${data.platform}`);
    } catch (e) {
      setTestResult('❌ Gagal terhubung. Pastikan server berjalan dan alamat benar.');
    } finally {
      setTesting(false);
    }
  }

  function handleFinish() {
    setServerUrl(serverAddress.replace(/\/+$/, ''));
    localStorage.setItem('sisbackup_use_personal_drive', usePersonalDrive ? 'true' : 'false');
    onComplete();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 to-primary-950 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <div className="text-center mb-6">
          <span className="text-5xl">📦</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Sisbackup</h1>
          <p className="text-gray-500 text-sm">Setup Awal — {STEPS[step]}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step >= i ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > i ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${step > i ? 'bg-primary-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-4 text-center">
            <p className="text-gray-600">
              Sisbackup membantu Anda mem-backup data penting ke server sekolah dan/atau drive pribadi Anda secara otomatis.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700 text-left space-y-2">
              <p>💡 <strong>Yang perlu disiapkan:</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Alamat IP server Sisbackup di sekolah</li>
                <li>Akun yang dibuat oleh operator/admin</li>
                <li>Folder yang ingin di-backup</li>
              </ul>
            </div>
            <button onClick={() => setStep(1)}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 mt-4">
              Lanjutkan
            </button>
          </div>
        )}

        {/* Step 1: Server Connection */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Server Sekolah</label>
              <input
                type="text"
                value={serverAddress}
                onChange={e => setServerAddress(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="http://192.168.1.100:3001"
              />
              <p className="text-xs text-gray-400 mt-1">Masukkan alamat IP dan port server Sisbackup</p>
            </div>

            <button onClick={testConnection} disabled={testing}
              className="w-full border border-primary-300 text-primary-700 py-2 rounded-lg text-sm font-medium hover:bg-primary-50 disabled:opacity-50">
              {testing ? 'Mengecek...' : '🔍 Test Koneksi'}
            </button>
            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${testResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {testResult}
              </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={usePersonalDrive}
                onChange={e => setUsePersonalDrive(e.target.checked)}
                className="rounded"
                id="useDrive"
              />
              <label htmlFor="useDrive" className="text-sm text-gray-700">
                Saya juga ingin backup ke Google Drive / OneDrive pribadi
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(0)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm hover:bg-gray-50">
                Kembali
              </button>
              <button onClick={() => { setServerUrl(serverAddress.replace(/\/+$/, '')); setStep(2); }}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700">
                Lanjutkan
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Finish */}
        {step === 2 && (
          <div className="space-y-4 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-gray-700 font-medium">Setup selesai!</p>
            <p className="text-gray-500 text-sm">
              Server: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{serverAddress}</code>
            </p>
            {usePersonalDrive && (
              <p className="text-gray-500 text-sm">Anda dapat menambahkan Drive pribadi nanti di pengaturan.</p>
            )}
            <button onClick={handleFinish}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 mt-4">
              Mulai Gunakan Sisbackup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
