import { useState, useEffect } from 'react';
import { transitionsApi } from '../api/transitions';
import { jobsApi } from '../api/jobs';

interface Message {
  type: 'success' | 'error' | 'info';
  text: string;
}

export function StatsOverview() {
  const [stats, setStats] = useState({
    totalTransitions: 0,
    pendingNotifications: 0,
  });
  const [loading, setLoading] = useState<'detection' | 'ingestion' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadStats = async () => {
    const transitionsResult = await transitionsApi.list(1, 1);
    const totalTransitions = transitionsResult.data?.total || 0;

    const pendingResult = await transitionsApi.list(1, 1, false);
    const pendingNotifications = pendingResult.data?.total || 0;

    setStats({ totalTransitions, pendingNotifications });
  };

  const handleRunDetection = async () => {
    setLoading('detection');
    setMessage({ type: 'info', text: 'Scanning for founder transitions...' });
    
    const result = await jobsApi.runDetection();
    if (result.data) {
      setMessage({
        type: 'success',
        text: `Analysis complete! Detected ${result.data.new_transitions_detected} new signals.`,
      });
      loadStats();
    } else {
      setMessage({ type: 'error', text: result.error || 'Detection failed' });
    }
    setLoading(null);
  };

  const handleTriggerIngestion = async (clearFirst = false) => {
    setLoading('ingestion');
    setMessage({
      type: 'info',
      text: clearFirst ? 'Clearing old data and importing from Apollo...' : 'Importing profiles from Apollo...',
    });

    const result = await jobsApi.triggerIngestion(clearFirst);
    if (result.data) {
      setMessage({
        type: 'success',
        text: `Done! Fetched ${result.data.total_fetched} profiles, ${result.data.stored} matched your criteria.`,
      });
      loadStats();
      window.dispatchEvent(new CustomEvent('profiles-ingested'));
    } else {
      setMessage({ type: 'error', text: result.error || 'Ingestion failed' });
    }
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Message Toast */}
      {message && (
        <div className={`alert ${
          message.type === 'success' ? 'alert-success' : 
          message.type === 'error' ? 'alert-error' : 
          'bg-[var(--accent-blue-light)] text-[var(--accent-blue)] border border-blue-200'
        }`}>
          {message.type === 'success' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : message.type === 'error' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4 spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Stats and Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Signals */}
        <div className="stat-card">
          <p className="stat-label">Total Signals</p>
          <p className="stat-value">{stats.totalTransitions}</p>
        </div>

        {/* Pending */}
        <div className="stat-card">
          <p className="stat-label">Pending</p>
          <p className="stat-value">{stats.pendingNotifications}</p>
        </div>

        {/* Detect Button */}
        <button
          onClick={handleRunDetection}
          disabled={loading !== null}
          className="btn btn-primary h-full flex flex-col items-center justify-center gap-2 py-4"
        >
          {loading === 'detection' ? (
            <>
              <svg className="w-5 h-5 spinner" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Scanning...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm">Detect Founders</span>
            </>
          )}
        </button>

        {/* Import from Apollo — incremental; full reset lives under Settings → Notifications */}
        <button
          onClick={() => handleTriggerIngestion(false)}
          disabled={loading !== null}
          className="btn btn-secondary h-full flex flex-col items-center justify-center gap-2 py-4"
        >
          {loading === 'ingestion' ? (
            <>
              <svg className="w-5 h-5 spinner" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Importing...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-sm">Import from Apollo</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
