import { apiClient } from '@/lib/api/client';

/** The fields the app reads from `GET /api/districts/:id` (server field names). */
export type ApiDistrict = {
  id: string;
  nameFr: string;
  nameEn: string;
};

export async function fetchDistrict(id: string): Promise<ApiDistrict> {
  const { data } = await apiClient.get<ApiDistrict>(`/api/districts/${encodeURIComponent(id)}`);
  return data;
}
