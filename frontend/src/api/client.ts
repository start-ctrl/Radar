/** API client for backend communication. */
// Use relative URL in dev (Vite proxies /api to backend); override with VITE_API_URL for production
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const AUTH_KEY = 'radar_auth';

// Basic auth: use sessionStorage (from login) or env vars
const getAuthHeader = (): string => {
  const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTH_KEY) : null;
  if (stored) return `Basic ${stored}`;
  const username = import.meta.env.VITE_AUTH_USERNAME || 'admin';
  const password = import.meta.env.VITE_AUTH_PASSWORD || 'changeme';
  return `Basic ${btoa(`${username}:${password}`)}`;
};

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return { error: error.detail || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

