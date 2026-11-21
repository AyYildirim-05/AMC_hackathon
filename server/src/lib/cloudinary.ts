import { createHash } from 'node:crypto';

import { HttpError } from './http-error.js';

export type CloudinaryUploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
};

/**
 * Computes a Cloudinary upload signature per Cloudinary's REST API spec:
 * sort non-empty signed params alphabetically, join as `k=v&...`, append apiSecret, SHA-1 hex.
 */
export function signCloudinaryParams(
  params: Record<string, string | number | undefined>,
  apiSecret: string,
): string {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

export function createUploadSignature(options?: {
  folder?: string;
  timestamp?: number;
}): CloudinaryUploadSignature {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError(503, 'Cloudinary is not configured on the server');
  }

  const folder = options?.folder ?? (process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || 'issues');
  const timestamp = options?.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = signCloudinaryParams({ folder, timestamp }, apiSecret);

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  };
}
