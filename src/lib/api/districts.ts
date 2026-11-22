import { type District, normalizeDistrict } from '@/components/utils/map-utils';
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

export type LocateDistrictResult = {
  district: District;
  openNorth: {
    name: string;
    slug: string;
    boundarySet: string;
  };
};

/**
 * Resolves the Montreal borough or municipality containing `(latitude, longitude)` via the
 * server's OpenNorth Represent integration (`GET /api/districts/locate`).
 */
export async function locateDistrictByCoordinates(
  latitude: number,
  longitude: number,
): Promise<LocateDistrictResult> {
  const { data } = await apiClient.get<{
    district: Record<string, unknown>;
    openNorth: LocateDistrictResult['openNorth'];
  }>(
    `/api/districts/locate?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
  );
  return {
    district: normalizeDistrict(data.district),
    openNorth: data.openNorth,
  };
}
