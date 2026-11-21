import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { HttpError } from '../src/lib/http-error.js';
import { signToken, verifyToken } from '../src/lib/jwt.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

const app = createApp();

describe('password hashing', () => {
  it('hashes and verifies matching passwords', async () => {
    const hash = await hashPassword('super-secret-123');
    assert.notEqual(hash, 'super-secret-123');
    assert.equal(await verifyPassword('super-secret-123', hash), true);
    assert.equal(await verifyPassword('wrong-password', hash), false);
  });

  it('rejects malformed stored hashes safely', async () => {
    assert.equal(await verifyPassword('anything', 'not-a-valid-hash'), false);
  });
});

describe('jwt helpers', () => {
  it('signs and verifies access and refresh tokens', () => {
    const access = signToken({ sub: 'user-123', role: 'resident', type: 'access' }, 60);
    const payload = verifyToken(access, 'access');
    assert.equal(payload.sub, 'user-123');
    assert.equal(payload.role, 'resident');
    assert.equal(payload.type, 'access');

    assert.throws(() => verifyToken(access, 'refresh'), HttpError);
  });

  it('rejects tampered and expired tokens', () => {
    const token = signToken({ sub: 'user-123', role: 'resident', type: 'access' }, 60);
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    assert.throws(() => verifyToken(tampered, 'access'), HttpError);

    const expired = signToken({ sub: 'user-123', role: 'resident', type: 'access' }, -10);
    assert.throws(() => verifyToken(expired, 'access'), HttpError);
  });
});

describe('auth routes validation & guards', () => {
  it('rejects invalid register payload with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'ab',
      email: 'not-an-email',
      password: '123',
      postalCode: '12345',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
  });

  it('rejects empty login payload with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: '', password: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
  });

  it('rejects /api/auth/me without Bearer token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('rejects /api/auth/me with refresh token instead of access token', async () => {
    const refresh = signToken(
      { sub: '507f1f77bcf86cd799439011', role: 'resident', type: 'refresh' },
      60,
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refresh}`);
    assert.equal(res.status, 401);
  });

  it('rejects invalid refresh token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'bad.token.here' });
    assert.equal(res.status, 401);
  });
});
