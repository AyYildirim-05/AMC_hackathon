import { Platform } from 'react-native';

import { apiClient } from '@/lib/api/client';

export type UploadFolder = 'issues' | 'avatars';

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  /** Signed by the server, so it must be sent back unchanged or Cloudinary rejects the upload. */
  allowedFormats: string;
  signature: string;
  uploadUrl: string;
};

export type UploadableImage =
  | string
  | {
      uri: string;
      mimeType?: string | null;
      fileName?: string | null;
    };

export type UploadedImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  error?: { message?: string };
};

function normalizeImage(input: UploadableImage) {
  const uri = typeof input === 'string' ? input : input.uri;
  const fallbackName = uri.split('/').pop()?.split('?')[0] || `upload-${Date.now()}.jpg`;
  const fileName = (typeof input === 'string' ? undefined : input.fileName) || fallbackName;
  const mimeType =
    (typeof input === 'string' ? undefined : input.mimeType) || guessMimeType(fileName);
  return { uri, fileName, mimeType };
}

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

/** Requests a short-lived Cloudinary upload signature from the Express backend. */
export async function requestUploadSignature(folder?: UploadFolder): Promise<UploadSignature> {
  const { data } = await apiClient.post<UploadSignature>(
    '/api/uploads/signature',
    folder ? { folder } : {},
  );
  return data;
}

/**
 * Uploads a single local image (e.g. from `expo-image-picker`) directly to Cloudinary
 * using a server-signed upload payload, and returns its HTTPS `url` (`secure_url`).
 */
export async function uploadImageToCloudinary(
  image: UploadableImage,
  options?: { folder?: UploadFolder },
): Promise<UploadedImage> {
  const sig = await requestUploadSignature(options?.folder);
  const { uri, fileName, mimeType } = normalizeImage(image);

  const formData = new FormData();
  if (Platform.OS === 'web') {
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    formData.append('file', blob, fileName);
  } else {
    // React Native's FormData accepts `{ uri, name, type }` file descriptors.
    formData.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
  }
  formData.append('api_key', sig.apiKey);
  formData.append('timestamp', String(sig.timestamp));
  formData.append('folder', sig.folder);
  formData.append('allowed_formats', sig.allowedFormats);
  formData.append('signature', sig.signature);

  const uploadRes = await fetch(sig.uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const payload = (await uploadRes.json()) as CloudinaryUploadResponse;
  if (!uploadRes.ok || !payload.secure_url || !payload.public_id) {
    throw new Error(payload.error?.message || `Cloudinary upload failed (${uploadRes.status})`);
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    width: payload.width ?? 0,
    height: payload.height ?? 0,
  };
}

/** Uploads multiple images in parallel and returns their HTTPS URLs for `POST /api/issues`. */
export async function uploadImagesToCloudinary(
  images: UploadableImage[],
  options?: { folder?: UploadFolder },
): Promise<string[]> {
  const uploaded = await Promise.all(
    images.map((image) => uploadImageToCloudinary(image, options)),
  );
  return uploaded.map((item) => item.url);
}

/**
 * Uploads an issue report's photos and returns the URLs to send as the issue's `images`.
 * Always the `issues` folder: the server accepts no other photo URL on an issue.
 */
export function uploadIssuePhotos(images: UploadableImage[]): Promise<string[]> {
  return uploadImagesToCloudinary(images, { folder: 'issues' });
}
