import { type District, normalizeDistrict } from '@/components/map/map-utils';
import { apiClient } from '@/lib/api/client';

/** The fields the app reads from `GET /api/districts/:id` (server field names). */
export type ApiDistrict = {
  id: string;
  nameFr: string;
  nameEn: string;
  openNorthSlug?: string;
  districtType?: 'borough' | 'municipality';
  postalCode?: string | null;
  managerId?: string | null;
  managerUsername?: string | null;
  isClaimed?: boolean;
};

export async function fetchDistrict(id: string): Promise<ApiDistrict> {
  const { data } = await apiClient.get<ApiDistrict>(`/api/districts/${encodeURIComponent(id)}`);
  return data;
}

export async function fetchDistricts(): Promise<District[]> {
  const { data } = await apiClient.get<Record<string, unknown>[]>('/api/districts');
  return Array.isArray(data) ? data.map(normalizeDistrict) : [];
}
