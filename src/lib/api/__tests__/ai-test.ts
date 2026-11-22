import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { describeIssueImages, normalizeImageMimeType, prepareInlineImage } from '@/lib/api/ai';
import { apiClient } from '@/lib/api/client';

describe('ai API client', () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    jest.restoreAllMocks();
  });

  it('normalizes image MIME types from explicit values or file extensions', () => {
    expect(normalizeImageMimeType('image/jpg')).toBe('image/jpeg');
    expect(normalizeImageMimeType('IMAGE/PNG')).toBe('image/png');
    expect(normalizeImageMimeType(null, 'photo.webp')).toBe('image/webp');
    expect(normalizeImageMimeType(undefined, 'file:///shot.heic')).toBe('image/heic');
    expect(normalizeImageMimeType(undefined, 'file:///unknown.bin')).toBe('image/jpeg');
  });

  it('prepares inline images directly from base64 or data URLs without fetching', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const fromBase64 = await prepareInlineImage({
      uri: 'file:///pothole.png',
      base64: 'iVBORw0KGgo=',
      mimeType: 'image/png',
    });
    expect(fromBase64).toEqual({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' });

    const fromDataUri = await prepareInlineImage({
      uri: 'data:image/webp;base64,UklGRh4=',
    });
    expect(fromDataUri).toEqual({ mimeType: 'image/webp', base64: 'UklGRh4=' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends encoded images, language, and context to POST /api/ai/describe-image', async () => {
    let capturedBody: Record<string, unknown> = {};
    let capturedTimeout: number | undefined;

    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      capturedBody = JSON.parse(String(config.data ?? '{}')) as Record<string, unknown>;
      capturedTimeout = config.timeout;
      const response: AxiosResponse = {
        data: {
          description: 'Un nid-de-poule profond bloque la piste cyclable.',
          language: 'fr',
          model: 'gemini-2.5-flash',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
      return response;
    };

    const result = await describeIssueImages({
      images: [
        {
          uri: 'file:///bike-lane.jpg',
          base64: '/9j/4AAQ',
          mimeType: 'image/jpeg',
        },
      ],
      language: 'fr',
      context: {
        category: 'traffic_safety',
        districtName: 'Le Plateau-Mont-Royal',
      },
    });

    expect(capturedTimeout).toBe(30_000);
    expect(capturedBody).toEqual({
      images: [{ mimeType: 'image/jpeg', base64: '/9j/4AAQ' }],
      language: 'fr',
      context: {
        category: 'traffic_safety',
        districtName: 'Le Plateau-Mont-Royal',
      },
    });
    expect(result).toEqual({
      description: 'Un nid-de-poule profond bloque la piste cyclable.',
      language: 'fr',
      model: 'gemini-2.5-flash',
    });
  });
});
