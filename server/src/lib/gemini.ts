import { isIssuePhotoUrl } from './cloudinary.js';
import { HttpError } from './http-error.js';
import { type IssueUrgency, severityScoreToUrgency } from '../models/issue.model.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
/** Vision-capable fallback models used automatically if the primary model returns 503/429/404. */
export const FALLBACK_GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-flash-lite-latest'] as const;
export const FETCH_TIMEOUT_MS = 15_000;
const SEVERITY_TIMEOUT_MS = 8_000;
const IMAGE_FETCH_TIMEOUT_MS = 6_000;

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
  severityScore?: number;
  urgency?: IssueUrgency;
};

export type AnalyzeIssueSeverityInput = {
  title: string;
  description: string;
  category?: string;
  elements?: string[];
  address?: string;
  /** Validated Cloudinary issue photo URLs to inspect alongside title & description. */
  imageUrls?: string[];
  /** Optional inline base64 images (used when already in memory). */
  inlineImages?: InlineImageInput[];
};

export type AnalyzeIssueSeverityResult = {
  severityScore: number;
  urgency: IssueUrgency;
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

/** Clamps and rounds any numeric score into an integer between 1 and 10, or returns null. */
export function normalizeSeverityScore(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(10, Math.max(1, Math.round(num)));
}

/** Extracts the first JSON object from a Gemini text response (handles optional markdown fences). */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const tryParse = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(unfenced);
  if (direct) return direct;
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return tryParse(unfenced.slice(start, end + 1));
  }
  return null;
}

/**
 * Deterministic fallback when Gemini is unconfigured or temporarily unavailable so issue creation
 * never fails and still assigns a sensible 1–10 priority score.
 */
export function estimateFallbackSeverity(input: {
  title: string;
  description: string;
  category?: string;
  elements?: string[];
}): AnalyzeIssueSeverityResult {
  const text = `${input.title} ${input.description}`.toLowerCase();
  let score = 5;

  if (
    /\b(downed|live wire|power line|exposed wire|sinkhole|collapse|collapsed|fire|gas leak|flooded|flooding|electr|fil électrique|effondr|fuite de gaz|inond|danger mortel|urgent)\b/i.test(
      text,
    )
  ) {
    score = 9;
  } else if (
    /\b(blocked|blocking|obstruct|barriers?|broken glass|fallen tree|no light|traffic light|signal out|bloqué|obstru|barrière|clôture|arbre tombé|feu de circulation|dangereux|dangerous)\b/i.test(
      text,
    )
  ) {
    score = 8;
  } else if (
    /\b(pothole|nid-de-poule|sunken|manhole|elevator|ascenseur|streetlight|lampadaire|sidewalk|trottoir|crack|fissur)\b/i.test(
      text,
    )
  ) {
    score = 6;
  } else if (
    /\b(graffiti|litter|trash|déchet|peinture|faded|bench|banc|weed|herbe)\b/i.test(text)
  ) {
    score = 2;
  } else if (input.category === 'traffic_safety') {
    score = 7;
  } else if (input.category === 'streetlights_utilities') {
    score = 6;
  } else if (input.category === 'trash_cleanliness' || input.category === 'parks_trees') {
    score = 3;
  }

  if (input.elements && input.elements.length > 0) {
    if (
      input.elements.includes('freezing_rain') ||
      input.elements.includes('high_wind') ||
      input.elements.includes('rain_flooding')
    ) {
      score = Math.min(10, score + 1);
    }
  }

  return {
    severityScore: score,
    urgency: severityScoreToUrgency(score),
  };
}

