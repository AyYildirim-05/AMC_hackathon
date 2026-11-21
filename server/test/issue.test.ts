import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();
const editorId = '64b7f0c2a1b2c3d4e5f60719';
const authToken = signToken({ sub: editorId, role: 'resident', type: 'access' }, 3600);

const validBody = {
  title: 'Pothole on Rue Rachel',
  description: 'Deep pothole in the bike lane.',
  category: 'roads_potholes',
  address: '1250 Rue Rachel Est, Montréal, QC',
  latitude: 45.5298,
  longitude: -73.5751,
  districtId: '64b7f0c2a1b2c3d4e5f60718',
};

// These cases are rejected before any database call, so they run without MongoDB.
describe('POST /api/issues (reportIssue)', () => {
  it('requires authentication on issue write routes', async () => {
    for (const res of [
      await request(app).post('/api/issues').send(validBody),
      await request(app).patch(`/api/issues/${validBody.districtId}`).send({ title: 'x' }),
      await request(app)
        .patch(`/api/issues/${validBody.districtId}/status`)
        .send({ status: 'in_progress' }),
    ]) {
      assert.equal(res.status, 401);
    }
  });

  it('rejects a body missing required fields', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Only a title' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
    assert.ok(res.body.details.fieldErrors.category);
    assert.ok(res.body.details.fieldErrors.districtId);
  });

  it('rejects ids that are not 24-hex ObjectIds', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...validBody, districtId: 'abcdefghijkl' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.districtId);
  });

  it('rejects out-of-range coordinates and unknown categories', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...validBody, latitude: 91, category: 'potholes' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.latitude);
    assert.ok(res.body.details.fieldErrors.category);
  });
});

describe('issue routes with an id', () => {
  it('rejects a malformed issue id', async () => {
    const res = await request(app).get('/api/issues/abcdefghijkl');
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.id);
  });

  it('rejects a malformed district id', async () => {
    const res = await request(app).get('/api/issues/district/not-an-id');
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.districtId);
  });

  it('rejects an update that changes nothing', async () => {
    const res = await request(app)
      .patch(`/api/issues/${validBody.districtId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.details.formErrors, ['Provide at least one field to update']);
  });

  it('rejects an unknown status', async () => {
    const res = await request(app)
      .patch(`/api/issues/${validBody.districtId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'done' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.status);
  });
});
