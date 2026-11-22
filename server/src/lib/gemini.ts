import { HttpError } from './http-error.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const FETCH_TIMEOUT_MS = 25_000;

export function resolveGeminiEndpoint(model: string): string {
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;

export const MAX_IMAGES_PER_REQUEST = 3;
/** Caps each base64-encoded image at ~6 MB binary payload (~8 MB base64). */
export const MAX_BASE64_LENGTH_PER_IMAGE = 8_000_000;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type InlineImageInput = {
  mimeType: AllowedImageMimeType;
  base64: string;
};

export type IssueDescriptionContext = {
  category?: string;
  address?: string;
  districtName?: string;
  elements?: string[];
};

export type DescribeIssueImagesInput = {
  images: InlineImageInput[];
  language: SupportedLanguage;
  context?: IssueDescriptionContext;
};

export type DescribeIssueImagesResult = {
  description: string;
  language: SupportedLanguage;
  model: string;
};

type GeminiPart = {
  text?: string;
  thought?: boolean;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

const DATA_URL_PREFIX_RE = /^data:[^;]+;base64,/i;

/** Removes an optional `data:<mime>;base64,` prefix and whitespace from a base64 payload. */
export function stripBase64Prefix(raw: string): string {
  return raw.trim().replace(DATA_URL_PREFIX_RE, '').replace(/\s+/g, '');
}

/** Builds the system and user instructions for describing a civic issue photo in the app language. */
export function buildIssueDescriptionPrompt(
  language: SupportedLanguage,
  context?: IssueDescriptionContext,
): { systemPrompt: string; userPrompt: string } {
  const languageDirective =
    language === 'fr'
      ? 'Write the entire description strictly in natural French (français utilisé à Montréal, Québec).'
      : 'Write the entire description strictly in natural English.';

  const systemPrompt = [
    'You help residents of Montréal write clear, factual civic issue report descriptions for municipal services (MTL-311) based on submitted photos.',
    languageDirective,
    'Describe only what is clearly visible in the photo(s): the specific urban/infrastructure problem, its visible condition or severity, and any safety hazards or obstructions for pedestrians, cyclists, or vehicles.',
    'Write 2 to 4 concise plain-text sentences suitable for a municipal ticket description.',
    'Do not use markdown, bullet points, titles, headings, or introductory phrases like "Here is a description".',
    'Do not invent street names, measurements, or facts that are not visible in the image or explicitly provided in the context.',
  ].join(' ');

  const contextLines: string[] = [];
  if (context?.category) contextLines.push(`Selected category: ${context.category}`);
  if (context?.districtName) contextLines.push(`Borough/district: ${context.districtName}`);
  if (context?.address) contextLines.push(`Reported location: ${context.address}`);
  if (context?.elements && context.elements.length > 0) {
    contextLines.push(`Tagged weather/elements: ${context.elements.join(', ')}`);
  }

  const baseInstruction =
    language === 'fr'
      ? 'Rédige une description détaillée et factuelle en français du problème civique visible sur cette ou ces photo(s) pour un signalement municipal.'
      : 'Write a clear, factual description in English of the civic issue shown in the attached photo(s) for a municipal report.';

  const userPrompt =
    contextLines.length > 0
      ? `${baseInstruction}\n\nOptional report context (use only if consistent with the photo):\n${contextLines.join('\n')}`
      : baseInstruction;

  return { systemPrompt, userPrompt };
}

/**
 * Calls the Gemini `generateContent` REST API with inline image data and returns a concise
 * civic issue description in the requested application language.
 */
export async function describeIssueImages(
  input: DescribeIssueImagesInput,
  options?: {
    apiKey?: string;
    model?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<DescribeIssueImagesResult> {
  const apiKey = (options?.apiKey ?? process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) {
    throw new HttpError(503, 'Gemini API is not configured on the server');
  }

  const model = (options?.model ?? process.env.GEMINI_MODEL)?.trim() || DEFAULT_GEMINI_MODEL;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;

  const { systemPrompt, userPrompt } = buildIssueDescriptionPrompt(input.language, input.context);

  const parts = [
    { text: userPrompt },
    ...input.images.map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: stripBase64Prefix(image.base64),
      },
    })),
  ];

  const endpoint = resolveGeminiEndpoint(model);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let payload: GeminiGenerateContentResponse;
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
      signal: controller.signal,
    });

    const textBody = await res.text();
    let parsed: GeminiGenerateContentResponse | null = null;
    if (textBody) {
      try {
        parsed = JSON.parse(textBody) as GeminiGenerateContentResponse;
      } catch {
        parsed = null;
      }
    }

    if (res.status === 429 || res.status === 503) {
      throw new HttpError(503, 'Gemini API is temporarily unavailable; please try again shortly');
    }
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(502, 'Gemini API authentication failed');
    }
    if (!res.ok) {
      const apiMessage = parsed?.error?.message;
      throw new HttpError(
        502,
        apiMessage ? `Gemini API error: ${apiMessage}` : `Gemini API returned HTTP ${res.status}`,
      );
    }

    payload = parsed ?? {};
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'Unable to reach Gemini API');
  } finally {
    clearTimeout(timer);
  }

  const responseParts = payload.candidates?.[0]?.content?.parts ?? [];
  const description = responseParts
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!description) {
    throw new HttpError(502, 'Gemini did not return a description for the submitted image');
  }

  return {
    description,
    language: input.language,
    model,
  };
}