/** Builds the system and user instructions for describing a civic issue photo in the app language. */
export function buildIssueDescriptionPrompt(
  language: SupportedLanguage,
  context?: IssueDescriptionContext,
): { systemPrompt: string; userPrompt: string } {
  const languageDirective =
    language === 'fr'
      ? 'Write the "description" field strictly in natural French (français utilisé à Montréal, Québec).'
      : 'Write the "description" field strictly in natural English.';

  const systemPrompt = [
    'You help residents of Montréal write clear, factual civic issue report descriptions for municipal services (MTL-311) based on submitted photos, and assess public-safety hazard severity.',
    languageDirective,
    'Describe only what is clearly visible in the photo(s): the specific urban/infrastructure problem, its visible condition or severity, and any safety hazards or obstructions for pedestrians, cyclists, or vehicles.',
    'Keep "description" to 2 to 4 concise plain-text sentences suitable for a municipal ticket (no markdown, no bullet points, no preamble).',
    'Do not invent street names, measurements, or facts that are not visible in the image or explicitly provided in the context.',
    'Also assign "severityScore" as an integer from 1 to 10 (10 = most severe): 8-10 = High safety hazard (e.g., downed wire, collapsed road, blocked bike lane forcing cyclists into live traffic, severe flooding/ice); 4-7 = Medium priority (e.g., deep pothole, broken streetlight, sunken manhole, out-of-service transit elevator); 1-3 = Low priority (e.g., minor litter, graffiti, cosmetic wear).',
    'Respond ONLY with a valid JSON object of the exact shape: {"description": string, "severityScore": integer}.',
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
      ? 'Analyse cette ou ces photo(s) et retourne un objet JSON avec une description détaillée en français ("description") et un score de gravité de 1 à 10 ("severityScore").'
      : 'Analyze the attached photo(s) and return a JSON object with a factual English description ("description") and a severity score from 1 to 10 ("severityScore").';

  const userPrompt =
    contextLines.length > 0
      ? `${baseInstruction}\n\nOptional report context (use only if consistent with the photo):\n${contextLines.join('\n')}`
      : baseInstruction;

  return { systemPrompt, userPrompt };
}

function buildSeverityAnalysisPrompt(input: AnalyzeIssueSeverityInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    'You triage civic infrastructure and public-safety reports for City of Montréal borough managers.',
    'Analyze the report title, description, optional context, and any attached photos, and assign an integer severity score from 1 to 10 (10 being the most severe).',
    'Scoring rubric:',
    '8-10 (High safety hazard): immediate risk of injury, collision, electrocution, structural failure, downed wires, collapsed pavement, major flooding, or blocked bike/pedestrian lanes forcing people into live traffic.',
    '4-7 (Medium priority): meaningful safety concern or infrastructure outage such as a deep pothole in a traffic lane, burned-out streetlight, broken sidewalk, sunken manhole cover, or out-of-service transit elevator.',
    '1-3 (Low priority): minor maintenance, cleanliness, or cosmetic issues with minimal immediate safety hazard (e.g., litter, graffiti, faded paint, minor park wear).',
    'Respond ONLY with a valid JSON object of the exact shape: {"severityScore": integer}.',
  ].join(' ');

  const lines = [`Title: ${input.title}`, `Description: ${input.description}`];
  if (input.category) lines.push(`Category: ${input.category}`);
  if (input.address) lines.push(`Location: ${input.address}`);
  if (input.elements && input.elements.length > 0) {
    lines.push(`Weather/elements: ${input.elements.join(', ')}`);
  }

  return {
    systemPrompt,
    userPrompt: `Rate the severity (1 to 10) of this Montréal civic issue report:\n\n${lines.join('\n')}`,
  };
}

