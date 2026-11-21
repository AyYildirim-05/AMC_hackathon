import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';

const app = createApp();

describe('express app', () => {
  it('reports 503 from /api/health when MongoDB is not connected', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { status: 'error', mongo: 'error' });
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/missing');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Not found' });
  });

  it('returns JSON 400 for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad-json');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Invalid JSON body' });
  });
});
