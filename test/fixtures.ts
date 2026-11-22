import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import type { District } from '@/components/utils/map-utils';
import { apiClient } from '@/lib/api/client';
import type { Roadwork } from '@/lib/api/roadworks';
import type { IssueComment, IssueVote, Person, ProfileData } from '@/lib/profile';
import type { Issue } from '@/models/Issue';

export const TEST_DISTRICTS: District[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    name_fr: 'Le Plateau-Mont-Royal',
    name_en: 'Le Plateau-Mont-Royal',
    open_north_slug: 'le-plateau-mont-royal',
    district_type: 'borough',
    postal_code: 'H2J 1S4',
    manager_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    manager_username: 'camille_mtl',
    is_claimed: true,
    created_at: '2026-10-01T10:00:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    name_fr: 'Ville-Marie',
    name_en: 'Ville-Marie',
    open_north_slug: 'ville-marie',
    district_type: 'borough',
    postal_code: 'H2L 2C9',
    manager_id: '8f9e0d1c-2b3a-4f5e-6d7c-8b9a0e1f2d3c',
    manager_username: 'ops_villemarie',
    is_claimed: true,
    created_at: '2026-10-01T10:00:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    name_fr: 'Rosemont–La Petite-Patrie',
    name_en: 'Rosemont–La Petite-Patrie',
    open_north_slug: 'rosemont-la-petite-patrie',
    district_type: 'borough',
    postal_code: 'H1Y 2A1',
    manager_id: null,
    manager_username: null,
    is_claimed: false,
    created_at: '2026-10-01T10:00:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    name_fr: 'Westmount',
    name_en: 'Westmount',
    open_north_slug: 'westmount',
    district_type: 'municipality',
    postal_code: 'H3Z 1A1',
    manager_id: null,
    manager_username: null,
    is_claimed: false,
    created_at: '2026-10-01T10:00:00.000Z',
  },
];

export const TEST_PERSONS: Person[] = [
  {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    username: 'camille_mtl',
    display_name: 'Camille Tremblay',
    avatar_url: null,
    email: 'camille.tremblay@example.ca',
    postal_code: 'H2J1S4',
    home_district_id: '11111111-1111-4111-8111-111111111101',
    role: 'district_manager',
    is_verified: true,
    is_active_post: true,
    preferred_language: 'fr',
  },
  {
    id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    username: 'marc_velo',
    display_name: 'Marc Gagnon',
    avatar_url: null,
    email: 'marc.gagnon@example.ca',
    postal_code: 'H2H1M8',
    home_district_id: '11111111-1111-4111-8111-111111111101',
    role: 'resident',
    is_verified: false,
    is_active_post: false,
    preferred_language: 'fr',
  },
  {
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    username: 'sarah_qc',
    display_name: 'Sarah Chen',
    avatar_url: null,
    email: 'sarah.chen@example.ca',
    postal_code: 'H2X1Y4',
    home_district_id: '11111111-1111-4111-8111-111111111102',
    role: 'resident',
    is_verified: false,
    is_active_post: false,
    preferred_language: 'en',
  },
  {
    id: '8f9e0d1c-2b3a-4f5e-6d7c-8b9a0e1f2d3c',
    username: 'ops_villemarie',
    display_name: 'Coordination Ville-Marie',
    avatar_url: null,
    email: 'coord.vm@example.ca',
    postal_code: 'H2Y1C6',
    home_district_id: '11111111-1111-4111-8111-111111111102',
    role: 'district_manager',
    is_verified: true,
    is_active_post: true,
    preferred_language: 'fr',
  },
  {
    id: '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
    username: 'admin_mtl',
    display_name: 'Admin MTL',
    avatar_url: null,
    email: 'admin@montone.example.ca',
    postal_code: 'H2S2A9',
    home_district_id: '11111111-1111-4111-8111-111111111103',
    role: 'admin',
    is_verified: false,
    is_active_post: false,
    preferred_language: 'en',
  },
  {
    id: '44444444-4444-4444-8444-444444444401',
    username: 'Ahmet',
    display_name: 'Ahmet',
    avatar_url: null,
    email: 'ahmet@example.ca',
    postal_code: 'H1Y1X5',
    home_district_id: '11111111-1111-4111-8111-111111111103',
    role: 'resident',
    is_verified: false,
    is_active_post: false,
    preferred_language: 'fr',
  },
  {
    id: '44444444-4444-4444-8444-444444444402',
    username: 'AHM',
    display_name: 'AHM',
    avatar_url: null,
    email: 'ahm@example.ca',
    postal_code: 'H3Z1A1',
    home_district_id: '11111111-1111-4111-8111-111111111104',
    role: 'resident',
    is_verified: false,
    is_active_post: false,
    preferred_language: 'en',
  },
];

