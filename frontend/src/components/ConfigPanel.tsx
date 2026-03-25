import { useState, useEffect } from 'react';
import { configApi, type Config, type SearchFilters } from '../api/config';
import { jobsApi } from '../api/jobs';

interface ConfigPanelProps {
  section: 'companies' | 'locations' | 'filters' | 'notifications';
}

export function ConfigPanel({ section }: ConfigPanelProps) {
  const [config, setConfig] = useState<Config | null>(null);
  const [companies, setCompanies] = useState<string>('');
  const [states, setStates] = useState<string>('');
  const [personTitles, setPersonTitles] = useState<string>('');
  const [orgLocations, setOrgLocations] = useState<string>('');
  const [perPage, setPerPage] = useState<number>(100);
  const [minYearsExp, setMinYearsExp] = useState<string>('');
  const [maxYearsExp, setMaxYearsExp] = useState<string>('');
  const [loading, setLoading] = useState<'companies' | 'states' | 'filters' | 'reimport' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadConfig = async () => {
    const result = await configApi.get();
    if (result.data) {
      setConfig(result.data);
      setCompanies(result.data.target_companies.join('\n'));
      setStates((result.data.target_states || []).join(', '));
      
      // Load search filters
      const filters = result.data.search_filters || {};
      setPersonTitles((filters.person_titles || []).join('\n'));
      setOrgLocations((filters.organization_locations || []).join('\n'));
      setPerPage(filters.per_page ?? 100);
      setMinYearsExp(
        filters.min_years_experience != null ? String(filters.min_years_experience) : ''
      );
      setMaxYearsExp(
        filters.max_years_experience != null ? String(filters.max_years_experience) : ''
      );
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to load config' });
    }
  };

  const handleSaveCompanies = async () => {
    setLoading('companies');
    setMessage(null);
    const companyList = companies.split('\n').filter(c => c.trim());
    const result = await configApi.setCompanies(companyList);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: `Successfully saved ${companyList.length} companies` });
      loadConfig();
    }
    setLoading(null);
  };

  const handleSaveStates = async () => {
    setLoading('states');
    setMessage(null);
    const stateList = states.split(',').map(s => s.trim()).filter(s => s);
    const result = await configApi.setStates(stateList);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({
        type: 'success',
        text:
          stateList.length === 0
            ? 'Saved: searching all US locations (no state filter)'
            : `Successfully saved ${stateList.length} states`,
      });
      loadConfig();
    }
    setLoading(null);
  };

  const handleSaveFilters = async () => {
    setLoading('filters');
    setMessage(null);

    const titlesList = personTitles.split('\n').filter(t => t.trim()).map(t => t.trim());
    const locationsList = orgLocations.split('\n').filter(l => l.trim()).map(l => l.trim());
    const minTrim = minYearsExp.trim();
    const maxTrim = maxYearsExp.trim();
    let minNum: number | null = null;
    let maxNum: number | null = null;
    if (minTrim !== '') {
      minNum = parseInt(minTrim, 10);
      if (Number.isNaN(minNum) || minNum < 0) {
        setMessage({ type: 'error', text: 'Min years of experience must be a number ≥ 0' });
        setLoading(null);
        return;
      }
    }
    if (maxTrim !== '') {
      maxNum = parseInt(maxTrim, 10);
      if (Number.isNaN(maxNum) || maxNum < 0) {
        setMessage({ type: 'error', text: 'Max years of experience must be a number ≥ 0' });
        setLoading(null);
        return;
      }
    }
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      setMessage({ type: 'error', text: 'Min years cannot be greater than max years' });
      setLoading(null);
      return;
    }

    const filters: SearchFilters = {
      person_titles: titlesList.length > 0 ? titlesList : null,
      organization_locations: locationsList.length > 0 ? locationsList : null,
      per_page: perPage,
      min_years_experience: minNum,
      max_years_experience: maxNum,
    };

    const result = await configApi.updateSearchFilters(filters);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Search filters updated successfully' });
      loadConfig();
    }
    setLoading(null);
  };

  const handleClearAndReimport = async () => {
    if (
      !window.confirm(
        'This deletes all tracked profiles and related data, then re-imports from Apollo using your current settings. Continue?'
      )
    ) {
      return;
    }
    setLoading('reimport');
    setMessage(null);
    const result = await jobsApi.triggerIngestion(true);
    if (result.data) {
      setMessage({
        type: 'success',
        text: `Re-import complete: fetched ${result.data.total_fetched} profiles, ${result.data.stored} matched your criteria.`,
      });
      loadConfig();
      window.dispatchEvent(new CustomEvent('profiles-ingested'));
    } else {
      setMessage({ type: 'error', text: result.error || 'Re-import failed' });
    }
    setLoading(null);
  };

  if (section === 'companies') {
    return (
      <div>
        <div className="section-header">
          <h1 className="section-title text-xl">Target Companies</h1>
          <p className="section-description">Define the companies you want to track for founder transitions</p>
        </div>

        {message && (
          <div className={`alert mb-6 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="card p-6">
          <div className="form-group">
            <label className="form-label">Company List</label>
            <textarea
              value={companies}
              onChange={(e) => setCompanies(e.target.value)}
              placeholder="Enter one company per line&#10;&#10;Example:&#10;Google&#10;Meta&#10;Stripe&#10;OpenAI"
              rows={12}
            />
            <p className="form-hint">
              Enter company names exactly as they appear on LinkedIn. One company per line.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
            <span className="text-sm text-[var(--text-muted)]">
              {companies.split('\n').filter(c => c.trim()).length} companies configured
            </span>
            <button
              onClick={handleSaveCompanies}
              disabled={loading !== null}
              className="btn btn-primary"
            >
              {loading === 'companies' ? (
                <>
                  <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'locations') {
    return (
      <div>
        <div className="section-header">
          <h1 className="section-title text-xl">Target Locations</h1>
          <p className="section-description">
            Optionally narrow by US state. Leave empty to include the entire United States.
          </p>
        </div>

        {message && (
          <div className={`alert mb-6 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="card p-6">
          <div className="form-group">
            <label className="form-label">US State Codes</label>
            <input
              type="text"
              value={states}
              onChange={(e) => setStates(e.target.value)}
              placeholder="CA, NY, TX, WA, MA"
            />
            <p className="form-hint">
              Enter 2-letter US state codes separated by commas (e.g. CA, NY). Leave blank to search all US states.
            </p>
          </div>

          <div className="mt-4">
            <p className="form-label mb-3">Quick Select</p>
            <div className="flex flex-wrap gap-2">
              {['CA', 'NY', 'TX', 'WA', 'MA', 'IL', 'FL', 'CO', 'GA', 'NC'].map(state => {
                const isSelected = states.toUpperCase().includes(state);
                return (
                  <button
                    key={state}
                    onClick={() => {
                      if (isSelected) {
                        setStates(states.split(',').filter(s => s.trim().toUpperCase() !== state).join(', '));
                      } else {
                        setStates(states ? `${states}, ${state}` : state);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      isSelected 
                        ? 'bg-[var(--accent-purple)] text-white' 
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {state}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 mt-6 border-t border-[var(--border-subtle)]">
            <span className="text-sm text-[var(--text-muted)]">
              {states.split(',').filter(s => s.trim()).length === 0
                ? 'All US (no state filter)'
                : `${states.split(',').filter(s => s.trim()).length} states selected`}
            </span>
            <button
              onClick={handleSaveStates}
              disabled={loading !== null}
              className="btn btn-primary"
            >
              {loading === 'states' ? (
                <>
                  <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'filters') {
    return (
      <div>
        <div className="section-header">
          <h1 className="section-title text-xl">Apollo Search Filters</h1>
          <p className="section-description">Configure additional filters for the Apollo People API Search</p>
        </div>

        {message && (
          <div className={`alert mb-6 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Person Titles */}
          <div className="card p-6">
            <div className="form-group">
              <label className="form-label">Job Titles (Optional)</label>
              <textarea
                value={personTitles}
                onChange={(e) => setPersonTitles(e.target.value)}
                placeholder="Enter one job title per line&#10;&#10;Example:&#10;sales director&#10;director sales&#10;director, sales&#10;VP of Engineering"
                rows={8}
              />
              <p className="form-hint">
                Filter people by specific job titles. Leave empty to include all titles. One title per line.
              </p>
            </div>
          </div>

          {/* Organization Locations */}
          <div className="card p-6">
            <div className="form-group">
              <label className="form-label">Organization Locations (Optional)</label>
              <textarea
                value={orgLocations}
                onChange={(e) => setOrgLocations(e.target.value)}
                placeholder="Enter one location per line&#10;&#10;Example:&#10;California, US&#10;New York, US&#10;Texas, US"
                rows={6}
              />
              <p className="form-hint">
                Filter by company headquarters location (not personal location). One location per line in format "State, Country".
              </p>
            </div>
          </div>

          {/* Years of experience (Apollo total YOE) */}
          <div className="card p-6">
            <div className="form-group">
              <label className="form-label">Years of Work Experience (Optional)</label>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[8rem]">
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Minimum</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={minYearsExp}
                    onChange={(e) => setMinYearsExp(e.target.value)}
                    placeholder="Any"
                  />
                </div>
                <div className="flex-1 min-w-[8rem]">
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Maximum</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={maxYearsExp}
                    onChange={(e) => setMaxYearsExp(e.target.value)}
                    placeholder="Any"
                  />
                </div>
              </div>
              <p className="form-hint mt-2">
                Maps to Apollo total years of experience. Leave both empty for no experience filter.
              </p>
            </div>
          </div>

          {/* Results Per Page */}
          <div className="card p-6">
            <div className="form-group">
              <label className="form-label">Results Per Page</label>
              <input
                type="number"
                value={perPage}
                onChange={(e) => setPerPage(Math.min(100, Math.max(1, parseInt(e.target.value) || 100)))}
                min={1}
                max={100}
              />
              <p className="form-hint">
                Number of results to fetch per page (1-100). Default is 100. Higher values = fewer API calls but longer response times.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="card p-6 bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Search Filters</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  These filters are optional and work together with target companies and locations.
                </p>
              </div>
              <button
                onClick={handleSaveFilters}
                disabled={loading !== null}
                className="btn btn-primary"
              >
                {loading === 'filters' ? (
                  <>
                    <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Filters
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'notifications') {
    return (
      <div>
        <div className="section-header">
          <h1 className="section-title text-xl">Notification Settings</h1>
          <p className="section-description">Configure how and when you receive founder alerts</p>
        </div>

        {message && (
          <div className={`alert mb-6 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="card p-6 mb-6">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Email Notifications</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Daily Digest</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Receive a summary of all new founder signals</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-[var(--bg-hover)] peer-focus:ring-2 peer-focus:ring-[var(--accent-purple-light)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-purple)]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Instant Alerts</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Get notified immediately when a founder is detected</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-9 h-5 bg-[var(--bg-hover)] peer-focus:ring-2 peer-focus:ring-[var(--accent-purple-light)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-purple)]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Weekly Report</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Comprehensive weekly summary with analytics</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-[var(--bg-hover)] peer-focus:ring-2 peer-focus:ring-[var(--accent-purple-light)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-purple)]"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">System Status</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <p className="stat-label">Last Data Sync</p>
              <p className="stat-value text-lg">
                {config?.last_ingestion 
                  ? new Date(config.last_ingestion).toLocaleDateString()
                  : '—'
                }
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Last Detection</p>
              <p className="stat-value text-lg">
                {config?.last_detection 
                  ? new Date(config.last_detection).toLocaleDateString()
                  : '—'
                }
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Clear all stored profiles and fetch fresh results from Apollo (uses your current companies, locations, and filters).
            </p>
            <button
              type="button"
              onClick={handleClearAndReimport}
              disabled={loading !== null}
              className="btn btn-secondary text-sm"
            >
              {loading === 'reimport' ? (
                <>
                  <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Re-importing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear database &amp; re-import from Apollo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
