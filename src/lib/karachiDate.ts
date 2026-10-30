/**
 * PyntFlow Authoritative Asia/Karachi (PKT, UTC+5) Date Formatter & Utility
 *
 * Avoids the classic UTC date rollback bug where calling `new Date().toISOString().split('T')[0]`
 * returns the PREVIOUS calendar day between 00:00:00 and 04:59:59 PKT (e.g. 02:00 PKT on Oct 30
 * is 21:00 UTC on Oct 29).
 */

const KARACHI_TIMEZONE = 'Asia/Karachi';

/**
 * Returns today's calendar date in Asia/Karachi timezone formatted as YYYY-MM-DD.
 */
export function karachiToday(): string {
  return formatKarachiDate(new Date());
}

/**
 * Formats any Date object, ISO string, or epoch timestamp into a YYYY-MM-DD date string
 * in the Asia/Karachi timezone.
 *
 * @param date Input date (defaults to current time if omitted)
 */
export function formatKarachiDate(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to formatKarachiDate: ${date}`);
  }

  // Use Intl.DateTimeFormat with en-CA which formats natively as YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KARACHI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(d);
}

/**
 * Formats any Date object into an Asia/Karachi human-readable timestamp string (YYYY-MM-DD HH:mm:ss).
 */
export function formatKarachiTimestamp(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to formatKarachiTimestamp: ${date}`);
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KARACHI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}
