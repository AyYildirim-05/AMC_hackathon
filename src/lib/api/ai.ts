import type { Language } from '@/i18n';
import { apiClient } from '@/lib/api/client';

export type SupportedImageMimeType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif';

export type AiImageSource = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

export type IssueDescriptionContext = {
  category?: string;
  address?: string;
  districtName?: string;
  elements?: string[];
};

export type DescribeIssueImagesRequest = {
  images: AiImageSource[];
  language: Language;
  context?: IssueDescriptionContext;
};

export type DescribeIssueImagesResponse = {
  description: string;
  language: Language;
  model?: string;
};

type EncodedInlineImage = {
  mimeType: SupportedImageMimeType;
  base64: string;
};

const DATA_URL_RE = /^data:([^;]+);base64,(.+)$/i;

export function normalizeImageMimeType(
  mimeType?: string | null,
  fileNameOrUri?: string | null,
): SupportedImageMimeType {
  const lowered = mimeType?.trim().toLowerCase();
  if (lowered === 'image/jpeg' || lowered === 'image/jpg') return 'image/jpeg';
  if (lowered === 'image/png') return 'image/png';
  if (lowered === 'image/webp') return 'image/webp';
  if (lowered === 'image/heic') return 'image/heic';
  if (lowered === 'image/heif') return 'image/heif';

  const cleanPath = (fileNameOrUri ?? '').split('?')[0].toLowerCase();
  if (cleanPath.endsWith('.png')) return 'image/png';
  if (cleanPath.endsWith('.webp')) return 'image/webp';
  if (cleanPath.endsWith('.heic')) return 'image/heic';
  if (cleanPath.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function stripDataUrlPrefix(value: string): string {
  return value
    .trim()
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s+/g, '');
}

function bytesToBase64(bytes: Uint8Array): string {
  const BufferCtor = (globalThis as { Buffer?: typeof Buffer }).Buffer;
  if (typeof BufferCtor !== 'undefined') {
    return BufferCtor.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return globalThis.btoa(binary);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Could not encode image data'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Could not read image data'));
      reader.readAsDataURL(blob);
    });
  }
  const buffer = await blob.arrayBuffer();
  const base64 = bytesToBase64(new Uint8Array(buffer));
  const mime = blob.type || 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

/**
 * Normalizes a local or remote image into `{ mimeType, base64 }` for `POST /api/ai/describe-image`.
 * Prefers `base64` returned directly by `expo-image-picker` to avoid re-reading files on device.
 */
export async function prepareInlineImage(source: AiImageSource): Promise<EncodedInlineImage> {
  if (source.base64 && source.base64.trim().length > 0) {
    const dataMatch = source.base64.trim().match(DATA_URL_RE);
    if (dataMatch) {
      return {
        mimeType: normalizeImageMimeType(dataMatch[1], source.fileName ?? source.uri),
        base64: stripDataUrlPrefix(dataMatch[2]),
      };
    }
    return {
      mimeType: normalizeImageMimeType(source.mimeType, source.fileName ?? source.uri),
      base64: stripDataUrlPrefix(source.base64),
    };
  }

  const uriMatch = source.uri.trim().match(DATA_URL_RE);
  if (uriMatch) {
    return {
      mimeType: normalizeImageMimeType(uriMatch[1], source.fileName),
      base64: stripDataUrlPrefix(uriMatch[2]),
    };
  }

  const response = await fetch(source.uri);
  if (!response.ok) {
    throw new Error(`Could not read image (${response.status})`);
  }
  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);
  const parsed = dataUrl.match(DATA_URL_RE);
  if (!parsed) {
    throw new Error('Could not encode image as base64');
  }

  return {
    mimeType: normalizeImageMimeType(
      blob.type || source.mimeType || parsed[1],
      source.fileName ?? source.uri,
    ),
    base64: stripDataUrlPrefix(parsed[2]),
  };
}

/**
 * Calls the backend Gemini endpoint to generate a report description in the app's current language
 * based on the submitted photo(s).
 */
export async function describeIssueImages(
  request: DescribeIssueImagesRequest,
): Promise<DescribeIssueImagesResponse> {
  const encodedImages = await Promise.all(request.images.slice(0, 3).map(prepareInlineImage));
  const language: Language = request.language === 'fr' ? 'fr' : 'en';

  const { data } = await apiClient.post<DescribeIssueImagesResponse>(
    '/api/ai/describe-image',
    {
      images: encodedImages,
      language,
      context: request.context,
    },
    { timeout: 30_000 },
  );

  return {
    description: typeof data?.description === 'string' ? data.description.trim() : '',
    language: data?.language === 'fr' ? 'fr' : 'en',
    model: data?.model,
  };
}
