import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';

const app = createApp();

const validBody = {
  title: 'Pothole on Rue Rachel',
  description: 'Deep pothole in the bike lane.',
  category: 'roads_potholes',
  address: '1250 Rue Rachel Est, Montréal, QC',
  latitude: 45.5298,
  longitude: -73.5751,
  districtId: '64b7f0c2a1b2c3d4e5f60718',
  createdById: '64b7f0c2a1b2c3d4e5f60719',
};

// These cases are rejected before any database call, so they run without MongoDB.
describe('POST /api/issues (reportIssue)', () => {
  it('rejects photos that were not uploaded through /api/uploads/signature', async () => {
    for (const images of [['https://example.com/a.jpg'], ['not a url']]) {
      const res = await request(app)
        .post('/api/issues')
        .send({ ...validBody, images });
      assert.equal(res.status, 400, images[0]);
      assert.ok(res.body.details.fieldErrors.images, images[0]);
    }
  });

  it('rejects more than five photos', async () => {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME ?? 'unconfigured';
    const images = Array.from(
      { length: 6 },
      (_, i) => `https://res.cloudinary.com/${cloud}/image/upload/v1/issues/${i}.jpg`,
    );
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validBody, images });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.images);
  });

  it('rejects a body missing required fields', async () => {
    const res = await request(app).post('/api/issues').send({ title: 'Only a title' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
    assert.ok(res.body.details.fieldErrors.category);
    assert.ok(res.body.details.fieldErrors.districtId);
  });

  it('rejects ids that are not 24-hex ObjectIds', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validBody, districtId: 'abcdefghijkl' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.districtId);
    assert.equal(res.body.details.fieldErrors.createdById, undefined);
  });

  it('rejects out-of-range coordinates and unknown categories', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validBody, latitude: 91, category: 'potholes' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.latitude);
    assert.ok(res.body.details.fieldErrors.category);
  });

  it('rejects unknown weather elements', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validBody, elements: ['snow_ice', 'volcano'] });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.elements);
  });
});

describe('issue routes with an id', () => {
  const editorId = '64b7f0c2a1b2c3d4e5f60719';

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
      .send({ updatedById: editorId, status: 'completed' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.details.formErrors, ['Provide at least one field to update']);
  });

  it('rejects an unknown status', async () => {
    const res = await request(app)
      .patch(`/api/issues/${validBody.districtId}/status`)
      .send({ updatedById: editorId, status: 'done' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.status);
  });
});
