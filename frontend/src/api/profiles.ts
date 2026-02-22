/** Profiles API endpoints. */
import { api } from './client';

export interface Profile {
  id: string;
  external_id: string;
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  location_state: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfilesResponse {
  profiles: Profile[];
  total: number;
  page: number;
  page_size: number;
}

export type EnrichmentField =
  | 'name'
  | 'title'
  | 'headline'
  | 'email'
  | 'linkedin_url'
  | 'twitter_url'
  | 'github_url'
  | 'facebook_url'
  | 'photo_url'
  | 'location'
  | 'organization'
  | 'employment_history';

export interface EnrichProfilesRequest {
  profile_ids: string[];
  fields: EnrichmentField[];
  strategy?: 'auto' | 'single' | 'bulk';
}

export interface EnrichedProfile {
  profile_id: string;
  external_id: string;
  method: 'people_enrichment' | 'bulk_enrichment';
  data: Record<string, unknown>;
}

export interface EnrichProfilesResponse {
  requested: number;
  enriched: number;
  method: 'people_enrichment' | 'bulk_enrichment';
  credits_consumed: number | null;
  results: EnrichedProfile[];
}

export const profilesApi = {
  list: (page = 1, pageSize = 50) =>
    api.get<ProfilesResponse>(`/api/profiles?page=${page}&page_size=${pageSize}`),
  enrich: (payload: EnrichProfilesRequest) =>
    api.post<EnrichProfilesResponse>('/api/profiles/enrich', payload),
};
