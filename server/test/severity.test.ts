import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  analyzeIssueSeverity,
  DEFAULT_GEMINI_MODEL,
  estimateFallbackSeverity,
  normalizeSeverityScore,
} from '../src/lib/gemini.js';
import { severityScoreToUrgency } from '../src/models/issue.model.js';

describe('severity scoring helpers', () => {
  it('maps 1-10 severity scores into low, medium, and high urgency tiers', () => {
    assert.equal(severityScoreToUrgency(1), 'low');
    assert.equal(severityScoreToUrgency(3), 'low');
    assert.equal(severityScoreToUrgency(4), 'medium');
    assert.equal(severityScoreToUrgency(7), 'medium');
    assert.equal(severityScoreToUrgency(8), 'high');
    assert.equal(severityScoreToUrgency(10), 'high');
  });

  it('clamps and rounds numeric severity scores into 1..10', () => {
    assert.equal(normalizeSeverityScore(9.4), 9);
    assert.equal(normalizeSeverityScore(15), 10);
    assert.equal(normalizeSeverityScore(0), 1);
    assert.equal(normalizeSeverityScore('8'), 8);
    assert.equal(normalizeSeverityScore('not-a-number'), null);
  });

  it('estimates deterministic fallback severity when Gemini is unavailable', () => {
    const downedWire = estimateFallbackSeverity({
      title: 'Downed power line on Saint-Denis',
      description: 'Live wire hanging over the sidewalk after wind storm.',
      category: 'streetlights_utilities',
      elements: ['high_wind'],
    });
    assert.ok(downedWire.severityScore >= 9);
    assert.equal(downedWire.urgency, 'high');

    const minorGraffiti = estimateFallbackSeverity({
      title: 'Minor graffiti on park bench',
      description: 'Small tag painted on a wooden bench.',
      category: 'parks_trees',
    });
    assert.ok(minorGraffiti.severityScore <= 3);
    assert.equal(minorGraffiti.urgency, 'low');
  });
});

describe('analyzeIssueSeverity (Gemini multimodal)', () => {
  it('sends title, description, and fetched issue images to Gemini and returns score/urgency', async () => {
    let geminiUrl = '';
    let geminiBody: Record<string, unknown> = {};
    const imageBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

    const fetchImpl: typeof fetch = async (url, init) => {
      const target = String(url);
      if (target.startsWith('https://res.cloudinary.com/')) {
        return new Response(imageBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      geminiUrl = target;
      geminiBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'assessing hazard', thought: true },
                  { text: JSON.stringify({ severityScore: 9 }) },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const result = await analyzeIssueSeverity(
      {
        title: 'Blocked bike lane on Rue Rachel Est',
        description: 'Heavy barriers force cyclists into live traffic.',
        category: 'traffic_safety',
        elements: ['snow_ice'],
        address: '1250 Rue Rachel Est',
        imageUrls: ['https://res.cloudinary.com/demo/image/upload/v1/issues/barriers.jpg'],
      },
      {
        apiKey: 'test-gemini-key',
        fetchImpl,
        allowUncheckedImageUrls: true,
      },
    );

    assert.equal(
      geminiUrl,
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,
    );
    const parts = (
      geminiBody.contents as Array<{
        parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
      }>
    )[0].parts;
    assert.match(parts[0].text ?? '', /Blocked bike lane on Rue Rachel Est/);
    assert.match(parts[0].text ?? '', /Heavy barriers force cyclists into live traffic/);
    assert.deepEqual(parts[1].inlineData, {
      mimeType: 'image/jpeg',
      data: Buffer.from(imageBytes).toString('base64'),
    });

    assert.deepEqual(result, { severityScore: 9, urgency: 'high' });
  });

  it('falls back cleanly when GEMINI_API_KEY is unset or Gemini fails', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const noKey = await analyzeIssueSeverity({
        title: 'Blocked bike lane near school',
        description: 'Construction barriers blocking the entire lane.',
        category: 'traffic_safety',
      });
      assert.ok(noKey.severityScore >= 1 && noKey.severityScore <= 10);
      assert.equal(noKey.urgency, 'high');
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }

    const failingFetch: typeof fetch = async () => new Response('overloaded', { status: 503 });
    const onError = await analyzeIssueSeverity(
      {
        title: 'Deep pothole on Saint-Denis',
        description: 'Large pothole in the right lane.',
        category: 'roads_potholes',
      },
      { apiKey: 'test-key', fetchImpl: failingFetch },
    );
    assert.equal(onError.severityScore, 6);
    assert.equal(onError.urgency, 'medium');
  });

  it('fails over automatically to a backup Gemini model when the primary model returns 503', async () => {
    const calledUrls: string[] = [];
    const failoverFetch: typeof fetch = async (url) => {
      const target = String(url);
      calledUrls.push(target);
      if (calledUrls.length === 1) {
        return new Response('high demand', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ severityScore: 8 }) }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const result = await analyzeIssueSeverity(
      {
        title: 'Fallen tree across bike path',
        description: 'Large branch completely blocks the path.',
        category: 'traffic_safety',
      },
      { apiKey: 'test-key', fetchImpl: failoverFetch },
    );

    assert.equal(calledUrls.length, 2);
    assert.deepEqual(result, { severityScore: 8, urgency: 'high' });
  });
});
