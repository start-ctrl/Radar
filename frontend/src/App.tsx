import { useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { TransitionsTable } from './components/TransitionsTable';
import { ProfilesTable } from './components/ProfilesTable';
import { StatsOverview } from './components/StatsOverview';
import { Login } from './components/Login';
import { useAuth } from './contexts/AuthContext';

type Tab = 'signals' | 'companies' | 'locations' | 'filters' | 'notifications';

function App() {
  const { isLoggedIn, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('signals');

  if (!isLoggedIn) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-purple)] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
              </svg>
            </div>
            <span className="font-semibold text-[var(--text-primary)]">Radar</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <div className="mb-2 px-3 py-2">
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Dashboard</span>
          </div>
          
          <button
            onClick={() => setActiveTab('signals')}
            className={`sidebar-nav-item ${activeTab === 'signals' ? 'active' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Signals
          </button>

          <div className="mt-6 mb-2 px-3 py-2">
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Settings</span>
          </div>

          <button
            onClick={() => setActiveTab('companies')}
            className={`sidebar-nav-item ${activeTab === 'companies' ? 'active' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Target Companies
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`sidebar-nav-item ${activeTab === 'locations' ? 'active' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Target Locations
          </button>

          <button
            onClick={() => setActiveTab('filters')}
            className={`sidebar-nav-item ${activeTab === 'filters' ? 'active' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Search Filters
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`sidebar-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </button>
        </nav>

        {/* Status & Logout */}
        <div className="p-4 border-t border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-green)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-green)]"></span>
            </span>
            System Online
          </div>
          <button
            onClick={logout}
            className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] py-1.5"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          {activeTab === 'signals' && (
            <div className="animate-fade-in">
              <div className="section-header">
                <h1 className="section-title text-xl">Founder Signals</h1>
                <p className="section-description">Track career transitions to entrepreneurial roles</p>
              </div>
              <StatsOverview />
              <div className="mt-8">
                <ProfilesTable />
              </div>
              <div className="mt-8">
                <TransitionsTable />
              </div>
            </div>
          )}
          
          {activeTab === 'companies' && (
            <div className="animate-fade-in">
              <ConfigPanel section="companies" />
            </div>
          )}
          
          {activeTab === 'locations' && (
            <div className="animate-fade-in">
              <ConfigPanel section="locations" />
            </div>
          )}
          
          {activeTab === 'filters' && (
            <div className="animate-fade-in">
              <ConfigPanel section="filters" />
            </div>
          )}
          
          {activeTab === 'notifications' && (
            <div className="animate-fade-in">
              <ConfigPanel section="notifications" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
