/** Jobs API endpoints. */
import { api } from './client';

export interface DetectionResult {
  message: string;
  new_transitions_detected: number;
  notifications_sent: number;
}

export interface IngestionResult {
  message: string;
  total_fetched: number;
  filtered: number;
  stored: number;
}

export const jobsApi = {
  runDetection: () => api.post<DetectionResult>('/api/jobs/run-detection'),
  triggerIngestion: (clearFirst = false) =>
    api.post<IngestionResult>(`/api/profiles/ingest?clear_first=${clearFirst}`),
};

