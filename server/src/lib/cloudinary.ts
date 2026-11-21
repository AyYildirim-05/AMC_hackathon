import { createHash } from 'node:crypto';

import { HttpError } from './http-error.js';

export type CloudinaryUploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  /** Signed, so the client must send it back unchanged as the `allowed_formats` form field. */
  allowedFormats: string;
  signature: string;
  uploadUrl: string;
};

/** Cloudinary rejects any other format; enforced because the parameter is signed. */
export const ALLOWED_IMAGE_FORMATS = 'jpg,png,heic,webp';

/** Issue photos live here; `isIssuePhotoUrl` accepts nothing outside it. */
export const ISSUE_PHOTO_FOLDER = 'issues';

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
  const allowedFormats = ALLOWED_IMAGE_FORMATS;
  const signature = signCloudinaryParams(
    { allowed_formats: allowedFormats, folder, timestamp },
    apiSecret,
  );

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    allowedFormats,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  };
}

/**
 * True for a delivery URL of an image uploaded to `cloudName` directly inside `folder`, the shape
 * Cloudinary returns as `secure_url`: https://res.cloudinary.com/<cloud>/image/upload/v<n>/<folder>/<id>.<ext>
 * Transformations, sub-folders, queries and fragments are rejected.
 */
export function isCloudinaryImageUrl(url: string, cloudName: string, folder: string): boolean {
  const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  if (!url.startsWith(prefix)) return false;
  const path = url.slice(prefix.length).replace(/^v\d+\//, '');
  return path.startsWith(`${folder}/`) && /^[\w.-]+$/.test(path.slice(folder.length + 1));
}

/**
 * True only for photos in this app's Cloudinary cloud and the issue photo folder. Always false
 * while CLOUDINARY_CLOUD_NAME is unset. The cloud name is read per call, like the rest of this file.
 */
export function isIssuePhotoUrl(
  url: string,
  { cloudName }: { cloudName?: string } = { cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() },
): boolean {
  return cloudName ? isCloudinaryImageUrl(url, cloudName, ISSUE_PHOTO_FOLDER) : false;
}
