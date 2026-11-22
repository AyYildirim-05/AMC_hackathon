import { apiClient } from '@/lib/api/client';
import {
  uploadImagesToCloudinary,
  uploadImageToCloudinary,
  uploadIssuePhotos,
} from '@/lib/uploads/cloudinary';

const MOCK_SIGNATURE = {
  cloudName: 'demo-cloud',
  apiKey: 'key-123',
  timestamp: 1700000000,
  folder: 'issues',
  allowedFormats: 'jpg,png,heic,webp',
  signature: 'sig-abc',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
};

const mockBlobResponse = () => ({
  ok: true,
  status: 200,
  blob: async () => new Blob(['fake-image-bytes'], { type: 'image/jpeg' }),
});

describe('cloudinary upload helper', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('uploads directly with a base64 data URI string (avoiding RN FormDataPart errors)', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: MOCK_SIGNATURE });

    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/issues/pothole.jpg',
        public_id: 'issues/pothole',
        width: 1200,
        height: 900,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await uploadImageToCloudinary(
      {
        uri: 'file:///tmp/IMG_001.HEIC',
        mimeType: 'image/heic',
        fileName: 'IMG_001.HEIC',
        base64: '/9j/4AAQSkZJRg==',
      },
      { folder: 'issues' },
    );

    expect(postSpy).toHaveBeenCalledWith('/api/uploads/signature', { folder: 'issues' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const form: FormData = fetchMock.mock.calls[0][1].body;
    expect(form.get('file')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(result).toEqual({
      url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/issues/pothole.jpg',
      publicId: 'issues/pothole',
      width: 1200,
      height: 900,
    });
  });

  it('reads local file URIs into a Blob when base64 is not provided and uploads to Cloudinary', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: MOCK_SIGNATURE });

    const fetchMock = jest.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('file://')) return mockBlobResponse();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/issues/pothole.jpg',
          public_id: 'issues/pothole',
          width: 1200,
          height: 900,
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await uploadImageToCloudinary(
      { uri: 'file:///tmp/pothole.jpg', mimeType: 'image/jpeg', fileName: 'pothole.jpg' },
      { folder: 'issues' },
    );

    expect(postSpy).toHaveBeenCalledWith('/api/uploads/signature', { folder: 'issues' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(result).toEqual({
      url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/issues/pothole.jpg',
      publicId: 'issues/pothole',
      width: 1200,
      height: 900,
    });
  });

  it('uploads multiple images and returns their URLs', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({ data: MOCK_SIGNATURE });

    let uploadIndex = 0;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('file://')) return mockBlobResponse();
      const current = ++uploadIndex;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          secure_url: `https://res.cloudinary.com/demo/${current}.jpg`,
          public_id: String(current),
        }),
      };
    }) as unknown as typeof fetch;

    const urls = await uploadImagesToCloudinary(['file:///1.jpg', 'file:///2.jpg']);
    expect(urls).toEqual([
      'https://res.cloudinary.com/demo/1.jpg',
      'https://res.cloudinary.com/demo/2.jpg',
    ]);
  });

  it('sends back every signed field, including allowed_formats', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: MOCK_SIGNATURE });
    const fetchMock = jest.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('file://')) return mockBlobResponse();
      return {
        ok: true,
        status: 200,
        json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/1.jpg', public_id: '1' }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await uploadImageToCloudinary('file:///1.jpg', { folder: 'issues' });

    // Cloudinary recomputes the signature from these exact fields; any missing one fails with 401.
    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('api.cloudinary.com'),
    );
    const form: FormData = uploadCall?.[1].body;
    expect({
      api_key: form.get('api_key'),
      timestamp: form.get('timestamp'),
      folder: form.get('folder'),
      allowed_formats: form.get('allowed_formats'),
      signature: form.get('signature'),
    }).toEqual({
      api_key: 'key-123',
      timestamp: '1700000000',
      folder: 'issues',
      allowed_formats: 'jpg,png,heic,webp',
      signature: 'sig-abc',
    });
  });

  it('uploads issue photos to the issues folder', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({ data: MOCK_SIGNATURE });
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('file://')) return mockBlobResponse();
      return {
        ok: true,
        status: 200,
        json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/1.jpg', public_id: '1' }),
      };
    }) as unknown as typeof fetch;

    expect(await uploadIssuePhotos([{ uri: 'file:///1.jpg' }])).toEqual([
      'https://res.cloudinary.com/demo/1.jpg',
    ]);
    expect(postSpy).toHaveBeenCalledWith('/api/uploads/signature', { folder: 'issues' });
  });

  it('throws the Cloudinary error message on failure', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: MOCK_SIGNATURE });

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('file://')) return mockBlobResponse();
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid image file' } }),
      };
    }) as unknown as typeof fetch;

    await expect(uploadImageToCloudinary('file:///bad.txt')).rejects.toThrow('Invalid image file');
  });
});
