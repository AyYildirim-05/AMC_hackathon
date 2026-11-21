import { apiClient } from '@/lib/api/client';
import { uploadImagesToCloudinary, uploadImageToCloudinary } from '@/lib/uploads/cloudinary';

describe('cloudinary upload helper', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('requests a backend signature and uploads directly to Cloudinary', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        cloudName: 'demo-cloud',
        apiKey: 'key-123',
        timestamp: 1700000000,
        folder: 'issues',
        signature: 'sig-abc',
        uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      },
    });

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
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        cloudName: 'demo-cloud',
        apiKey: 'key-123',
        timestamp: 1700000000,
        folder: 'issues',
        signature: 'sig-abc',
        uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      },
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/1.jpg', public_id: '1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/2.jpg', public_id: '2' }),
      }) as unknown as typeof fetch;

    const urls = await uploadImagesToCloudinary(['file:///1.jpg', 'file:///2.jpg']);
    expect(urls).toEqual([
      'https://res.cloudinary.com/demo/1.jpg',
      'https://res.cloudinary.com/demo/2.jpg',
    ]);
  });

  it('throws the Cloudinary error message on failure', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        cloudName: 'demo-cloud',
        apiKey: 'key-123',
        timestamp: 1700000000,
        folder: 'issues',
        signature: 'sig-abc',
        uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      },
    });

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid image file' } }),
    }) as unknown as typeof fetch;

    await expect(uploadImageToCloudinary('file:///bad.txt')).rejects.toThrow('Invalid image file');
  });
});
