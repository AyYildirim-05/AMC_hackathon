import type { InternalAxiosRequestConfig } from 'axios';

import { apiClient } from '@/lib/api/client';
import { fetchDistricts, locateDistrictByCoordinates } from '@/lib/api/districts';
import {
  createIssue,
  createIssueComment,
  fetchIssueComments,
  fetchIssues,
  fetchMyVotes,
  toggleIssueVote,
  updateIssueStatus,
} from '@/lib/api/issues';
import { fetchMyProfile } from '@/lib/api/profile';

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function mockAdapter(
  handler: (config: InternalAxiosRequestConfig) => { status?: number; data: unknown },
) {
  apiClient.defaults.adapter = async (config) => {
    const res = handler(config);
    return {
      data: res.data,
      status: res.status ?? 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
}

describe('backend API client connections', () => {
  it('fetches and normalizes enriched issues from GET /api/issues', async () => {
    mockAdapter((config) => {
      expect(config.url).toBe('/api/issues');
      return {
        data: [
          {
            id: '64b7f0c2a1b2c3d4e5f60701',
            title: 'Blocked bike lane',
            description: 'Barriers on Rachel',
            category: 'traffic_safety',
            status: 'in_progress',
            images: [],
            address: '1250 Rue Rachel Est',
            latitude: 45.5298,
            longitude: -73.5751,
            districtId: '64b7f0c2a1b2c3d4e5f60702',
            createdById: '64b7f0c2a1b2c3d4e5f60703',
            updatedById: null,
            upvoteCount: 4,
            resolutionConfirmations: 1,
            commentsCount: 2,
            external311Ref: 'MTL-311-2026-88412',
            author: { username: 'marc_velo', name: 'Marc Gagnon', avatarUrl: null },
            officialResponse: {
              author: 'camille_mtl',
              role: 'Gestionnaire Arrondissement',
              comment: 'Crew dispatched.',
            },
            createdAt: '2026-11-18T08:00:00.000Z',
            updatedAt: '2026-11-18T09:00:00.000Z',
          },
        ],
      };
    });

    const issues = await fetchIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: '64b7f0c2a1b2c3d4e5f60701',
      district_id: '64b7f0c2a1b2c3d4e5f60702',
      created_by_id: '64b7f0c2a1b2c3d4e5f60703',
      upvote_count: 4,
      resolution_confirmations: 1,
      comments_count: 2,
      external_311_ref: 'MTL-311-2026-88412',
      author: { username: 'marc_velo', name: 'Marc Gagnon' },
      official_response: {
        author: 'camille_mtl',
        role: 'Gestionnaire Arrondissement',
        comment: 'Crew dispatched.',
      },
    });
  });

  it('fetches and normalizes districts including postalCode and managerUsername', async () => {
    mockAdapter((config) => {
      expect(config.url).toBe('/api/districts');
      return {
        data: [
          {
            id: '64b7f0c2a1b2c3d4e5f60702',
            nameFr: 'Le Plateau-Mont-Royal',
            nameEn: 'Le Plateau-Mont-Royal',
            openNorthSlug: 'le-plateau-mont-royal',
            districtType: 'borough',
            postalCode: 'H2J 1S4',
            managerId: '64b7f0c2a1b2c3d4e5f60704',
            managerUsername: 'camille_mtl',
            isClaimed: true,
            createdAt: '2026-10-01T10:00:00.000Z',
          },
        ],
      };
    });

    const districts = await fetchDistricts();
    expect(districts[0]).toMatchObject({
      id: '64b7f0c2a1b2c3d4e5f60702',
      name_fr: 'Le Plateau-Mont-Royal',
      postal_code: 'H2J 1S4',
      manager_id: '64b7f0c2a1b2c3d4e5f60704',
      manager_username: 'camille_mtl',
      is_claimed: true,
    });
  });

  it('locates a district from GPS coordinates via GET /api/districts/locate', async () => {
    mockAdapter((config) => {
      expect(config.url).toBe('/api/districts/locate?lat=45.5298&lng=-73.5751');
      return {
        data: {
          district: {
            id: '64b7f0c2a1b2c3d4e5f60702',
            nameFr: 'Le Plateau-Mont-Royal',
            nameEn: 'Le Plateau-Mont-Royal',
            openNorthSlug: 'le-plateau-mont-royal',
            districtType: 'borough',
            postalCode: 'H2J 1S4',
            managerId: '64b7f0c2a1b2c3d4e5f60704',
            isClaimed: true,
            createdAt: '2026-10-01T10:00:00.000Z',
          },
          openNorth: {
            name: 'Plateau-Mont-Royal',
            slug: 'plateau-mont-royal',
            boundarySet: 'montreal-boroughs',
          },
        },
      };
    });

    const result = await locateDistrictByCoordinates(45.5298, -73.5751);
    expect(result.district.id).toBe('64b7f0c2a1b2c3d4e5f60702');
    expect(result.district.name_fr).toBe('Le Plateau-Mont-Royal');
    expect(result.openNorth.boundarySet).toBe('montreal-boroughs');
  });

  it('creates issues, updates status, manages comments, toggles votes, and loads profile', async () => {
    const calls: string[] = [];
    mockAdapter((config) => {
      calls.push(`${config.method} ${config.url}`);
      if (config.method === 'post' && config.url === '/api/issues') {
        return {
          status: 201,
          data: {
            id: '64b7f0c2a1b2c3d4e5f60701',
            title: 'New issue',
            description: 'Details',
            category: 'roads_potholes',
            status: 'not_started',
            images: [],
            address: '100 Rue Test',
            latitude: 45.5,
            longitude: -73.5,
            districtId: '64b7f0c2a1b2c3d4e5f60702',
            createdById: '64b7f0c2a1b2c3d4e5f60703',
            updatedById: null,
            upvoteCount: 0,
            resolutionConfirmations: 0,
            commentsCount: 0,
            external311Ref: 'MTL-311-2026-12345',
            createdAt: '2026-11-21T10:00:00.000Z',
            updatedAt: '2026-11-21T10:00:00.000Z',
          },
        };
      }
      if (config.method === 'patch' && config.url?.endsWith('/status')) {
        return {
          data: {
            id: '64b7f0c2a1b2c3d4e5f60701',
            title: 'New issue',
            description: 'Details',
            category: 'roads_potholes',
            status: 'resolved',
            images: [],
            address: '100 Rue Test',
            latitude: 45.5,
            longitude: -73.5,
            districtId: '64b7f0c2a1b2c3d4e5f60702',
            createdById: '64b7f0c2a1b2c3d4e5f60703',
            updatedById: '64b7f0c2a1b2c3d4e5f60704',
            upvoteCount: 0,
            resolutionConfirmations: 0,
            commentsCount: 0,
            external311Ref: null,
            createdAt: '2026-11-21T10:00:00.000Z',
            updatedAt: '2026-11-21T11:00:00.000Z',
          },
        };
      }
      if (config.method === 'get' && config.url?.endsWith('/comments')) {
        return {
          data: [
            {
              id: '64b7f0c2a1b2c3d4e5f60710',
              issueId: '64b7f0c2a1b2c3d4e5f60701',
              userId: '64b7f0c2a1b2c3d4e5f60703',
              body: 'Still there',
              images: ['https://res.cloudinary.com/demo/image/upload/v1/issues/still-there.jpg'],
              isOfficialResponse: false,
              createdAt: '2026-11-21T10:05:00.000Z',
              updatedAt: '2026-11-21T10:05:00.000Z',
              author: {
                username: 'marc_velo',
                displayName: 'Marc Gagnon',
                avatarUrl: null,
                role: 'resident',
              },
            },
          ],
        };
      }
      if (config.method === 'post' && config.url?.endsWith('/comments')) {
        const parsed = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return {
          status: 201,
          data: {
            id: '64b7f0c2a1b2c3d4e5f60711',
            issueId: '64b7f0c2a1b2c3d4e5f60701',
            userId: '64b7f0c2a1b2c3d4e5f60704',
            body: parsed.body,
            images: parsed.images ?? [],
            isOfficialResponse: parsed.isOfficialResponse ?? false,
            createdAt: '2026-11-21T12:00:00.000Z',
            updatedAt: '2026-11-21T12:00:00.000Z',
            author: {
              username: 'camille_mtl',
              displayName: 'Camille Tremblay',
              avatarUrl: null,
              role: 'district_manager',
            },
          },
        };
      }
      if (config.method === 'get' && config.url === '/api/issues/votes/me') {
        return {
          data: {
            upvotedIssueIds: ['64b7f0c2a1b2c3d4e5f60701'],
            confirmedIssueIds: [],
          },
        };
      }
      if (config.method === 'post' && config.url?.endsWith('/votes')) {
        return {
          data: {
            issueId: '64b7f0c2a1b2c3d4e5f60701',
            voteType: 'upvote',
            active: true,
            upvoteCount: 3,
            resolutionConfirmations: 0,
          },
        };
      }
      if (config.method === 'get' && config.url === '/api/profile/me') {
        return {
          data: {
            person: {
              id: '64b7f0c2a1b2c3d4e5f60704',
              username: 'camille_mtl',
              displayName: 'Camille Tremblay',
              avatarUrl: null,
              email: 'camille@example.ca',
              postalCode: 'H2J1S4',
              homeDistrictId: '64b7f0c2a1b2c3d4e5f60702',
              role: 'district_manager',
              isVerified: true,
              isActivePost: true,
              preferredLanguage: 'fr',
            },
            persons: [
              {
                id: '64b7f0c2a1b2c3d4e5f60704',
                username: 'camille_mtl',
                displayName: 'Camille Tremblay',
                avatarUrl: null,
                email: 'camille@example.ca',
                postalCode: 'H2J1S4',
                homeDistrictId: '64b7f0c2a1b2c3d4e5f60702',
                role: 'district_manager',
                isVerified: true,
                isActivePost: true,
                preferredLanguage: 'fr',
              },
            ],
            districts: [
              {
                id: '64b7f0c2a1b2c3d4e5f60702',
                nameFr: 'Le Plateau-Mont-Royal',
                nameEn: 'Le Plateau-Mont-Royal',
                openNorthSlug: 'le-plateau-mont-royal',
                districtType: 'borough',
                managerId: '64b7f0c2a1b2c3d4e5f60704',
                isClaimed: true,
              },
            ],
            issues: [],
            comments: [],
            votes: [],
          },
        };
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    });

    const created = await createIssue({
      title: 'New issue',
      description: 'Details',
      category: 'roads_potholes',
      address: '100 Rue Test',
      latitude: 45.5,
      longitude: -73.5,
      districtId: '64b7f0c2a1b2c3d4e5f60702',
      external311Ref: 'MTL-311-2026-12345',
    });
    expect(created.external_311_ref).toBe('MTL-311-2026-12345');

    const updated = await updateIssueStatus('64b7f0c2a1b2c3d4e5f60701', 'resolved');
    expect(updated.status).toBe('resolved');

    const comments = await fetchIssueComments('64b7f0c2a1b2c3d4e5f60701');
    expect(comments[0]?.body).toBe('Still there');
    expect(comments[0]?.images).toEqual([
      'https://res.cloudinary.com/demo/image/upload/v1/issues/still-there.jpg',
    ]);

    const added = await createIssueComment('64b7f0c2a1b2c3d4e5f60701', 'Fixed today', true, [
      'https://res.cloudinary.com/demo/image/upload/v1/issues/fixed.jpg',
    ]);
    expect(added.isOfficialResponse).toBe(true);
    expect(added.images).toEqual([
      'https://res.cloudinary.com/demo/image/upload/v1/issues/fixed.jpg',
    ]);

    const votes = await fetchMyVotes();
    expect(votes.upvotedIssueIds).toEqual(['64b7f0c2a1b2c3d4e5f60701']);

    const toggled = await toggleIssueVote('64b7f0c2a1b2c3d4e5f60701', 'upvote');
    expect(toggled.upvoteCount).toBe(3);

    const profile = await fetchMyProfile();
    expect(profile.persons[0]?.display_name).toBe('Camille Tremblay');
    expect(profile.persons[0]?.is_verified).toBe(true);
    expect(profile.districts[0]?.open_north_slug).toBe('le-plateau-mont-royal');

    expect(calls).toEqual([
      'post /api/issues',
      'patch /api/issues/64b7f0c2a1b2c3d4e5f60701/status',
      'get /api/issues/64b7f0c2a1b2c3d4e5f60701/comments',
      'post /api/issues/64b7f0c2a1b2c3d4e5f60701/comments',
      'get /api/issues/votes/me',
      'post /api/issues/64b7f0c2a1b2c3d4e5f60701/votes',
      'get /api/profile/me',
    ]);
  });
});
