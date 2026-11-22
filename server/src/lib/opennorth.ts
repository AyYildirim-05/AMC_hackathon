import { HttpError } from './http-error.js';
import type { DistrictType } from '../models/index.js';

const OPENNORTH_BASE = 'https://represent.opennorth.ca';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const FETCH_TIMEOUT_MS = 6_000;

export type OpenNorthBoundary = {
  name: string;
  slug: string;
  districtType: DistrictType;
  boundarySet: string;
};

type OpenNorthBoundaryObject = {
  url?: string;
  name?: string;
  boundary_set_name?: string;
  related?: { boundary_set_url?: string };
};

type OpenNorthResponse = {
  objects?: OpenNorthBoundaryObject[];
};

const cache = new Map<string, { value: OpenNorthBoundary | null; expiresAt: number }>();

/** Extracts the trailing slug segment from an OpenNorth boundary URL. */
export function extractSlugFromBoundaryUrl(url: string): string {
  const cleaned = url.replace(/\/+$/, '');
  const parts = cleaned.split('/');
  return (parts[parts.length - 1] ?? '').trim().toLowerCase();
}

/** Extracts the boundary set slug from a `boundary_set_url` like `/boundary-sets/montreal-boroughs/`. */
function extractBoundarySetSlug(obj: OpenNorthBoundaryObject): string {
  const setUrl = obj.related?.boundary_set_url ?? obj.url ?? '';
  const match = setUrl.match(/\/(?:boundary-sets|boundaries)\/([^/]+)/);
  return (match?.[1] ?? '').toLowerCase();
}

/** Normalizes a district name into a URL-safe slug when OpenNorth URL is absent. */
export function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchOpenNorthJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<OpenNorthResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 503 || res.status === 429) {
      throw new HttpError(503, 'OpenNorth API rate limit reached; please try again shortly');
    }
    if (!res.ok) {
      throw new HttpError(502, `OpenNorth API returned HTTP ${res.status}`);
    }
    return (await res.json()) as OpenNorthResponse;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Unable to reach OpenNorth boundary service');
  } finally {
    clearTimeout(timer);
  }
}

function toBoundary(
  obj: OpenNorthBoundaryObject,
  districtType: DistrictType,
  fallbackSet: string,
): OpenNorthBoundary | null {
  const name = obj.name?.trim();
  if (!name) return null;
  const slug = (obj.url ? extractSlugFromBoundaryUrl(obj.url) : '') || slugifyName(name);
  const boundarySet = extractBoundarySetSlug(obj) || fallbackSet;
  return { name, slug, districtType, boundarySet };
}

/**
 * Resolves a Montreal borough (or demerged municipality / census subdivision) from GPS coordinates
 * using the OpenNorth Represent API (`https://represent.opennorth.ca`).
 *
 * Results are cached for 10 minutes per ~11m grid cell to stay well within OpenNorth's 60 req/min
 * free-tier limit.
 */
export async function lookupBoundaryByCoordinates(
  lat: number,
  lng: number,
  options?: { fetchImpl?: typeof fetch; bypassCache?: boolean },
): Promise<OpenNorthBoundary | null> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  if (!options?.bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const coords = `${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}`;

  // 1. Prefer City of Montreal boroughs first.
  const boroughRes = await fetchOpenNorthJson(
    `${OPENNORTH_BASE}/boundaries/montreal-boroughs/?contains=${coords}`,
    fetchImpl,
  );
  const boroughObj = boroughRes.objects?.[0];
  let resolved: OpenNorthBoundary | null = boroughObj
    ? toBoundary(boroughObj, 'borough', 'montreal-boroughs')
    : null;

  // 2. Fallback for demerged Montreal-island municipalities (e.g. Westmount, Côte-Saint-Luc)
  //    or other Quebec municipalities via census subdivisions.
  if (!resolved) {
    const muniRes = await fetchOpenNorthJson(
      `${OPENNORTH_BASE}/boundaries/census-subdivisions/?contains=${coords}`,
      fetchImpl,
    );
    const muniObj = muniRes.objects?.[0];
    if (muniObj) {
      resolved = toBoundary(muniObj, 'municipality', 'census-subdivisions');
    }
  }

  if (!options?.bypassCache) {
    cache.set(cacheKey, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return resolved;
}

export function clearOpenNorthCache() {
  cache.clear();
}

const BOROUGHS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // borough boundaries almost never change
let boroughsCache: { value: OpenNorthBoundary[]; expiresAt: number } | null = null;

/**
 * All 19 boroughs of the City of Montréal from the OpenNorth Represent `montreal-boroughs`
 * boundary set, cached for a day. Demerged island municipalities (Westmount, Mont-Royal, …) are
 * not part of this set; they are still added on demand by `lookupBoundaryByCoordinates`.
 */
export async function listMontrealBoroughs(options?: {
  fetchImpl?: typeof fetch;
  bypassCache?: boolean;
}): Promise<OpenNorthBoundary[]> {
  if (!options?.bypassCache && boroughsCache && boroughsCache.expiresAt > Date.now()) {
    return boroughsCache.value;
  }
  const res = await fetchOpenNorthJson(
    `${OPENNORTH_BASE}/boundaries/montreal-boroughs/?limit=100`,
    options?.fetchImpl ?? fetch,
  );
  const boroughs = (res.objects ?? [])
    .map((obj) => toBoundary(obj, 'borough', 'montreal-boroughs'))
    .filter((b): b is OpenNorthBoundary => b !== null);
  if (!options?.bypassCache) {
    boroughsCache = { value: boroughs, expiresAt: Date.now() + BOROUGHS_CACHE_TTL_MS };
  }
  return boroughs;
}

export function clearMontrealBoroughsCache() {
  boroughsCache = null;
}
