import { useState, useEffect } from 'react';
import { profilesApi, type ProfilesResponse } from '../api/profiles';

export function ProfilesTable() {
  const [data, setData] = useState<ProfilesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, [page]);

  useEffect(() => {
    const onIngested = () => loadProfiles();
    window.addEventListener('profiles-ingested', onIngested);
    return () => window.removeEventListener('profiles-ingested', onIngested);
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    const result = await profilesApi.list(page, 20);
    if (result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Failed to load');
    }
    setLoading(false);
  };

  if (loading && !data) {
    return (
      <div className="card p-12">
        <div className="flex flex-col items-center justify-center gap-3">
          <svg className="w-6 h-6 text-[var(--accent-purple)] spinner" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[var(--text-muted)]">Loading profiles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  if (!data || data.profiles.length === 0) {
    return (
      <div className="card p-12">
        <div className="empty-state">
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">No Profiles Yet</h3>
          <p className="text-sm">Configure target companies and locations, then click Sync Data to fetch profiles from Apollo.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Tracked Profiles</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{data.total} total (from Apollo People API Search)</p>
        </div>
        <button onClick={loadProfiles} className="btn btn-secondary py-1.5 px-3 text-xs">
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Company</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {data.profiles.map((profile) => (
            <tr key={profile.id}>
              <td>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-purple-light)] flex items-center justify-center text-xs font-medium text-[var(--accent-purple)]">
                    {profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="font-medium text-[var(--text-primary)]">{profile.full_name}</span>
                </div>
              </td>
              <td>{profile.current_title || '—'}</td>
              <td>{profile.current_company || '—'}</td>
              <td>{profile.location_state || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="btn btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
