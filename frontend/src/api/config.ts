/** Configuration API endpoints. */
import { api } from './client';

export interface SearchFilters {
  person_titles?: string[] | null;
  organization_locations?: string[] | null;
  organization_num_employees?: any;
  seniority?: string[] | null;
  min_years_experience?: number | null;
  max_years_experience?: number | null;
  per_page?: number | null;
}

export interface Config {
  target_companies: string[];
  target_states: string[];
  search_filters?: SearchFilters;
  last_ingestion: string | null;
  last_detection: string | null;
}

export const configApi = {
  get: () => api.get<Config>('/api/config'),
  setCompanies: (companies: string[]) =>
    api.post('/api/config/companies', { companies }),
  setStates: (states: string[]) =>
    api.patch('/api/config/states', { states }),
  updateSearchFilters: (filters: SearchFilters) =>
    api.patch('/api/config/search-filters', filters),
};

