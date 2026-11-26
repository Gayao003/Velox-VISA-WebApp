/**
 * Philippine Standard Time (PST / PHT) Utilities
 * IANA Time Zone: Asia/Manila (UTC+8, no DST)
 */

export const PH_TIMEZONE = 'Asia/Manila';

/**
 * Parses any date input into a valid Date object.
 * Also handles ISO strings missing timezone offsets or double-shifted timestamps.
 */
export function parseDate(dateInput: string | number | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? new Date() : dateInput;

  let str = String(dateInput).trim();
  if (!str) return new Date();

  // If string contains date and time but no timezone designator ('Z' or +/- offset),
  // e.g. "2026-11-24T15:33:00.123456", treat it as Philippine Standard Time (UTC+8)
  if (
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)
  ) {
    str = str.replace(' ', 'T') + '+08:00';
  }

  const d = new Date(str);
  if (isNaN(d.getTime())) return new Date();

  // If timestamp is erroneously in the future (e.g. from historical double-shift bug where local time was tagged +00:00),
  // adjust by -8 hours if it's more than 2 hours ahead of now.
  const now = Date.now();
  if (d.getTime() > now + 2 * 60 * 60 * 1000 && d.getTime() <= now + 10 * 60 * 60 * 1000) {
    return new Date(d.getTime() - 8 * 60 * 60 * 1000);
  }

  return d;
}

/**
 * Formats time in Philippine Time (e.g. "11:24:24 AM" or "04:58 PM")
 */
export function formatPhTime(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';
  const d = parseDate(dateInput);
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleTimeString('en-US', {
    timeZone: PH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  });
}

/**
 * Formats date in Philippine Time (e.g. "Nov 24, 2026" or "11/24/2026")
 */
export function formatPhDate(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';
  const d = parseDate(dateInput);
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleDateString('en-US', {
    timeZone: PH_TIMEZONE,
    month: options?.month || 'short',
    day: options?.day || 'numeric',
    year: options?.year || 'numeric',
    ...options,
  });
}

/**
 * Formats date and time in Philippine Time (e.g. "Nov 24, 2026, 04:58 PM")
 */
export function formatPhDateTime(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';
  const d = parseDate(dateInput);
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleString('en-US', {
    timeZone: PH_TIMEZONE,
    month: options?.month || 'short',
    day: options?.day || 'numeric',
    year: options?.year || 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  });
}

/**
 * Returns current timestamp in ISO format with explicit Philippine timezone or UTC.
 */
export function getPhIsoString(date = new Date()): string {
  return date.toISOString();
}
