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

export const profilesApi = {
  list: (page = 1, pageSize = 50) =>
    api.get<ProfilesResponse>(`/api/profiles?page=${page}&page_size=${pageSize}`),
};
