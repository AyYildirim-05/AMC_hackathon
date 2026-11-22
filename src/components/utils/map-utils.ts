import {
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  type Issue,
  type IssueCategory,
  type IssueStatus,
} from '@/models/Issue';

export interface District {
  id: string;
  name_fr: string;
  name_en: string;
  open_north_slug: string;
  district_type: string;
  postal_code?: string | null;
  manager_id: string | null;
  manager_username?: string | null;
  is_claimed: boolean;
  created_at: string;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export type MapLayerMode = 'standard' | 'works' | 'contrast';
export type CategoryFilter = 'all' | IssueCategory;
export type StatusFilter = 'all' | IssueStatus;

export const MAP_LAYER_ORDER: readonly MapLayerMode[] = ['standard', 'works', 'contrast'];

export const MIN_REGION_DELTA = 0.004;
export const MAX_REGION_DELTA = 0.24;

/** Default Montreal map viewport centered between Plateau-Mont-Royal, Ville-Marie, and Rosemont. */
export const MONTREAL_DEFAULT_REGION: MapRegion = {
  latitude: 45.5265,
  longitude: -73.5785,
  latitudeDelta: 0.042,
  longitudeDelta: 0.042,
};

/** Simulated resident beacon near Métro Mont-Royal (fallback when GPS is unavailable). */
export const METRO_MONT_ROYAL_COORDS: LatLng = {
  latitude: 45.5245,
  longitude: -73.5816,
};

/** Real GPS regions for each Montreal borough / municipality in `districts.json`. */
export const BOROUGH_REGIONS: Record<string, MapRegion> = {
  'le-plateau-mont-royal': {
    latitude: 45.5255,
    longitude: -73.5775,
    latitudeDelta: 0.024,
    longitudeDelta: 0.024,
  },
  'ville-marie': {
    latitude: 45.5125,
    longitude: -73.5625,
    latitudeDelta: 0.026,
    longitudeDelta: 0.026,
  },
  'rosemont-la-petite-patrie': {
    latitude: 45.5415,
    longitude: -73.5975,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  },
  westmount: {
    latitude: 45.4855,
    longitude: -73.597,
    latitudeDelta: 0.022,
    longitudeDelta: 0.022,
  },
};

/** Real GPS coordinates for Montreal's REV (Réseau Express Vélo) spines highlighted on the map. */
export const REV_CORRIDORS: readonly {
  id: string;
  name: string;
  coordinates: readonly LatLng[];
}[] = [
  {
    id: 'rev-saint-denis',
    name: 'REV Saint-Denis',
    coordinates: [
      { latitude: 45.5462, longitude: -73.6145 },
      { latitude: 45.5378, longitude: -73.6065 },
      { latitude: 45.5276, longitude: -73.5912 },
      { latitude: 45.5218, longitude: -73.5775 },
      { latitude: 45.5162, longitude: -73.5648 },
      { latitude: 45.5124, longitude: -73.5592 },
    ],
  },
  {
    id: 'rev-rachel',
    name: 'Piste cyclable Rue Rachel Est',
    coordinates: [
      { latitude: 45.5194, longitude: -73.5861 },
      { latitude: 45.5248, longitude: -73.5806 },
      { latitude: 45.5298, longitude: -73.5751 },
      { latitude: 45.5349, longitude: -73.5688 },
      { latitude: 45.5405, longitude: -73.5612 },
    ],
  },
];

function normalizeCategory(raw: unknown): IssueCategory {
  if (typeof raw === 'string' && ISSUE_CATEGORIES.includes(raw as IssueCategory)) {
    return raw as IssueCategory;
  }
  switch (raw) {
    case 'snow_ice':
    case 'trash_cleanliness':
    case 'other':
      return 'roads_potholes';
    case 'parks_trees':
      return 'traffic_safety';
    default:
      return 'roads_potholes';
  }
}

function normalizeStatus(raw: unknown): IssueStatus {
  if (typeof raw === 'string' && ISSUE_STATUSES.includes(raw as IssueStatus)) {
    return raw as IssueStatus;
  }
  if (raw === 'completed') return 'resolved';
  if (raw === 'postponed' || raw === 'cancelled') return 'not_started';
  return 'not_started';
}

/**
 * Normalizes an issue record from the camelCase Express/MongoDB backend
 * (or snake_case payloads) into the frontend `Issue` shape.
 */
export function normalizeIssue(raw: Record<string, unknown>): Issue {
  const id = String(raw.id ?? raw._id ?? '');
  const districtId = String(raw.district_id ?? raw.districtId ?? '');
  const createdById = String(raw.created_by_id ?? raw.createdById ?? '');
  const updatedByRaw = raw.updated_by_id ?? raw.updatedById ?? null;
  const externalRefRaw = raw.external_311_ref ?? raw.external311Ref ?? null;

  return {
    id,
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    category: normalizeCategory(raw.category),
    status: normalizeStatus(raw.status),
    images: Array.isArray(raw.images) ? raw.images.map(String) : [],
    address: String(raw.address ?? ''),
    latitude: Number(raw.latitude ?? MONTREAL_DEFAULT_REGION.latitude),
    longitude: Number(raw.longitude ?? MONTREAL_DEFAULT_REGION.longitude),
    district_id: districtId,
    created_by_id: createdById,
    author: (raw.author as Issue['author']) ?? undefined,
    updated_by_id: updatedByRaw === null ? null : String(updatedByRaw),
    official_response:
      (raw.official_response as Issue['official_response']) ??
      (raw.officialResponse as Issue['official_response']) ??
      null,
    upvote_count: Number(raw.upvote_count ?? raw.upvoteCount ?? 0),
    resolution_confirmations: Number(
      raw.resolution_confirmations ?? raw.resolutionConfirmations ?? 0,
    ),
    comments_count:
      raw.comments_count !== undefined || raw.commentsCount !== undefined
        ? Number(raw.comments_count ?? raw.commentsCount ?? 0)
        : undefined,
    external_311_ref: externalRefRaw === null ? null : String(externalRefRaw),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
    updated_at: String(raw.updated_at ?? raw.updatedAt ?? ''),
  };
}

/**
 * Normalizes a district record from the camelCase Express/MongoDB backend
 * (or snake_case payloads) into the frontend `District` shape.
 */
export function normalizeDistrict(raw: Record<string, unknown>): District {
  const managerRaw = raw.manager_id ?? raw.managerId ?? null;
  const postalRaw = raw.postal_code ?? raw.postalCode ?? null;
  const managerUsernameRaw = raw.manager_username ?? raw.managerUsername ?? null;
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name_fr: String(raw.name_fr ?? raw.nameFr ?? ''),
    name_en: String(raw.name_en ?? raw.nameEn ?? raw.name_fr ?? raw.nameFr ?? ''),
    open_north_slug: String(raw.open_north_slug ?? raw.openNorthSlug ?? ''),
    district_type: String(raw.district_type ?? raw.districtType ?? 'borough'),
    postal_code: postalRaw === null ? null : String(postalRaw),
    manager_id: managerRaw === null ? null : String(managerRaw),
    manager_username: managerUsernameRaw === null ? null : String(managerUsernameRaw),
    is_claimed: Boolean(raw.is_claimed ?? raw.isClaimed ?? false),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  };
}

