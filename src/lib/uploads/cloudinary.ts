import { detectMimeTypeFromBase64 } from '@/lib/api/ai';
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
      base64?: string | null;
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
  const base64 = typeof input === 'string' ? undefined : input.base64;
  return { uri, fileName, mimeType, base64 };
}

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function toBase64DataUri(rawBase64: string, fallbackMimeType: string): string {
  const trimmed = rawBase64.trim();
  if (/^data:[^;]*;base64,/i.test(trimmed)) return trimmed;
  const cleaned = trimmed.replace(/\s+/g, '');
  const detectedMime = detectMimeTypeFromBase64(cleaned) ?? fallbackMimeType;
  return `data:${detectedMime};base64,${cleaned}`;
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
 *
 * Uses a base64 data URI string when available (or reads the URI into a standard `Blob`
 * otherwise) so Expo SDK 58's WinterCG `fetch` never fails with
 * `Unsupported FormDataPart implementation` on iOS/Android.
 */
export async function uploadImageToCloudinary(
  image: UploadableImage,
  options?: { folder?: UploadFolder },
): Promise<UploadedImage> {
  const sig = await requestUploadSignature(options?.folder);
  const { uri, fileName, mimeType, base64 } = normalizeImage(image);

  const formData = new FormData();
  if (base64 && base64.trim().length > 0) {
    formData.append('file', toBase64DataUri(base64, mimeType));
  } else if (/^data:/i.test(uri.trim())) {
    formData.append('file', uri.trim());
  } else {
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    formData.append('file', blob, fileName);
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
