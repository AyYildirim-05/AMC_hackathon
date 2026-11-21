import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();
const actorId = '64b7f0c2a1b2c3d4e5f60719';
const authToken = signToken({ sub: actorId, role: 'admin', type: 'access' }, 3600);

// These cases are rejected before any database call, so they run without MongoDB.
describe('district routes: validation', () => {
  it('requires authentication on district write routes', async () => {
    const url = '/api/districts/64b7f0c2a1b2c3d4e5f60718';
    for (const res of [
      await request(app).post('/api/districts').send({
        nameFr: 'Plateau',
        nameEn: 'Plateau',
        openNorthSlug: 'plateau',
        districtType: 'borough',
      }),
      await request(app).patch(url).send({ nameFr: 'x' }),
      await request(app).delete(url),
    ]) {
      assert.equal(res.status, 401);
    }
  });

  it('rejects a create body missing required fields or with an unknown type', async () => {
    const res = await request(app)
      .post('/api/districts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ nameFr: 'Plateau', districtType: 'city' });
    assert.equal(res.status, 400);
    for (const field of ['nameEn', 'openNorthSlug', 'districtType']) {
      assert.ok(res.body.details.fieldErrors[field], field);
    }
  });

  it('rejects malformed district ids on every id route', async () => {
    const getRes = await request(app).get('/api/districts/not-an-id');
    assert.equal(getRes.status, 400, 'get');
    assert.ok(getRes.body.details.fieldErrors.id, 'get');

    for (const [method, body] of [
      ['patch', { nameFr: 'x' }],
      ['delete', undefined],
    ] as const) {
      const res = await request(app)
        [method]('/api/districts/not-an-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);
      assert.equal(res.status, 400, method);
      assert.ok(res.body.details.fieldErrors.id, method);
    }
  });

  it('rejects an update that changes nothing, including a client-sent isClaimed', async () => {
    const res = await request(app)
      .patch('/api/districts/64b7f0c2a1b2c3d4e5f60718')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ isClaimed: true });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.details.formErrors, ['Provide at least one field to update']);
  });
});
