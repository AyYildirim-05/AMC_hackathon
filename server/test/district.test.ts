import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';

const app = createApp();
const actorId = '64b7f0c2a1b2c3d4e5f60719';

// These cases are rejected before any database call, so they run without MongoDB.
describe('district routes: validation', () => {
  it('rejects a create body missing required fields or with an unknown type', async () => {
    const res = await request(app)
      .post('/api/districts')
      .send({ nameFr: 'Plateau', districtType: 'city' });
    assert.equal(res.status, 400);
    for (const field of ['nameEn', 'openNorthSlug', 'districtType', 'actorId']) {
      assert.ok(res.body.details.fieldErrors[field], field);
    }
  });

  it('rejects malformed district ids on every id route', async () => {
    for (const [method, body] of [
      ['get'],
      ['patch', { nameFr: 'x', actorId }],
      ['delete', { actorId }],
    ] as const) {
      const res = await request(app)[method]('/api/districts/not-an-id').send(body);
      assert.equal(res.status, 400, method);
      assert.ok(res.body.details.fieldErrors.id, method);
    }
  });

  it('requires actorId to update or delete', async () => {
    const url = '/api/districts/64b7f0c2a1b2c3d4e5f60718';
    for (const res of [
      await request(app).patch(url).send({ nameFr: 'x' }),
      await request(app).delete(url),
    ]) {
      assert.equal(res.status, 400);
      assert.ok(res.body.details.fieldErrors.actorId);
    }
  });

  it('rejects an update that changes nothing, including a client-sent isClaimed', async () => {
    const res = await request(app)
      .patch('/api/districts/64b7f0c2a1b2c3d4e5f60718')
      .send({ isClaimed: true, actorId });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.details.formErrors, ['Provide at least one field to update']);
  });
});