export const TEST_ISSUES: Issue[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'Blocked bike lane on Rue Rachel Est',
    description:
      'Construction barriers are blocking the protected bike lane near Parc La Fontaine with no marked detour.',
    category: 'traffic_safety',
    status: 'in_progress',
    images: [
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    ],
    address: '1250 Rue Rachel Est, Montréal, QC H2J 2J9',
    latitude: 45.529841,
    longitude: -73.575124,
    district_id: '11111111-1111-4111-8111-111111111101',
    created_by_id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    author: { username: 'marc_velo', name: 'Marc Gagnon' },
    updated_by_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    official_response: {
      author: 'camille_mtl',
      role: 'Gestionnaire Arrondissement',
      comment: 'Inspection team notified. Barriers moved back...',
    },
    upvote_count: 2,
    resolution_confirmations: 1,
    comments_count: 3,
    external_311_ref: 'MTL-311-2026-88412',
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T17:10:12.000Z',
  },
  {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    title: 'Out-of-service station elevator near Berri-UQAM',
    description:
      'Pedestrian and transit access elevator on Rue Sainte-Catherine Est is out of service.',
    category: 'streetlights_utilities',
    status: 'in_progress',
    images: [],
    address: '505 Rue Sainte-Catherine Est, Montréal, QC H2L 2C9',
    latitude: 45.515218,
    longitude: -73.560412,
    district_id: '11111111-1111-4111-8111-111111111102',
    created_by_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    author: { username: 'sarah_qc', name: 'Sarah Chen' },
    updated_by_id: '8f9e0d1c-2b3a-4f5e-6d7c-8b9a0e1f2d3c',
    official_response: {
      author: 'ops_villemarie',
      role: 'Gestionnaire Arrondissement',
      comment: 'Maintenance crews are on-site in Ville-Marie. Estimated restoration time is 18:00.',
    },
    upvote_count: 1,
    resolution_confirmations: 0,
    comments_count: 2,
    external_311_ref: 'MTL-311-2026-89004',
    created_at: '2026-11-20T14:15:00.000Z',
    updated_at: '2026-11-20T15:05:19.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222203',
    title: 'Deep pothole near Beaubien and Saint-Denis',
    description: 'Large pothole forming in the right lane after freeze-thaw cycle.',
    category: 'roads_potholes',
    status: 'not_started',
    images: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1200&q=80',
    ],
    address: '7045 Rue Saint-Denis, Montréal, QC H2S 2S3',
    latitude: 45.537812,
    longitude: -73.606541,
    district_id: '11111111-1111-4111-8111-111111111103',
    created_by_id: '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
    author: { username: 'admin_mtl', name: 'Admin MTL' },
    updated_by_id: null,
    official_response: null,
    upvote_count: 0,
    resolution_confirmations: 0,
    comments_count: 0,
    external_311_ref: null,
    created_at: '2026-11-21T07:45:00.000Z',
    updated_at: '2026-11-21T07:45:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555501',
    title: 'Streetlight out on Rue Masson',
    description:
      'The streetlight in front of the library has been dark for three nights; the sidewalk is unlit.',
    category: 'streetlights_utilities',
    status: 'not_started',
    images: [],
    address: '2900 Rue Masson, Montréal, QC H1Y 1X5',
    latitude: 45.546412,
    longitude: -73.577655,
    district_id: '11111111-1111-4111-8111-111111111103',
    created_by_id: '44444444-4444-4444-8444-444444444401',
    author: { username: 'Ahmet', name: 'Ahmet' },
    updated_by_id: null,
    official_response: null,
    upvote_count: 1,
    resolution_confirmations: 0,
    comments_count: 1,
    external_311_ref: null,
    created_at: '2026-11-21T09:30:00.000Z',
    updated_at: '2026-11-21T09:30:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555502',
    title: 'Sunken manhole cover on Rue Sherbrooke Ouest',
    description:
      'A manhole cover has sunk several centimetres below the road surface near Avenue Clarke.',
    category: 'roads_potholes',
    status: 'not_started',
    images: [],
    address: '4300 Rue Sherbrooke Ouest, Westmount, QC H3Z 1A1',
    latitude: 45.48572,
    longitude: -73.59456,
    district_id: '11111111-1111-4111-8111-111111111104',
    created_by_id: '44444444-4444-4444-8444-444444444402',
    author: { username: 'AHM', name: 'AHM' },
    updated_by_id: null,
    official_response: null,
    upvote_count: 1,
    resolution_confirmations: 0,
    comments_count: 1,
    external_311_ref: null,
    created_at: '2026-11-21T10:15:00.000Z',
    updated_at: '2026-11-21T10:15:00.000Z',
  },
];

