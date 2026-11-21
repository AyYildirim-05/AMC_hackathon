import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import {
  ALLOWED_IMAGE_FORMATS,
  createUploadSignature,
  isCloudinaryImageUrl,
  isIssuePhotoUrl,
  signCloudinaryParams,
} from '../src/lib/cloudinary.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();
const auth = () =>
  `Bearer ${signToken({ sub: '64b7f0c2a1b2c3d4e5f60719', role: 'resident', type: 'access' }, 60)}`;

describe('cloudinary signing', () => {
  it('computes the documented SHA-1 signature with sorted parameters', () => {
    // Official Cloudinary example vector:
    // eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510abcd
    const sig = signCloudinaryParams(
      {
        timestamp: 1315060510,
        public_id: 'sample_image',
        eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
        ignored: undefined,
      },
      'abcd',
    );
    assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
});

describe('POST /api/uploads/signature', () => {
  it('requires a signed-in user', async () => {
    const res = await request(app).post('/api/uploads/signature').send({ folder: 'issues' });
    assert.equal(res.status, 401);
  });

  it('rejects unknown folder names with 400', async () => {
    const res = await request(app)
      .post('/api/uploads/signature')
      .set('Authorization', auth())
      .send({ folder: '../etc' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
  });

  it('returns a valid upload signature when Cloudinary env vars are configured', async () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    const res = await request(app)
      .post('/api/uploads/signature')
      .set('Authorization', auth())
      .send({ folder: 'issues' });

    if (!cloudName || !apiKey || !apiSecret) {
      assert.equal(res.status, 503);
      return;
    }

    assert.equal(res.status, 200);
    assert.equal(res.body.cloudName, cloudName);
    assert.equal(res.body.apiKey, apiKey);
    assert.equal(res.body.folder, 'issues');
    assert.equal(res.body.uploadUrl, `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    assert.equal(res.body.allowedFormats, ALLOWED_IMAGE_FORMATS);
    assert.equal(
      res.body.signature,
      signCloudinaryParams(
        { allowed_formats: ALLOWED_IMAGE_FORMATS, folder: 'issues', timestamp: res.body.timestamp },
        apiSecret,
      ),
    );
  });
});

describe('createUploadSignature', () => {
  const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const restore = () => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };

  it('signs the allowed formats, so Cloudinary rejects any other file type', () => {
    Object.assign(process.env, {
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: '1234',
      CLOUDINARY_API_SECRET: 'shh',
    });
    try {
      const sig = createUploadSignature({ folder: 'issues', timestamp: 1700000000 });
      assert.equal(sig.allowedFormats, 'jpg,png,heic,webp');
      assert.equal(
        sig.signature,
        signCloudinaryParams(
          { allowed_formats: 'jpg,png,heic,webp', folder: 'issues', timestamp: 1700000000 },
          'shh',
        ),
      );
      assert.ok(!JSON.stringify(sig).includes('shh'), 'the API secret is never returned');
    } finally {
      restore();
    }
  });
});

describe('isCloudinaryImageUrl / isIssuePhotoUrl', () => {
  const base = 'https://res.cloudinary.com/demo-cloud/image/upload';

  it('accepts the secure_url shape Cloudinary returns for an issue photo', () => {
    // Shape observed from a live upload: .../image/upload/v<version>/issues/<public id>.<ext>
    for (const url of [
      `${base}/v1795293922/issues/dhz3hvh5dwsln09lzwhy.png`,
      `${base}/issues/a-b_c.jpg`,
    ]) {
      assert.equal(isCloudinaryImageUrl(url, 'demo-cloud', 'issues'), true, url);
    }
  });

  it('rejects other hosts, clouds, folders, transformations, sub-paths and queries', () => {
    for (const url of [
      'https://example.com/issues/a.jpg',
      'http://res.cloudinary.com/demo-cloud/image/upload/v1/issues/a.jpg',
      'https://res.cloudinary.com/other-cloud/image/upload/v1/issues/a.jpg',
      `${base}/v1/avatars/a.jpg`,
      `${base}/w_100,h_100/v1/issues/a.jpg`,
      `${base}/v1/issues/sub/a.jpg`,
      `${base}/v1/issues/../avatars/a.jpg`,
      `${base}/v1/issues/a.jpg?x=1`,
      `${base}/v1/issues/`,
      `${base.replace('/image/', '/video/')}/v1/issues/a.mp4`,
    ]) {
      assert.equal(isCloudinaryImageUrl(url, 'demo-cloud', 'issues'), false, url);
    }
  });

  it('accepts nothing while Cloudinary is not configured', () => {
    const url = `${base}/v1/issues/a.jpg`;
    assert.equal(isIssuePhotoUrl(url, {}), false);
    assert.equal(isIssuePhotoUrl(url, { cloudName: 'demo-cloud' }), true);
  });
});
