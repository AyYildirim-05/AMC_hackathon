import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import {
  boroughKey,
  classifyReason,
  clearRoadworksCache,
  filterRoadworks,
  loadRoadworks,
  ROADWORKS_RESOURCE_ID,
} from '../src/lib/montreal-roadworks.js';

const app = createApp();
const NOW = new Date('2026-11-21T15:00:00Z');

/** Records shaped like the city's DataStore rows (all text fields). */
const RECORDS = [
  {
    id: 'w-roads',
    permit_permit_id: 'OCC-1',
    boroughid: 'Le Plateau-Mont-Royal',
    duration_start_date: '2026-11-01T12:00:00Z',
    duration_end_date: '2026-12-01T12:00:00Z',
    reason_category: 'Réseaux routier - Réfection et travaux corrélatifs',
    occupancy_name: 'Rachel entre Saint-Denis et Berri',
    submittercategory: 'Entrepreneur sous contrat avec la Ville de Montréal',
    organizationname: 'Pavage Inc.',
    latitude: '45.5235',
    longitude: '-73.5800',
  },
  {
    id: 'w-water',
    permit_permit_id: 'OCC-2',
    boroughid: 'Rosemont-La Petite-Patrie',
    duration_start_date: '2026-11-10T12:00:00Z',
    duration_end_date: '2026-11-30T12:00:00Z',
    reason_category: 'Égouts et aqueducs - Excavation',
    occupancy_name: 'Masson entre 1re et 2e',
    submittercategory: 'Ville de Montréal',
    organizationname: null,
    latitude: '45.5400',
    longitude: '-73.5800',
  },
  {
    id: 'w-gas-upcoming',
    permit_permit_id: 'OCC-3',
    boroughid: 'Ville-Marie',
    duration_start_date: '2026-12-05T12:00:00Z',
    duration_end_date: '2026-12-20T12:00:00Z',
    reason_category:
      'S-2 Infrastructure souterraine mineure ou équipement hors-sol - Réseaux de gaz',
    occupancy_name: 'Sainte-Catherine entre Peel et Metcalfe',
    submittercategory: 'RTU (Réseau technique urbain) ou son sous-traitant',
    organizationname: 'Énergir',
    latitude: '45.5000',
    longitude: '-73.5700',
  },
  {
    id: 'w-building-expired',
    permit_permit_id: 'OCC-4',
    boroughid: 'Ville-Marie',
    duration_start_date: '2026-01-01T12:00:00Z',
    duration_end_date: '2026-02-01T12:00:00Z',
    reason_category: 'Construction/rénovation sans excavation',
    occupancy_name: 'Peel entre René-Lévesque et Sainte-Catherine',
    submittercategory: 'Entreprise',
    organizationname: 'Constructions ABC',
    latitude: '45.4990',
    longitude: '-73.5730',
  },
  { id: 'w-no-coords', boroughid: 'Anjou', latitude: null, longitude: null },
];

function mockCity(records = RECORDS) {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ success: true, result: { records } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetchImpl, calls };
}

