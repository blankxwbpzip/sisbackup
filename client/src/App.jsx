import { useState, useEffect } from 'react';
import { getToken, getProfile, setToken } from './lib/api';
import SetupWizard from './components/SetupWizard';
import MainScreen from './components/MainScreen';
import LoginScreen from './components/LoginScreen';

const SCREENS = {
  LOADING: 'loading',
  LOGIN: 'login',
  SETUP: 'setup',
  MAIN: 'main',
};

export default function App() {
  const [screen, setScreen] = useState(SCREENS.LOADING);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkState();
    // Listen for tray events
    if (window.__TAURI_INTERNALS__) {
      const setupListeners = async () => {
        const { listen } = await import('@tauri-apps/api/event');
        listen('tray-force-sync', () => {
          window.dispatchEvent(new CustomEvent('force-sync'));
        });
        listen('tray-pause', () => {
          window.dispatchEvent(new CustomEvent('toggle-pause'));
        });
      };
      setupListeners();
    }
  }, []);

  async function checkState() {
    try {
      // Check if already logged in
      const token = getToken();
      if (token) {
        const profile = await getProfile();
        setUser(profile);
        setScreen(SCREENS.MAIN);
      } else {
        setScreen(SCREENS.LOGIN);
      }
    } catch {
      setScreen(SCREENS.LOGIN);
    }
    // If no setup at all, show setup wizard
    const hasRunBefore = localStorage.getItem('sisbackup_setup_done');
    if (!hasRunBefore) {
      setScreen(SCREENS.SETUP);
    }
  }

  function handleSetupComplete() {
    localStorage.setItem('sisbackup_setup_done', 'true');
    setScreen(SCREENS.LOGIN);
  }

  function handleLogin(userData) {
    setUser(userData);
    setScreen(SCREENS.MAIN);
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setScreen(SCREENS.LOGIN);
  }

  if (screen === SCREENS.LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Memuat Sisbackup...</p>
        </div>
      </div>
    );
  }

  if (screen === SCREENS.SETUP) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  if (screen === SCREENS.LOGIN) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === SCREENS.MAIN) {
    return <MainScreen user={user} onLogout={handleLogout} />;
  }

  return null;
}