export const TEST_COMMENTS: IssueComment[] = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    issue_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    body: 'The bike lane on Rachel Street East near Parc La Fontaine is completely blocked by construction barriers with no detour signs.',
    is_official_response: false,
    created_at: '2026-11-18T08:15:30.000Z',
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    issue_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    body: 'Thank you for reporting this. Le Plateau-Mont-Royal inspection team has been notified and will verify contractor permit compliance today.',
    is_official_response: true,
    created_at: '2026-11-18T11:42:10.000Z',
  },
  {
    id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7a',
    issue_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    body: 'Confirmed—they moved the fencing back onto the sidewalk perimeter this afternoon so cyclists can pass safely.',
    is_official_response: false,
    created_at: '2026-11-18T17:05:45.000Z',
  },
  {
    id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
    issue_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    user_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    body: 'The elevator at Berri-UQAM station (Orange line platform) is out of service again. Difficult access with a stroller.',
    is_official_response: false,
    created_at: '2026-11-20T14:20:00.000Z',
  },
  {
    id: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
    issue_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    user_id: '8f9e0d1c-2b3a-4f5e-6d7c-8b9a0e1f2d3c',
    body: 'Maintenance crews are on-site in Ville-Marie. Estimated restoration time is 18:00.',
    is_official_response: true,
    created_at: '2026-11-20T15:05:19.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777701',
    issue_id: '55555555-5555-4555-8555-555555555502',
    user_id: '44444444-4444-4444-8444-444444444401',
    body: 'Same here, my bike wheel caught the edge this morning.',
    is_official_response: false,
    created_at: '2026-11-21T11:01:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777702',
    issue_id: '55555555-5555-4555-8555-555555555501',
    user_id: '44444444-4444-4444-8444-444444444402',
    body: 'Walked past last night, still out.',
    is_official_response: false,
    created_at: '2026-11-21T11:06:00.000Z',
  },
];

export const TEST_VOTES: IssueVote[] = [
  {
    id: '33333333-3333-4333-8333-333333333301',
    issue_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    vote_type: 'upvote',
    created_at: '2026-11-18T08:02:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333302',
    issue_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    vote_type: 'upvote',
    created_at: '2026-11-18T09:14:22.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333303',
    issue_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
    vote_type: 'confirm_resolved',
    created_at: '2026-11-18T17:06:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333304',
    issue_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    user_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    vote_type: 'upvote',
    created_at: '2026-11-20T14:16:10.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666601',
    issue_id: '55555555-5555-4555-8555-555555555502',
    user_id: '44444444-4444-4444-8444-444444444401',
    vote_type: 'upvote',
    created_at: '2026-11-21T11:00:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666602',
    issue_id: '55555555-5555-4555-8555-555555555501',
    user_id: '44444444-4444-4444-8444-444444444402',
    vote_type: 'upvote',
    created_at: '2026-11-21T11:05:00.000Z',
  },
];

export const TEST_PROFILE_DATA: ProfileData = {
  persons: TEST_PERSONS,
  districts: TEST_DISTRICTS.map((d) => ({
    id: d.id,
    name_fr: d.name_fr,
    name_en: d.name_en,
    open_north_slug: d.open_north_slug,
    district_type: d.district_type === 'municipality' ? 'municipality' : 'borough',
    manager_id: d.manager_id,
    is_claimed: d.is_claimed,
  })),
  issues: TEST_ISSUES,
  comments: TEST_COMMENTS,
  votes: TEST_VOTES,
};

