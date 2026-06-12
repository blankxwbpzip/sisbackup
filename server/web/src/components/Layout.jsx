import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/users', label: 'Pengguna', icon: '👥' },
  { path: '/logs', label: 'Log Sync', icon: '📋' },
  { path: '/settings', label: 'Pengaturan', icon: '⚙️' },
];

export default function Layout({ user, onLogout, children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-primary-900 text-white transition-all duration-200 flex flex-col`}>
        <div className="p-4 flex items-center gap-3 border-b border-primary-800">
          <span className="text-2xl">📦</span>
          {sidebarOpen && <span className="font-bold text-lg">Sisbackup</span>}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-100 hover:bg-primary-800'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-primary-800">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full text-primary-300 hover:text-white text-sm p-1"
          >
            {sidebarOpen ? '◀ Collapse' : '▶'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">
            {NAV_ITEMS.find(i => i.path === location.pathname)?.label || 'Dashboard'}
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user.displayName} ({user.role === 'admin' ? 'Admin' : 'User'})
            </span>
            <button
              onClick={onLogout}
              className="text-sm text-gray-500 hover:text-danger transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
