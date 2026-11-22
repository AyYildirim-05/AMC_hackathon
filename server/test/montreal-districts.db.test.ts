import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { clearMontrealBoroughsCache, listMontrealBoroughs } from '../src/lib/opennorth.js';
import { DistrictModel } from '../src/models/index.js';

import { connectTestDb, dropTestDb, testMongoUri } from './test-db.js';

const app = createApp();

/** Three OpenNorth boroughs; the Plateau already exists in the database under its seeded name. */
const OPENNORTH_BOROUGHS = [
  { slug: 'plateau-mont-royal', name: 'Plateau-Mont-Royal' },
  { slug: 'sud-ouest', name: 'Sud-Ouest' },
  { slug: 'verdun', name: 'Verdun' },
];

const mockOpenNorth: typeof fetch = async () =>
  new Response(
    JSON.stringify({
      objects: OPENNORTH_BOROUGHS.map(({ slug, name }) => ({
        url: `/boundaries/montreal-boroughs/${slug}/`,
        name,
        related: { boundary_set_url: '/boundary-sets/montreal-boroughs/' },
      })),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

describe(
  'GET /api/districts/montreal against MongoDB',
  { skip: !testMongoUri && 'set TEST_MONGODB_URI to run' },
  () => {
    before(() => connectTestDb('montreal_districts'));
    after(() => dropTestDb());

    beforeEach(async () => {
      await DistrictModel.deleteMany({});
      clearMontrealBoroughsCache();
      // Prime the borough cache so the route never reaches OpenNorth.
      await listMontrealBoroughs({ fetchImpl: mockOpenNorth });
      await DistrictModel.create([
        {
          nameFr: 'Le Plateau-Mont-Royal',
          nameEn: 'Le Plateau-Mont-Royal',
          openNorthSlug: 'le-plateau-mont-royal',
          districtType: 'borough',
          managerId: null,
          isClaimed: false,
        },
        {
          nameFr: 'Westmount',
          nameEn: 'Westmount',
          openNorthSlug: 'westmount',
          districtType: 'municipality',
          managerId: null,
          isClaimed: false,
        },
      ]);
    });

    it('adds the missing boroughs, keeps existing districts, and returns them all sorted', async () => {
      const res = await request(app).get('/api/districts/montreal');

      assert.equal(res.status, 200, JSON.stringify(res.body));
      const names = (res.body as { nameFr: string }[]).map((d) => d.nameFr);
      // The seeded "Le Plateau-Mont-Royal" matches OpenNorth's "Plateau-Mont-Royal": no duplicate.
      assert.deepEqual(names, ['Le Plateau-Mont-Royal', 'Sud-Ouest', 'Verdun', 'Westmount']);
      const created = await DistrictModel.findOne({ openNorthSlug: 'verdun' }).lean();
      assert.equal(created?.isClaimed, false);
      assert.equal(created?.managerId, null);
      assert.equal(created?.districtType, 'borough');
    });

    it('is idempotent', async () => {
      await request(app).get('/api/districts/montreal');
      await request(app).get('/api/districts/montreal');

      assert.equal(await DistrictModel.countDocuments(), 4);
    });
  },
);