function toServerDistrict(d: District) {
  return {
    id: d.id,
    nameFr: d.name_fr,
    nameEn: d.name_en,
    openNorthSlug: d.open_north_slug,
    districtType: d.district_type,
    postalCode: d.postal_code ?? null,
    managerId: d.manager_id,
    managerUsername: d.manager_username ?? null,
    isClaimed: d.is_claimed,
    createdAt: d.created_at,
  };
}

function toServerPerson(p: Person) {
  return {
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    email: p.email,
    postalCode: p.postal_code,
    homeDistrictId: p.home_district_id,
    role: p.role,
    isVerified: p.is_verified,
    isActivePost: p.is_active_post,
    preferredLanguage: p.preferred_language,
  };
}

function toServerIssue(i: Issue) {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    category: i.category,
    status: i.status,
    elements: i.elements ?? [],
    images: i.images,
    address: i.address,
    latitude: i.latitude,
    longitude: i.longitude,
    districtId: i.district_id,
    createdById: i.created_by_id,
    updatedById: i.updated_by_id,
    author: i.author ?? null,
    officialResponse: i.official_response ?? null,
    upvoteCount: i.upvote_count,
    resolutionConfirmations: i.resolution_confirmations,
    commentsCount: i.comments_count ?? 0,
    external311Ref: i.external_311_ref,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

function toServerComment(c: IssueComment, persons: Person[]) {
  const person = persons.find((p) => p.id === c.user_id);
  return {
    id: c.id,
    issueId: c.issue_id,
    userId: c.user_id,
    body: c.body,
    images: c.images ?? [],
    isOfficialResponse: c.is_official_response,
    createdAt: c.created_at,
    updatedAt: c.created_at,
    author: person
      ? {
          username: person.username,
          displayName: person.display_name,
          avatarUrl: person.avatar_url,
          role: person.role,
        }
      : null,
  };
}

/**
 * Installs an in-memory stateful Express-compatible axios adapter on `apiClient` for Jest tests.
 * Returns a cleanup function that restores the original adapter.
 */
/** City of Montréal roadworks as `GET /api/roadworks` returns them (normalized by the server). */
export const TEST_ROADWORKS: Roadwork[] = [
  {
    id: 'rw-rachel',
    permitId: 'OCC-2611AA00000001',
    borough: 'Le Plateau-Mont-Royal',
    location: 'Rachel entre Saint-Denis et Berri',
    reason: 'Réseaux routier - Réfection et travaux corrélatifs',
    type: 'roads',
    organization: 'Pavage Montréal Inc.',
    isCityProject: true,
    startDate: '2026-11-01T12:00:00Z',
    endDate: '2026-12-15T12:00:00Z',
    latitude: 45.5236,
    longitude: -73.5794,
  },
  {
    id: 'rw-masson',
    permitId: 'OCC-2611AA00000002',
    borough: 'Rosemont-La Petite-Patrie',
    location: 'Masson entre 1re et 2e',
    reason: 'Égouts et aqueducs - Excavation',
    type: 'water',
    organization: null,
    isCityProject: false,
    startDate: '2026-11-10T12:00:00Z',
    endDate: '2026-11-30T12:00:00Z',
    latitude: 45.5431,
    longitude: -73.5776,
  },
  {
    id: 'rw-peel',
    permitId: 'OCC-2611AA00000003',
    borough: 'Ville-Marie',
    location: 'Peel entre René-Lévesque et Sainte-Catherine',
    reason: 'Construction/rénovation sans excavation',
    type: 'building',
    organization: 'Constructions ABC',
    isCityProject: false,
    startDate: '2026-10-01T12:00:00Z',
    endDate: '2026-12-31T12:00:00Z',
    latitude: 45.4993,
    longitude: -73.5733,
  },
];

const ROADWORKS_SOURCE = {
  name: 'Ville de Montréal: Entraves et travaux en cours',
  license: 'CC BY 4.0',
  url: 'https://donnees.montreal.ca/dataset/info-travaux',
};

/** Same matching rule as the server: accents, case and dash style don't matter. */
const roadworkBoroughKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function installMockBackendApi(options?: {
  profileData?: ProfileData;
  currentUsername?: string;
}) {
  const originalAdapter = apiClient.defaults.adapter;
  const profileSource = options?.profileData ?? TEST_PROFILE_DATA;

  const issues: Issue[] = profileSource.issues.map((i) => ({ ...i }));
  const districts: District[] = TEST_DISTRICTS.map((d) => ({ ...d }));
  const comments: IssueComment[] = profileSource.comments.map((c) => ({ ...c }));
  const persons: Person[] = profileSource.persons.map((p) => ({ ...p }));
  const votes: IssueVote[] = profileSource.votes.map((v) => ({ ...v }));
  const myUpvotes = new Set<string>();
  const myConfirms = new Set<string>();

  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase();
    const url = config.url ?? '';
    const body =
      typeof config.data === 'string' && config.data.length > 0
        ? (JSON.parse(config.data) as Record<string, unknown>)
        : ((config.data as Record<string, unknown> | undefined) ?? {});

    const reply = (data: unknown, status = 200): AxiosResponse => ({
      data,
      status,
      statusText: 'OK',
      headers: {},
      config,
    });

    if (method === 'get' && url === '/api/issues') {
      return reply(issues.map(toServerIssue));
    }

    const byDistrict = url.match(/^\/api\/issues\/district\/([^/]+)$/);
    if (method === 'get' && byDistrict) {
      const districtId = decodeURIComponent(byDistrict[1]);
      return reply(issues.filter((i) => i.district_id === districtId).map(toServerIssue));
    }

    if (method === 'post' && url === '/api/issues') {
      const created: Issue = {
        id: `64b7f0c2a1b2c3d4e5f6${String(issues.length + 1).padStart(4, '0')}`,
        title: String(body.title ?? ''),
        description: String(body.description ?? ''),
        category: (body.category as Issue['category']) ?? 'traffic_safety',
        status: 'not_started',
        elements: Array.isArray(body.elements) ? (body.elements as Issue['elements']) : [],
        images: Array.isArray(body.images) ? body.images.map(String) : [],
        address: String(body.address ?? ''),
        latitude: Number(body.latitude ?? 45.5),
        longitude: Number(body.longitude ?? -73.5),
        district_id: String(body.districtId ?? districts[0]?.id ?? ''),
        created_by_id: persons[0]?.id ?? 'user-1',
        author: { username: options?.currentUsername ?? 'camille_mtl', name: 'Camille Tremblay' },
        updated_by_id: null,
        official_response: null,
        upvote_count: 0,
        resolution_confirmations: 0,
        comments_count: 0,
        external_311_ref: (body.external311Ref as string | null) ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      issues.unshift(created);
      return reply(toServerIssue(created), 201);
    }

    if (method === 'get' && url === '/api/issues/votes/me') {
      return reply({
        upvotedIssueIds: Array.from(myUpvotes),
        confirmedIssueIds: Array.from(myConfirms),
      });
    }

    const voteMatch = url.match(/^\/api\/issues\/([^/]+)\/votes$/);
    if (method === 'post' && voteMatch) {
      const issueId = decodeURIComponent(voteMatch[1]);
      const voteType = body.voteType as 'upvote' | 'confirm_resolved';
      const issue = issues.find((i) => i.id === issueId);
      const set = voteType === 'upvote' ? myUpvotes : myConfirms;
      let active: boolean;
      if (set.has(issueId)) {
        set.delete(issueId);
        active = false;
        if (issue) {
          if (voteType === 'upvote') issue.upvote_count = Math.max(0, issue.upvote_count - 1);
          else issue.resolution_confirmations = Math.max(0, issue.resolution_confirmations - 1);
        }
      } else {
        set.add(issueId);
        active = true;
        if (issue) {
          if (voteType === 'upvote') issue.upvote_count += 1;
          else issue.resolution_confirmations += 1;
        }
      }
      return reply({
        issueId,
        voteType,
        active,
        upvoteCount: issue?.upvote_count ?? 0,
        resolutionConfirmations: issue?.resolution_confirmations ?? 0,
      });
    }

    const commentsMatch = url.match(/^\/api\/issues\/([^/]+)\/comments$/);
    if (commentsMatch) {
      const issueId = decodeURIComponent(commentsMatch[1]);
      if (method === 'get') {
        return reply(
          comments.filter((c) => c.issue_id === issueId).map((c) => toServerComment(c, persons)),
        );
      }
      if (method === 'post') {
        const current = persons.find((p) => p.username === options?.currentUsername) ?? persons[0];
        const created: IssueComment = {
          id: `comment-${comments.length + 1}`,
          issue_id: issueId,
          user_id: current?.id ?? 'current-user',
          body: String(body.body ?? ''),
          images: Array.isArray(body.images) ? body.images.map(String) : [],
          is_official_response: Boolean(body.isOfficialResponse),
          created_at: new Date().toISOString(),
        };
        comments.push(created);
        return reply(toServerComment(created, persons), 201);
      }
    }

    const statusMatch = url.match(/^\/api\/issues\/([^/]+)\/status$/);
    if (method === 'patch' && statusMatch) {
      const issueId = decodeURIComponent(statusMatch[1]);
      const issue = issues.find((i) => i.id === issueId);
      if (issue) {
        issue.status = body.status as Issue['status'];
        return reply(toServerIssue(issue));
      }
    }

    if (method === 'get' && url.startsWith('/api/roadworks')) {
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      const list = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);
      const boroughs = new Set(list('boroughs').map(roadworkBoroughKey));
      const types = list('types');
      const beforeType = TEST_ROADWORKS.filter(
        (w) =>
          params.get('when') !== 'upcoming' &&
          (boroughs.size === 0 || boroughs.has(roadworkBoroughKey(w.borough))) &&
          (params.get('cityOnly') !== 'true' || w.isCityProject),
      );
      const typeCounts = { roads: 0, water: 0, utilities: 0, building: 0, other: 0 };
      for (const w of beforeType) typeCounts[w.type] += 1;
      const works =
        types.length > 0 ? beforeType.filter((w) => types.includes(w.type)) : beforeType;
      return reply({
        source: ROADWORKS_SOURCE,
        fetchedAt: '2026-11-21T12:00:00.000Z',
        total: works.length,
        typeCounts,
        works,
      });
    }

    if (method === 'get' && url === '/api/districts') {
      return reply(districts.map(toServerDistrict));
    }

    if (method === 'get' && url.startsWith('/api/districts/locate')) {
      const queryPart = url.split('?')[1] ?? '';
      const params = new URLSearchParams(queryPart);
      const lat = Number(params.get('lat') ?? 45.5298);
      const lng = Number(params.get('lng') ?? -73.5751);
      // Map sample Montreal coordinates to their corresponding test district.
      let matched = districts[0];
      if (lat < 45.495) {
        matched = districts[3] ?? districts[0]; // Westmount
      } else if (lat < 45.52 && lng > -73.57) {
        matched = districts[1] ?? districts[0]; // Ville-Marie
      } else if (lat > 45.535) {
        matched = districts[2] ?? districts[0]; // Rosemont
      }
      return reply({
        district: toServerDistrict(matched),
        openNorth: {
          name: matched.name_fr,
          slug: matched.open_north_slug,
          boundarySet:
            matched.district_type === 'borough' ? 'montreal-boroughs' : 'census-subdivisions',
        },
      });
    }

    const districtMatch = url.match(/^\/api\/districts\/([^/]+)$/);
    if (method === 'get' && districtMatch) {
      const id = decodeURIComponent(districtMatch[1]);
      const found = districts.find((d) => d.id === id) ?? districts[0];
      return reply(toServerDistrict(found));
    }

    if (method === 'get' && url === '/api/profile/me') {
      const current = persons.find((p) => p.username === options?.currentUsername) ?? null;
      return reply({
        person: current ? toServerPerson(current) : null,
        persons: persons.map(toServerPerson),
        districts: profileSource.districts.map((d) => ({
          id: d.id,
          nameFr: d.name_fr,
          nameEn: d.name_en,
          openNorthSlug: d.open_north_slug,
          districtType: d.district_type,
          managerId: d.manager_id,
          isClaimed: d.is_claimed,
        })),
        issues: issues.map(toServerIssue),
        comments: comments.map((c) => ({
          id: c.id,
          issueId: c.issue_id,
          userId: c.user_id,
          body: c.body,
          isOfficialResponse: c.is_official_response,
          createdAt: c.created_at,
        })),
        votes: votes.map((v) => ({
          id: v.id,
          issueId: v.issue_id,
          userId: v.user_id,
          voteType: v.vote_type,
          createdAt: v.created_at,
        })),
      });
    }

    return reply({}, 404);
  };

  return () => {
    apiClient.defaults.adapter = originalAdapter;
  };
}
