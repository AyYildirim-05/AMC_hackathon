/** Formats ISO timestamp to short day + month, e.g. `18 nov`. */
export function formatIssueDate(isoString: string, locale = 'fr'): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const day = date.getUTCDate();
    const month = date.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
    return `${day} ${month}`;
  } catch {
    return '';
  }
}

/** Cleans address for card presentation, trimming trailing postal code if present. */
export function formatAddress(address: string): string {
  return address.replace(/,\s*[A-Z]{2}\s+[A-Z0-9\s]+$/i, '').trim();
}

/** Computes avatar initials from a username or full name. */
export function computeInitials(nameOrHandle?: string): string {
  if (!nameOrHandle) return 'AV';
  const clean = nameOrHandle.replace(/^@/, '');
  const parts = clean.split(/[_\s.-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
