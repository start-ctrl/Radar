import { useMemo, useState, useEffect } from 'react';
import {
  profilesApi,
  type ProfilesResponse,
  type EnrichmentField,
} from '../api/profiles';

export function ProfilesTable() {
  const [data, setData] = useState<ProfilesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, boolean>>({});
  const [enriching, setEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  /** Enriched data per profile id – merged into table in place */
  const [enrichedData, setEnrichedData] = useState<Record<string, Record<string, unknown>>>({});
  const [lastEnrichmentMeta, setLastEnrichmentMeta] = useState<{ count: number; credits: number | null } | null>(null);
  const [fields, setFields] = useState<EnrichmentField[]>([
    'name',
    'title',
    'headline',
    'linkedin_url',
    'email',
    'organization',
  ]);

  const availableFields: { id: EnrichmentField; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'title', label: 'Title' },
    { id: 'headline', label: 'Headline' },
    { id: 'linkedin_url', label: 'LinkedIn URL' },
    { id: 'email', label: 'Email (credit-sensitive)' },
    { id: 'organization', label: 'Organization' },
    { id: 'location', label: 'Location' },
    { id: 'employment_history', label: 'Employment History' },
  ];

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

  const selectedIds = useMemo(
    () => Object.entries(selectedProfiles).filter(([, v]) => v).map(([k]) => k),
    [selectedProfiles]
  );

  const toggleField = (field: EnrichmentField) => {
    setFields((prev) => {
      if (prev.includes(field)) {
        const next = prev.filter((f) => f !== field);
        return next.length ? next : prev;
      }
      return [...prev, field];
    });
  };

  const toggleRow = (id: string) => {
    setSelectedProfiles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllVisible = () => {
    if (!data) return;
    const visible = data.profiles.map((p) => p.id);
    const allSelected = visible.every((id) => selectedProfiles[id]);
    const updates: Record<string, boolean> = {};
    visible.forEach((id) => {
      updates[id] = !allSelected;
    });
    setSelectedProfiles((prev) => ({ ...prev, ...updates }));
  };

  const runEnrichment = async () => {
    setEnrichmentError(null);
    setLastEnrichmentMeta(null);
    if (!selectedIds.length) {
      setEnrichmentError('Select at least one profile.');
      return;
    }
    if (selectedIds.length > 10) {
      setEnrichmentError('Select up to 10 profiles at a time to control credits.');
      return;
    }
    setEnriching(true);
    try {
      const result = await profilesApi.enrich({
        profile_ids: selectedIds,
        fields,
        strategy: 'auto',
      });
      if (result.data) {
        const enrichmentData = result.data;
        setEnrichedData((prev) => {
          const next = { ...prev };
          enrichmentData.results.forEach((r) => {
            next[r.profile_id] = r.data;
          });
          return next;
        });
        setLastEnrichmentMeta({
          count: enrichmentData.enriched,
          credits: enrichmentData.credits_consumed ?? null,
        });
      } else {
        setEnrichmentError(result.error || 'Failed to enrich profiles');
      }
    } catch (error) {
      setEnrichmentError('An unexpected error occurred during enrichment');
    }
    setEnriching(false);
  };

  const toDisplayString = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  };

  const getOrganizationDisplay = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const maybeName = (value as Record<string, unknown>).name;
      return toDisplayString(maybeName);
    }
    return '';
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
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Enrichment Controls</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              People Search gives profile names at 0 credits. Enrichment is optional and credit-consuming.
            </p>
          </div>
          <button
            onClick={runEnrichment}
            disabled={enriching || selectedIds.length === 0}
            className="btn btn-primary py-2 px-4 text-sm disabled:opacity-50"
          >
            {enriching ? 'Enriching...' : `Enrich Selected (${selectedIds.length})`}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableFields.map((field) => {
            const selected = fields.includes(field.id);
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => toggleField(field.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  selected
                    ? 'bg-[var(--accent-purple)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {field.label}
              </button>
            );
          })}
        </div>

        {enrichmentError && (
          <p className="mt-3 text-sm text-red-500">{enrichmentError}</p>
        )}
        {lastEnrichmentMeta && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">
            Enriched {lastEnrichmentMeta.count} profile{lastEnrichmentMeta.count !== 1 ? 's' : ''}
            {lastEnrichmentMeta.credits != null ? ` (${lastEnrichmentMeta.credits} credits)` : ''}. Data is shown in the table below.
          </p>
        )}
      </div>

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

      <div className="profiles-table-wrapper">
      <table className="profiles-table">
        <thead>
          <tr>
            <th className="col-checkbox">
              <input
                type="checkbox"
                onChange={toggleAllVisible}
                checked={data.profiles.length > 0 && data.profiles.every((p) => selectedProfiles[p.id])}
              />
            </th>
            <th className="col-name">Name</th>
            <th className="col-title">Title</th>
            <th className="col-company">Company</th>
            <th className="col-location">Location</th>
            <th className="col-email">Email</th>
            <th className="col-linkedin">LinkedIn</th>
            <th className="col-headline">Headline</th>
          </tr>
        </thead>
        <tbody>
          {data.profiles.map((profile) => {
            const enriched = enrichedData[profile.id];
            const name = toDisplayString(enriched?.name) || profile.full_name;
            const title = toDisplayString(enriched?.title) || profile.current_title || '—';
            const company = getOrganizationDisplay(enriched?.organization) || profile.current_company || '—';
            const locationVal = enriched?.location;
            let locationStr = profile.location_state || '—';
            if (locationVal) {
              if (typeof locationVal === 'string') {
                locationStr = locationVal;
              } else if (typeof locationVal === 'object' && locationVal !== null) {
                const locObj = locationVal as Record<string, unknown>;
                const parts = [
                  toDisplayString(locObj.city),
                  toDisplayString(locObj.state),
                  toDisplayString(locObj.country),
                ].filter(Boolean);
                if (parts.length > 0) {
                  locationStr = parts.join(', ');
                }
              }
            }
            const email = toDisplayString(enriched?.email) || '—';
            const linkedinUrl = toDisplayString(enriched?.linkedin_url);
            const headline = toDisplayString(enriched?.headline) || '—';
            return (
              <tr key={profile.id}>
                <td className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={!!selectedProfiles[profile.id]}
                    onChange={() => toggleRow(profile.id)}
                  />
                </td>
                <td className="col-name">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent-purple-light)] flex items-center justify-center text-xs font-medium text-[var(--accent-purple)]">
                      {name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2) : '?'}
                    </div>
                    <span className="font-medium text-[var(--text-primary)]">{name}</span>
                  </div>
                </td>
                <td className="col-title">{title}</td>
                <td className="col-company">{company}</td>
                <td className="col-location">{locationStr}</td>
                <td className="col-email">{email}</td>
                <td className="col-linkedin">
                  {linkedinUrl ? (
                    <a
                      href={linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-purple)] hover:underline text-sm"
                    >
                      View
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="col-headline">{headline}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

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
    </div>
  );
}
