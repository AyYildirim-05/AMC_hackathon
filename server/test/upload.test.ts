import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { signCloudinaryParams } from '../src/lib/cloudinary.js';

const app = createApp();

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
  it('rejects unknown folder names with 400', async () => {
    const res = await request(app).post('/api/uploads/signature').send({ folder: '../etc' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
  });

  it('returns a valid upload signature when Cloudinary env vars are configured', async () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    const res = await request(app).post('/api/uploads/signature').send({ folder: 'issues' });

    if (!cloudName || !apiKey || !apiSecret) {
      assert.equal(res.status, 503);
      return;
    }

    assert.equal(res.status, 200);
    assert.equal(res.body.cloudName, cloudName);
    assert.equal(res.body.apiKey, apiKey);
    assert.equal(res.body.folder, 'issues');
    assert.equal(res.body.uploadUrl, `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    assert.equal(
      res.body.signature,
      signCloudinaryParams({ folder: 'issues', timestamp: res.body.timestamp }, apiSecret),
    );
  });
});
