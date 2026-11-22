import { HttpError } from './http-error.js';

/**
 * Live roadworks and street obstructions from the City of Montréal open data portal:
 * "Entraves et travaux en cours" (dataset `info-travaux`), CC BY 4.0, refreshed daily.
 * https://donnees.montreal.ca/dataset/info-travaux
 */
export const ROADWORKS_SOURCE = {
  name: 'Ville de Montréal: Entraves et travaux en cours',
  license: 'CC BY 4.0',
  url: 'https://donnees.montreal.ca/dataset/info-travaux',
} as const;

const CKAN_BASE = 'https://donnees.montreal.ca/api/3/action/datastore_search';
/** DataStore resource "Entraves et travaux en cours" (the live list of permits). */
export const ROADWORKS_RESOURCE_ID = 'cc41b532-f12d-40fb-9f55-eb58c9a2b12b';
const FIELDS = [
  'id',
  'permit_permit_id',
  'boroughid',
  'duration_start_date',
  'duration_end_date',
  'reason_category',
  'occupancy_name',
  'submittercategory',
  'organizationname',
  'latitude',
  'longitude',
] as const;
/** The dataset holds ~1,800 permits; one page comfortably covers it. */
const PAGE_LIMIT = 5000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour; the city refreshes the data daily
const FETCH_TIMEOUT_MS = 15_000;
/** How far ahead "upcoming" looks. */
const UPCOMING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const ROADWORK_TYPES = ['roads', 'water', 'utilities', 'building', 'other'] as const;
export type RoadworkType = (typeof ROADWORK_TYPES)[number];
export type RoadworkWhen = 'active' | 'upcoming';

export type Roadwork = {
  id: string;
  permitId: string | null;
  borough: string;
  /** Street segment, e.g. "Rachel entre Saint-Denis et Berri". */
  location: string;
  /** The city's own reason label (French), e.g. "Égouts et aqueducs - Excavation". */
  reason: string;
  type: RoadworkType;
  organization: string | null;
  /** Work done by the City of Montréal or a contractor working for it. */
  isCityProject: boolean;
  startDate: string;
  endDate: string;
  latitude: number;
  longitude: number;
};

type RawRecord = Partial<Record<(typeof FIELDS)[number], string | null>>;
type CkanResponse = { success?: boolean; result?: { records?: RawRecord[] } };

/** Groups the city's ~26 reason labels into a few types people can filter by. */
export function classifyReason(reason: string): RoadworkType {
  const r = reason.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (r.startsWith('egouts et aqueducs')) return 'water';
  if (
    r.startsWith('reseaux routier') ||
    r.startsWith('trottoirs') ||
    r.startsWith('feux de signalisation') ||
    r.startsWith("puits d'acces")
  ) {
    return 'roads';
  }
  // Utility network codes: S-1…S-10 (underground), AS-1/AS-2 (aero-underground), A-1 (aerial).
  if (/^(s|as|a)-\d+\b/.test(r) || r.startsWith('forage/excavation')) return 'utilities';
  if (r.startsWith('construction/renovation') || r.startsWith('toiture') || r === 'demenagement') {
    return 'building';
  }
  return 'other';
}

function isCitySubmitter(category: string | null | undefined): boolean {
  if (!category) return false;
  return (
    category === 'Ville de Montréal' ||
    category.startsWith('Entrepreneur sous contrat avec la Ville')
  );
}

/** Accent-, case- and punctuation-insensitive key, so "Rosemont–La Petite-Patrie" matches "Rosemont-La Petite-Patrie". */
export function boroughKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeRoadwork(raw: RawRecord): Roadwork | null {
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  const start = raw.duration_start_date;
  const end = raw.duration_end_date;
  if (!raw.id || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !start || !end) {
    return null;
  }
  if (latitude === 0 || longitude === 0) return null;
  const reason = raw.reason_category?.trim() || 'Autre';
  return {
    id: raw.id,
    permitId: raw.permit_permit_id ?? null,
    borough: raw.boroughid?.trim() ?? '',
    location: raw.occupancy_name?.trim() ?? '',
    reason,
    type: classifyReason(reason),
    organization: raw.organizationname?.trim() || null,
    isCityProject: isCitySubmitter(raw.submittercategory),
    startDate: start,
    endDate: end,
    latitude,
    longitude,
  };
}

let cache: { works: Roadwork[]; fetchedAt: string; expiresAt: number } | null = null;

/**
 * All current permits from the city's DataStore, normalized. Cached for an hour; a failed refresh
 * falls back to the last good copy so the map keeps working when the portal is down.
 */
export async function loadRoadworks(options?: {
  fetchImpl?: typeof fetch;
  bypassCache?: boolean;
}): Promise<{ works: Roadwork[]; fetchedAt: string }> {
  if (!options?.bypassCache && cache && cache.expiresAt > Date.now()) {
    return { works: cache.works, fetchedAt: cache.fetchedAt };
  }
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url =
    `${CKAN_BASE}?resource_id=${ROADWORKS_RESOURCE_ID}` +
    `&limit=${PAGE_LIMIT}&fields=${FIELDS.join(',')}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new HttpError(502, `Montréal open data returned HTTP ${res.status}`);
    const body = (await res.json()) as CkanResponse;
    if (!body.success || !Array.isArray(body.result?.records)) {
      throw new HttpError(502, 'Unexpected response from Montréal open data');
    }
    const works = body.result.records
      .map(normalizeRoadwork)
      .filter((w): w is Roadwork => w !== null);
    const fetchedAt = new Date().toISOString();
    cache = { works, fetchedAt, expiresAt: Date.now() + CACHE_TTL_MS };
    return { works, fetchedAt };
  } catch (err) {
    if (cache) return { works: cache.works, fetchedAt: cache.fetchedAt };
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Unable to reach Montréal open data');
  } finally {
    clearTimeout(timer);
  }
}

export type RoadworkFilter = {
  /** Borough names to keep; empty or missing keeps every borough. */
  boroughs?: readonly string[];
  /** Types to keep; empty or missing keeps every type. */
  types?: readonly RoadworkType[];
  cityOnly?: boolean;
  /** `active`: under way now. `upcoming`: starting within the next 30 days. */
  when?: RoadworkWhen;
  now?: Date;
};

export function filterRoadworks(works: readonly Roadwork[], filter: RoadworkFilter): Roadwork[] {
  const now = (filter.now ?? new Date()).getTime();
  const boroughKeys = new Set((filter.boroughs ?? []).map(boroughKey).filter(Boolean));
  const types = new Set(filter.types ?? []);
  return works.filter((w) => {
    if (boroughKeys.size > 0 && !boroughKeys.has(boroughKey(w.borough))) return false;
    if (types.size > 0 && !types.has(w.type)) return false;
    if (filter.cityOnly && !w.isCityProject) return false;
    const start = Date.parse(w.startDate);
    const end = Date.parse(w.endDate);
    if (filter.when === 'upcoming') return start > now && start <= now + UPCOMING_WINDOW_MS;
    return start <= now && now <= end;
  });
}

export function clearRoadworksCache() {
  cache = null;
}
