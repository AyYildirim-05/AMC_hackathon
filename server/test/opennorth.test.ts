import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { HttpError } from '../src/lib/http-error.js';
import {
  clearOpenNorthCache,
  extractSlugFromBoundaryUrl,
  lookupBoundaryByCoordinates,
} from '../src/lib/opennorth.js';

const app = createApp();

describe('OpenNorth boundary lookup', () => {
  beforeEach(() => {
    clearOpenNorthCache();
  });

  it('extracts slugs from OpenNorth boundary URLs', () => {
    assert.equal(
      extractSlugFromBoundaryUrl('/boundaries/montreal-boroughs/plateau-mont-royal/'),
      'plateau-mont-royal',
    );
    assert.equal(
      extractSlugFromBoundaryUrl('/boundaries/census-subdivisions/westmount'),
      'westmount',
    );
  });

  it('resolves a Montreal borough from coordinates and caches the result', async () => {
    let calls = 0;
    const mockFetch: typeof fetch = async (url) => {
      calls += 1;
      assert.match(String(url), /\/boundaries\/montreal-boroughs\/\?contains=45\.5298,-73\.5751/);
      return new Response(
        JSON.stringify({
          objects: [
            {
              url: '/boundaries/montreal-boroughs/plateau-mont-royal/',
              name: 'Plateau-Mont-Royal',
              related: { boundary_set_url: '/boundary-sets/montreal-boroughs/' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const first = await lookupBoundaryByCoordinates(45.5298, -73.5751, { fetchImpl: mockFetch });
    const second = await lookupBoundaryByCoordinates(45.5298, -73.5751, { fetchImpl: mockFetch });

    assert.deepEqual(first, {
      name: 'Plateau-Mont-Royal',
      slug: 'plateau-mont-royal',
      districtType: 'borough',
      boundarySet: 'montreal-boroughs',
    });
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  });

  it('falls back to census-subdivisions for demerged municipalities like Westmount', async () => {
    const urls: string[] = [];
    const mockFetch: typeof fetch = async (url) => {
      const target = String(url);
      urls.push(target);
      if (target.includes('montreal-boroughs')) {
        return new Response(JSON.stringify({ objects: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          objects: [
            {
              url: '/boundaries/census-subdivisions/westmount/',
              name: 'Westmount',
              related: { boundary_set_url: '/boundary-sets/census-subdivisions/' },
            },
          ],
        }),
        { status: 200 },
      );
    };

    const result = await lookupBoundaryByCoordinates(45.4857, -73.5946, { fetchImpl: mockFetch });
    assert.deepEqual(result, {
      name: 'Westmount',
      slug: 'westmount',
      districtType: 'municipality',
      boundarySet: 'census-subdivisions',
    });
    assert.equal(urls.length, 2);
  });

  it('throws 503 HttpError when OpenNorth rate-limits', async () => {
    const mockFetch: typeof fetch = async () => new Response('Rate limit', { status: 503 });
    await assert.rejects(
      () => lookupBoundaryByCoordinates(45.5, -73.5, { fetchImpl: mockFetch, bypassCache: true }),
      (err: unknown) => err instanceof HttpError && err.status === 503,
    );
  });
});

describe('GET /api/districts/locate validation', () => {
  it('rejects missing or out-of-range coordinates with 400', async () => {
    for (const query of ['', '?lat=45.5', '?lat=95&lng=-73.5', '?lat=abc&lng=-73.5']) {
      const res = await request(app).get(`/api/districts/locate${query}`);
      assert.equal(res.status, 400, query);
    }
  });
});