/** Normalizes text for accent-insensitive, case-insensitive search matching. */
function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface MapFilterCriteria {
  query: string;
  category: CategoryFilter;
  status: StatusFilter;
  districtId: string | 'all';
}

/**
 * Filters issues by search text (title, address, description, `#311` reference,
 * reporter handle, and borough name), category, status, and borough.
 */
export function filterMapIssues(
  issues: readonly Issue[],
  criteria: MapFilterCriteria,
  districts: readonly District[] = [],
): Issue[] {
  const rawQuery = normalizeSearchText(criteria.query.trim());
  const normalizedQuery = rawQuery.replace(/^#+/, '');

  return issues.filter((issue) => {
    if (criteria.category !== 'all' && issue.category !== criteria.category) {
      return false;
    }
    if (criteria.status !== 'all' && issue.status !== criteria.status) {
      return false;
    }
    if (criteria.districtId !== 'all' && issue.district_id !== criteria.districtId) {
      return false;
    }
    if (normalizedQuery.length > 0) {
      const district = districts.find((d) => d.id === issue.district_id);
      const ref = issue.external_311_ref ?? '';
      const searchable = normalizeSearchText(
        [
          issue.title,
          issue.description,
          issue.address,
          ref,
          ref ? `#${ref}` : '',
          issue.author?.username ?? '',
          district?.name_fr ?? '',
          district?.name_en ?? '',
        ].join(' '),
      );
      if (!searchable.includes(normalizedQuery) && !searchable.includes(rawQuery)) {
        return false;
      }
    }
    return true;
  });
}

export interface CategoryCounts {
  all: number;
  traffic_safety: number;
  roads_potholes: number;
  streetlights_utilities: number;
}

/** Computes counts per issue category for the filter chips. */
export function getCategoryCounts(issues: readonly Issue[]): CategoryCounts {
  const counts: CategoryCounts = {
    all: issues.length,
    traffic_safety: 0,
    roads_potholes: 0,
    streetlights_utilities: 0,
  };

  for (const issue of issues) {
    if (issue.category in counts) {
      counts[issue.category] += 1;
    }
  }
  return counts;
}

/** Returns the localized borough name for a given district ID. */
export function getDistrictName(
  districtId: string,
  districts: readonly District[],
  language: string,
): string | null {
  const match = districts.find((d) => d.id === districtId);
  if (!match) return null;
  return language.startsWith('en') ? match.name_en : match.name_fr;
}

/** Returns a new zoomed region clamped within safe min/max deltas. */
export function zoomRegion(region: MapRegion, factor: number): MapRegion {
  const clamp = (value: number) =>
    Math.round(Math.min(MAX_REGION_DELTA, Math.max(MIN_REGION_DELTA, value)) * 10000) / 10000;
  return {
    ...region,
    latitudeDelta: clamp(region.latitudeDelta * factor),
    longitudeDelta: clamp(region.longitudeDelta * factor),
  };
}

/** Converts a MapRegion latitudeDelta to an approximate Web Mercator Leaflet zoom level. */
export function deltaToLeafletZoom(latitudeDelta: number): number {
  const zoom = Math.round(Math.log2(360 / Math.max(latitudeDelta, MIN_REGION_DELTA)));
  return Math.min(18, Math.max(11, zoom));
}

/** Returns the next map layer mode in sequence. */
export function nextLayerMode(current: MapLayerMode): MapLayerMode {
  const index = MAP_LAYER_ORDER.indexOf(current);
  return MAP_LAYER_ORDER[(index + 1) % MAP_LAYER_ORDER.length];
}

/** Extracts the short street label (before the first comma) for compact map callouts. */
export function shortStreetLabel(address: string): string {
  const firstPart = address.split(',')[0]?.trim();
  return firstPart || address;
}

/**
 * The smallest region showing every point, with 40% padding so markers don't touch the edges,
 * and at least `minDelta` degrees across so a single point is not zoomed in to street level.
 */
export function regionForPoints(points: readonly LatLng[], minDelta = 0.01): MapRegion {
  if (points.length === 0) return MONTREAL_DEFAULT_REGION;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, minDelta),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, minDelta),
  };
}

/**
 * Extends `region` downward so it fills only the top `1 - fraction` of the map, keeping its top
 * edge: for overlays (badges, buttons) that cover the bottom `fraction` of the map.
 */
export function reserveBottom(region: MapRegion, fraction: number): MapRegion {
  const latitudeDelta = region.latitudeDelta / (1 - fraction);
  const top = region.latitude + region.latitudeDelta / 2;
  return { ...region, latitude: top - latitudeDelta / 2, latitudeDelta };
}

/** Great-circle (haversine) distance in metres between two points. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const EARTH_RADIUS_M = 6_371_000;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** The issue closest to `point` that is at most `maxMeters` away, or `null` when there is none. */
export function nearestIssueWithin(
  issues: readonly Issue[],
  point: LatLng,
  maxMeters: number,
): { issue: Issue; meters: number } | null {
  let nearest: { issue: Issue; meters: number } | null = null;
  for (const issue of issues) {
    const meters = distanceMeters(point, issue);
    if (meters <= maxMeters && (!nearest || meters < nearest.meters)) nearest = { issue, meters };
  }
  return nearest;
}
