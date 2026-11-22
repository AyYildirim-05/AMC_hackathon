import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import express from 'express';
import request from 'supertest';

import { createApp } from '../src/app.js';
import {
  DEFAULT_GEMINI_MODEL,
  describeIssueImages,
  resolveGeminiEndpoint,
  stripBase64Prefix,
} from '../src/lib/gemini.js';
import { signToken } from '../src/lib/jwt.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createAiRouter } from '../src/routes/ai.routes.js';

const app = createApp();
const auth = () =>
  `Bearer ${signToken({ sub: '64b7f0c2a1b2c3d4e5f60719', role: 'resident', type: 'access' }, 60)}`;

describe('gemini helper (describeIssueImages)', () => {
  it('strips optional data URL prefixes and whitespace from base64 strings', () => {
    assert.equal(
      stripBase64Prefix('data:image/jpeg;base64, /9j/4AAQ\nSkZJRg== '),
      '/9j/4AAQSkZJRg==',
    );
    assert.equal(stripBase64Prefix('abc123'), 'abc123');
  });

  it('builds the Gemini generateContent endpoint for the configured model', () => {
    assert.equal(
      resolveGeminiEndpoint('gemini-3.8-flash'),
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    );
  });

  it('throws 503 when GEMINI_API_KEY is missing', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await assert.rejects(
        describeIssueImages({
          images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }],
          language: 'en',
        }),
        { status: 503 },
      );
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });

  it('sends images, context, and French language instructions to Gemini REST API', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};

    const fetchImpl: typeof fetch = async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'internal reasoning', thought: true },
                  {
                    text: 'Un grand nid-de-poule rempli d’eau occupe la voie de droite, créant un danger pour les cyclistes et automobilistes.',
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const result = await describeIssueImages(
      {
        images: [{ mimeType: 'image/jpeg', base64: 'data:image/jpeg;base64, /9j/4AAQ ' }],
        language: 'fr',
        context: {
          category: 'roads_potholes',
          districtName: 'Le Plateau-Mont-Royal',
          address: '1250 Rue Rachel Est',
          elements: ['rain_flooding'],
        },
      },
      { apiKey: 'test-gemini-key', fetchImpl },
    );

    assert.equal(
      capturedUrl,
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,
    );
    assert.equal(capturedHeaders['x-goog-api-key'], 'test-gemini-key');

    const systemText = (capturedBody.systemInstruction as { parts: Array<{ text: string }> })
      .parts[0].text;
    assert.match(systemText, /French/i);

    const userParts = (
      capturedBody.contents as Array<{
        parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
      }>
    )[0].parts;
    assert.match(userParts[0].text ?? '', /français/i);
    assert.match(userParts[0].text ?? '', /Le Plateau-Mont-Royal/);
    assert.deepEqual(userParts[1].inlineData, {
      mimeType: 'image/jpeg',
      data: '/9j/4AAQ',
    });

    assert.equal(
      result.description,
      'Un grand nid-de-poule rempli d’eau occupe la voie de droite, créant un danger pour les cyclistes et automobilistes.',
    );
    assert.equal(result.language, 'fr');
    assert.equal(result.model, DEFAULT_GEMINI_MODEL);
  });

  it('requests English output when language is en', async () => {
    let systemText = '';
    let userText = '';
    const fetchImpl: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        systemInstruction: { parts: Array<{ text: string }> };
        contents: Array<{ parts: Array<{ text?: string }> }>;
      };
      systemText = body.systemInstruction.parts[0].text;
      userText = body.contents[0].parts[0].text ?? '';
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'A broken streetlight pole is leaning over the sidewalk.' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const result = await describeIssueImages(
      {
        images: [{ mimeType: 'image/png', base64: 'iVBORw0KGgo=' }],
        language: 'en',
      },
      { apiKey: 'test-gemini-key', model: 'gemini-2.0-flash', fetchImpl },
    );

    assert.match(systemText, /strictly in natural English/i);
    assert.match(userText, /in English/i);
    assert.equal(result.description, 'A broken streetlight pole is leaning over the sidewalk.');
    assert.equal(result.language, 'en');
    assert.equal(result.model, 'gemini-2.0-flash');
  });

  it('maps rate-limit 429 responses to HTTP 503 and empty candidates to 502', async () => {
    const rateLimited: typeof fetch = async () => new Response('quota exceeded', { status: 429 });
    await assert.rejects(
      describeIssueImages(
        { images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }], language: 'en' },
        { apiKey: 'key', fetchImpl: rateLimited },
      ),
      { status: 503 },
    );

    const emptyCandidate: typeof fetch = async () =>
      new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    await assert.rejects(
      describeIssueImages(
        { images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }], language: 'en' },
        { apiKey: 'key', fetchImpl: emptyCandidate },
      ),
      { status: 502 },
    );
  });
});

describe('POST /api/ai/describe-image', () => {
  it('requires a signed-in user', async () => {
    const res = await request(app)
      .post('/api/ai/describe-image')
      .send({
        images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }],
        language: 'fr',
      });
    assert.equal(res.status, 401);
  });

  it('rejects empty images, unsupported mime types, too many images, and unknown languages', async () => {
    const invalidPayloads = [
      { images: [], language: 'en' },
      { images: [{ mimeType: 'image/gif', base64: 'AAAA' }], language: 'en' },
      {
        images: [
          { mimeType: 'image/jpeg', base64: 'A' },
          { mimeType: 'image/jpeg', base64: 'B' },
          { mimeType: 'image/jpeg', base64: 'C' },
          { mimeType: 'image/jpeg', base64: 'D' },
        ],
        language: 'en',
      },
      { images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }], language: 'es' },
    ];

    for (const payload of invalidPayloads) {
      const res = await request(app)
        .post('/api/ai/describe-image')
        .set('Authorization', auth())
        .send(payload);
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'Validation failed');
    }
  });

  it('returns 503 when GEMINI_API_KEY is not configured', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await request(app)
        .post('/api/ai/describe-image')
        .set('Authorization', auth())
        .send({
          images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }],
          language: 'fr',
        });
      assert.equal(res.status, 503);
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });

  it('returns the generated description in the requested language when configured', async () => {
    const testApp = express();
    testApp.use(express.json({ limit: '15mb' }));
    testApp.use(
      '/api/ai',
      createAiRouter({
        describeImages: async (input) => ({
          description:
            input.language === 'fr'
              ? 'Des cônes orange bloquent la piste cyclable.'
              : 'Orange traffic cones are blocking the bike lane.',
          language: input.language,
          model: DEFAULT_GEMINI_MODEL,
        }),
      }),
    );
    testApp.use(errorHandler);

    const frRes = await request(testApp)
      .post('/api/ai/describe-image')
      .set('Authorization', auth())
      .send({
        images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }],
        language: 'fr',
      });
    assert.equal(frRes.status, 200);
    assert.deepEqual(frRes.body, {
      description: 'Des cônes orange bloquent la piste cyclable.',
      language: 'fr',
      model: DEFAULT_GEMINI_MODEL,
    });

    const enRes = await request(testApp)
      .post('/api/ai/describe-image')
      .set('Authorization', auth())
      .send({
        images: [{ mimeType: 'image/png', base64: 'BBBB' }],
        language: 'en',
      });
    assert.equal(enRes.status, 200);
    assert.deepEqual(enRes.body, {
      description: 'Orange traffic cones are blocking the bike lane.',
      language: 'en',
      model: DEFAULT_GEMINI_MODEL,
    });
  });
});
