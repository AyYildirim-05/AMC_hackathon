import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();
const validId = '64b7f0c2a1b2c3d4e5f60718';
const authHeader = () =>
  `Bearer ${signToken({ sub: '64b7f0c2a1b2c3d4e5f60719', role: 'resident', type: 'access' }, 60)}`;

describe('comments, votes, and profile routes: validation & auth guards', () => {
  it('rejects GET /api/issues/:id/comments with malformed id', async () => {
    const res = await request(app).get('/api/issues/not-an-id/comments');
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.id);
  });

  it('requires auth for POST /api/issues/:id/comments', async () => {
    const res = await request(app).post(`/api/issues/${validId}/comments`).send({ body: 'Hello' });
    assert.equal(res.status, 401);
  });

  it('rejects empty comment body with 400', async () => {
    const res = await request(app)
      .post(`/api/issues/${validId}/comments`)
      .set('Authorization', authHeader())
      .send({ body: '   ' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.body);
  });

  it('requires auth for GET /api/issues/votes/me', async () => {
    const res = await request(app).get('/api/issues/votes/me');
    assert.equal(res.status, 401);
  });

  it('requires auth for POST /api/issues/:id/votes', async () => {
    const res = await request(app)
      .post(`/api/issues/${validId}/votes`)
      .send({ voteType: 'upvote' });
    assert.equal(res.status, 401);
  });

  it('rejects invalid voteType with 400', async () => {
    const res = await request(app)
      .post(`/api/issues/${validId}/votes`)
      .set('Authorization', authHeader())
      .send({ voteType: 'downvote' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.fieldErrors.voteType);
  });

  it('requires auth for GET /api/profile/me', async () => {
    const res = await request(app).get('/api/profile/me');
    assert.equal(res.status, 401);
  });
});
