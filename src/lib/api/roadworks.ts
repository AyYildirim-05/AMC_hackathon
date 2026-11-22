import { apiClient } from '@/lib/api/client';

/** Mirrors the server's grouping of the city's reason labels (`server/src/lib/montreal-roadworks.ts`). */
export const ROADWORK_TYPES = ['roads', 'water', 'utilities', 'building', 'other'] as const;
export type RoadworkType = (typeof ROADWORK_TYPES)[number];
export type RoadworkWhen = 'active' | 'upcoming';

/** One permit from the City of Montréal "Entraves et travaux en cours" open data. */
export type Roadwork = {
  id: string;
  permitId: string | null;
  borough: string;
  /** Street segment, e.g. "Rachel entre Saint-Denis et Berri" (French, as published). */
  location: string;
  /** The city's reason label (French, as published). */
  reason: string;
  type: RoadworkType;
  organization: string | null;
  isCityProject: boolean;
  startDate: string;
  endDate: string;
  latitude: number;
  longitude: number;
};

export type RoadworksResponse = {
  source: { name: string; license: string; url: string };
  fetchedAt: string;
  total: number;
  /** Works per type before the type filter, for the filter chips. */
  typeCounts: Record<RoadworkType, number>;
  works: Roadwork[];
};

export type RoadworksQuery = {
  boroughs: readonly string[];
  types: readonly RoadworkType[];
  cityOnly: boolean;
  when: RoadworkWhen;
};

export async function fetchRoadworks(query: RoadworksQuery): Promise<RoadworksResponse> {
  const params = new URLSearchParams({ when: query.when });
  if (query.boroughs.length > 0) params.set('boroughs', query.boroughs.join(','));
  if (query.types.length > 0) params.set('types', query.types.join(','));
  if (query.cityOnly) params.set('cityOnly', 'true');
  const { data } = await apiClient.get<RoadworksResponse>(`/api/roadworks?${params.toString()}`);
  return data;
}