function normalizeFetchedMimeType(contentType: string | null, url: string): AllowedImageMimeType {
  const lowered = (contentType ?? '').split(';')[0]?.trim().toLowerCase();
  if (lowered === 'image/jpeg' || lowered === 'image/jpg') return 'image/jpeg';
  if (lowered === 'image/png') return 'image/png';
  if (lowered === 'image/webp') return 'image/webp';
  if (lowered === 'image/heic') return 'image/heic';
  if (lowered === 'image/heif') return 'image/heif';

  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.heic')) return 'image/heic';
  if (clean.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

/**
 * Safely downloads validated Cloudinary issue photos (never arbitrary URLs) as base64 inline data
 * so Gemini can inspect the photos alongside title & description during issue creation.
 */
async function fetchValidatedIssueImages(
  urls: string[],
  fetchImpl: typeof fetch,
  allowUncheckedUrls = false,
): Promise<InlineImageInput[]> {
  const safeUrls = urls
    .filter((url) => allowUncheckedUrls || isIssuePhotoUrl(url))
    .slice(0, MAX_IMAGES_PER_REQUEST);
  if (safeUrls.length === 0) return [];

  const results = await Promise.all(
    safeUrls.map(async (url): Promise<InlineImageInput | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
      try {
        const res = await fetchImpl(url, { signal: controller.signal });
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString('base64');
        if (!base64 || base64.length > MAX_BASE64_LENGTH_PER_IMAGE) return null;
        return {
          mimeType: normalizeFetchedMimeType(res.headers.get('content-type'), url),
          base64,
        };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return results.filter((img): img is InlineImageInput => img !== null);
}

async function callGeminiGenerateContent(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  images: InlineImageInput[];
  temperature: number;
  maxOutputTokens: number;
  responseMimeType?: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<string> {
  const parts = [
    { text: params.userPrompt },
    ...params.images.map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: stripBase64Prefix(image.base64),
      },
    })),
  ];

  const endpoint = resolveGeminiEndpoint(params.model);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  let payload: GeminiGenerateContentResponse;
  try {
    const generationConfig: Record<string, unknown> = {
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    };
    if (params.responseMimeType) {
      generationConfig.responseMimeType = params.responseMimeType;
    }

    const res = await params.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': params.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: params.systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig,
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
  return responseParts
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

function buildModelCandidates(primaryModel: string, disableFallbacks?: boolean): string[] {
  if (disableFallbacks) return [primaryModel];
  return Array.from(new Set([primaryModel, ...FALLBACK_GEMINI_MODELS]));
}

async function callGeminiWithFallback(params: {
  apiKey: string;
  models: string[];
  systemPrompt: string;
  userPrompt: string;
  images: InlineImageInput[];
  temperature: number;
  maxOutputTokens: number;
  responseMimeType?: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<{ text: string; model: string }> {
  let lastError: unknown;
  for (let i = 0; i < params.models.length; i += 1) {
    const model = params.models[i];
    try {
      const text = await callGeminiGenerateContent({
        apiKey: params.apiKey,
        model,
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
        images: params.images,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
        responseMimeType: params.responseMimeType,
        fetchImpl: params.fetchImpl,
        timeoutMs: params.timeoutMs,
      });
      if (text) return { text, model };
      lastError = new HttpError(502, 'Gemini returned an empty response');
    } catch (err) {
      lastError = err;
      // Don't retry auth failures across models; only fail over on overload/unavailable/timeout/404.
      if (err instanceof HttpError && err.message === 'Gemini API authentication failed') {
        throw err;
      }
      if (i === params.models.length - 1) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError(502, 'Unable to reach Gemini API');
}

/**
 * Calls the Gemini `generateContent` REST API with inline image data and returns a concise
 * civic issue description in the requested application language plus an AI hazard severity score.
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

  const primaryModel = (options?.model ?? process.env.GEMINI_MODEL)?.trim() || DEFAULT_GEMINI_MODEL;
  const models = buildModelCandidates(primaryModel, Boolean(options?.model));
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;

  const { systemPrompt, userPrompt } = buildIssueDescriptionPrompt(input.language, input.context);

  const { text: rawText, model } = await callGeminiWithFallback({
    apiKey,
    models,
    systemPrompt,
    userPrompt,
    images: input.images,
    temperature: 0.3,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    fetchImpl,
    timeoutMs,
  });

  if (!rawText) {
    throw new HttpError(502, 'Gemini did not return a description for the submitted image');
  }

  const parsed = parseJsonObject(rawText);
  const description =
    typeof parsed?.description === 'string' && parsed.description.trim().length > 0
      ? parsed.description.trim()
      : rawText;
  const severityScore = normalizeSeverityScore(parsed?.severityScore) ?? undefined;

  return {
    description,
    language: input.language,
    model,
    ...(severityScore !== undefined
      ? { severityScore, urgency: severityScoreToUrgency(severityScore) }
      : {}),
  };
}

/**
 * Analyzes an issue's title, description, and images (Cloudinary URLs and/or inline base64)
 * using Gemini to assign a 1–10 severity score and low/medium/high urgency level.
 * Falls back cleanly across backup Gemini models on transient 503s, and to a deterministic
 * heuristic if Gemini is unconfigured or unavailable so creating an issue is never blocked.
 */
export async function analyzeIssueSeverity(
  input: AnalyzeIssueSeverityInput,
  options?: {
    apiKey?: string;
    model?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    /** Test-only override to allow mock image URLs without configuring Cloudinary env vars. */
    allowUncheckedImageUrls?: boolean;
  },
): Promise<AnalyzeIssueSeverityResult> {
  const apiKey = (options?.apiKey ?? process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) {
    return estimateFallbackSeverity(input);
  }

  const primaryModel = (options?.model ?? process.env.GEMINI_MODEL)?.trim() || DEFAULT_GEMINI_MODEL;
  const models = buildModelCandidates(primaryModel, Boolean(options?.model));
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? SEVERITY_TIMEOUT_MS;

  try {
    const fetchedImages =
      input.imageUrls && input.imageUrls.length > 0
        ? await fetchValidatedIssueImages(
            input.imageUrls,
            fetchImpl,
            Boolean(options?.allowUncheckedImageUrls),
          )
        : [];
    const images = [...(input.inlineImages ?? []), ...fetchedImages].slice(
      0,
      MAX_IMAGES_PER_REQUEST,
    );

    const { systemPrompt, userPrompt } = buildSeverityAnalysisPrompt(input);

    const { text: rawText } = await callGeminiWithFallback({
      apiKey,
      models,
      systemPrompt,
      userPrompt,
      images,
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      fetchImpl,
      timeoutMs,
    });

    const parsed = parseJsonObject(rawText);
    const score = normalizeSeverityScore(parsed?.severityScore ?? rawText);
    if (score !== null) {
      return {
        severityScore: score,
        urgency: severityScoreToUrgency(score),
      };
    }
  } catch {
    // Non-blocking: fall back to deterministic severity estimation on transient AI errors.
  }

  return estimateFallbackSeverity(input);
}