describe('Montréal roadworks open data', () => {
  beforeEach(() => clearRoadworksCache());

  it('groups the city reason labels into filterable types', () => {
    assert.equal(classifyReason('Réseaux routier - Réfection et travaux corrélatifs'), 'roads');
    assert.equal(classifyReason('Trottoirs - Construction'), 'roads');
    assert.equal(classifyReason('Feux de signalisation - Ajout/réparation'), 'roads');
    assert.equal(classifyReason('Égouts et aqueducs - Inspection et nettoyage'), 'water');
    assert.equal(classifyReason('S-10 Fuite ou bris de gaz, situation post-urgence'), 'utilities');
    assert.equal(classifyReason('AS-2 Réseau aérosouterrain existant'), 'utilities');
    assert.equal(classifyReason('A-1 Réseau aérien existant'), 'utilities');
    assert.equal(classifyReason('Construction/rénovation avec excavation'), 'building');
    assert.equal(classifyReason('Toiture - Rénovation'), 'building');
    assert.equal(classifyReason('Autre'), 'other');
    assert.equal(classifyReason('Entretien'), 'other');
  });

  it('matches borough names regardless of accents and dash style', () => {
    assert.equal(boroughKey('Rosemont–La Petite-Patrie'), boroughKey('Rosemont-La Petite-Patrie'));
    assert.equal(boroughKey('Saint-Léonard'), boroughKey('saint leonard'));
  });

  it('loads the city DataStore once, normalizes it, and serves later calls from the cache', async () => {
    const { fetchImpl, calls } = mockCity();
    const first = await loadRoadworks({ fetchImpl });
    await loadRoadworks({ fetchImpl });

    assert.equal(calls.length, 1);
    assert.match(calls[0], new RegExp(`resource_id=${ROADWORKS_RESOURCE_ID}`));
    assert.equal(first.works.length, 4, 'the record without coordinates is dropped');
    const roads = first.works.find((w) => w.id === 'w-roads');
    assert.deepEqual(roads, {
      id: 'w-roads',
      permitId: 'OCC-1',
      borough: 'Le Plateau-Mont-Royal',
      location: 'Rachel entre Saint-Denis et Berri',
      reason: 'Réseaux routier - Réfection et travaux corrélatifs',
      type: 'roads',
      organization: 'Pavage Inc.',
      isCityProject: true,
      startDate: '2026-11-01T12:00:00Z',
      endDate: '2026-12-01T12:00:00Z',
      latitude: 45.5235,
      longitude: -73.58,
    });
  });

  it('keeps serving the last good copy when the portal is down', async () => {
    await loadRoadworks({ fetchImpl: mockCity().fetchImpl });
    const failing: typeof fetch = async () => new Response('down', { status: 503 });

    const result = await loadRoadworks({ fetchImpl: failing, bypassCache: true });

    assert.equal(result.works.length, 4);
  });

  it('reports a 502 when the portal is down and nothing is cached', async () => {
    const failing: typeof fetch = async () => new Response('down', { status: 503 });
    await assert.rejects(loadRoadworks({ fetchImpl: failing }), { status: 502 });
  });

  it('filters by borough, type, city projects and active/upcoming dates', async () => {
    const { works } = await loadRoadworks({ fetchImpl: mockCity().fetchImpl });
    const ids = (filter: Parameters<typeof filterRoadworks>[1]) =>
      filterRoadworks(works, { now: NOW, ...filter })
        .map((w) => w.id)
        .sort();

    assert.deepEqual(ids({}), ['w-roads', 'w-water']);
    assert.deepEqual(ids({ when: 'upcoming' }), ['w-gas-upcoming']);
    assert.deepEqual(ids({ boroughs: ['Rosemont–La Petite-Patrie'] }), ['w-water']);
    assert.deepEqual(ids({ types: ['roads'] }), ['w-roads']);
    assert.deepEqual(ids({ when: 'upcoming', cityOnly: true }), []);
  });
});

describe('GET /api/roadworks', () => {
  beforeEach(async () => {
    clearRoadworksCache();
    // Prime the cache so the route never reaches the network.
    await loadRoadworks({ fetchImpl: mockCity().fetchImpl });
  });

  it('returns active works with per-type counts and the data source', async () => {
    const res = await request(app).get('/api/roadworks');

    assert.equal(res.status, 200);
    assert.equal(res.body.source.license, 'CC BY 4.0');
    assert.ok(res.body.fetchedAt);
    // Which works are "active" depends on today's date, so only check the response's consistency.
    assert.equal(res.body.total, res.body.works.length);
    const counted = Object.values(res.body.typeCounts as Record<string, number>).reduce(
      (a, b) => a + b,
      0,
    );
    assert.equal(counted, res.body.total);
  });

  it('applies the type filter to the works but not to the type counts', async () => {
    const all = await request(app).get('/api/roadworks?when=upcoming');
    const gasOnly = await request(app).get('/api/roadworks?when=upcoming&types=utilities');
    const roadsOnly = await request(app).get('/api/roadworks?when=upcoming&types=roads');

    assert.deepEqual(gasOnly.body.typeCounts, all.body.typeCounts);
    assert.ok(gasOnly.body.works.every((w: { type: string }) => w.type === 'utilities'));
    assert.ok(roadsOnly.body.works.every((w: { type: string }) => w.type === 'roads'));
  });

  it('filters by borough list', async () => {
    const res = await request(app).get(
      '/api/roadworks?when=upcoming&boroughs=Ville-Marie,Le Plateau-Mont-Royal',
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.works.every((w: { borough: string }) => w.borough === 'Ville-Marie'));
  });

  it('rejects unknown types', async () => {
    const res = await request(app).get('/api/roadworks?types=roads,spaceships');
    assert.equal(res.status, 400);
  });
});
