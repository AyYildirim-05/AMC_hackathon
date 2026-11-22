import { Linking } from 'react-native';

import { brand } from '@/brand';
import i18n from '@/i18n';
import type { Translations } from '@/i18n/locales/en';
import type { Issue } from '@/models/Issue';

/**
 * 311 hand-off by email. Montréal has no public API or email intake for 311 requests, so the app
 * doesn't send anything itself: it opens the resident's own mail app with the report written out,
 * and the resident reviews it, picks or confirms the recipient, and sends it.
 *
 * The recipient is `EXPO_PUBLIC_311_EMAIL` when set (e.g. a borough or demo inbox), else left
 * blank for the resident to fill in.
 */

/** Short reference for a report, shown in the email and the app (e.g. "MonTone #A1B2C3"). */
export function reportReference(issueId: string): string {
  const code = issueId
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `${brand.name} #${code}`;
}

export type Report311Email = { to: string; subject: string; body: string };

/** The 311 email for an issue, in the app's current language. */
export function build311Email(
  issue: Pick<
    Issue,
    'id' | 'title' | 'description' | 'category' | 'address' | 'latitude' | 'longitude' | 'images'
  >,
  options: { districtName?: string | null; to?: string | null } = {},
): Report311Email {
  const t = i18n.t.bind(i18n);
  const reference = reportReference(issue.id);
  const category = t(`issue.category.${issue.category}`);
  // "Label : value" in French, "Label: value" in English.
  const field = (key: keyof Translations['report311']['fields'], value: string) =>
    `${t(`report311.fields.${key}`)}${t('report311.separator')}${value}`;
  const lat = issue.latitude.toFixed(6);
  const lng = issue.longitude.toFixed(6);

  const lines = [
    t('report311.greeting'),
    '',
    t('report311.intro'),
    '',
    field('category', `${category}`),
    field('title', `${issue.title}`),
    issue.description ? field('description', `${issue.description}`) : null,
    field('address', `${issue.address}`),
    options.districtName ? field('borough', `${options.districtName}`) : null,
    field('gps', `${lat}, ${lng}`),
    field('map', `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`),
    ...(issue.images.length > 0
      ? [
          `${t('report311.fields.photos')}${t('report311.separator').trimEnd()}`,
          ...issue.images.map((url) => `- ${url}`),
        ]
      : []),
    field('reference', `${reference}`),
    '',
    t('report311.closing'),
  ].filter((line): line is string => line !== null);

  return {
    to: options.to ?? process.env.EXPO_PUBLIC_311_EMAIL ?? '',
    subject: `[${reference}] ${category} — ${issue.address}`,
    body: lines.join('\n'),
  };
}

/** `mailto:` link for the email; every part is encoded, so any text survives. */
export function mailtoUrl({ to, subject, body }: Report311Email): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Opens the resident's mail app with the email. False when no mail app can take it. */
export async function open311Email(email: Report311Email): Promise<boolean> {
  try {
    await Linking.openURL(mailtoUrl(email));
    return true;
  } catch {
    return false;
  }
}

/** Montréal's 311 phone line (311 on the island; the full number works from anywhere). */
export const MONTREAL_311_PHONE = '514-872-0311';

export async function call311(): Promise<boolean> {
  try {
    await Linking.openURL(`tel:${MONTREAL_311_PHONE.replace(/-/g, '')}`);
    return true;
  } catch {
    return false;
  }
}
