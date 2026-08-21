/**
 * Presentation-only Persian/Iran date & time helpers for the localized build.
 * Keeps timestamps and backend values untouched; only the rendered text uses
 * the Solar Hijri calendar and Asia/Tehran time zone.
 */
export const IRAN_TIME_ZONE = 'Asia/Tehran';
export const PERSIAN_CALENDAR_LOCALE = 'fa-IR-u-ca-persian';

export function formatIranDateTime(date: Date | number | string = new Date()): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(PERSIAN_CALENDAR_LOCALE, {
    timeZone: IRAN_TIME_ZONE,
    calendar: 'persian',
    numberingSystem: 'arabext',
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

export function formatIranDate(
  date: Date | number | string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(PERSIAN_CALENDAR_LOCALE, {
    timeZone: IRAN_TIME_ZONE,
    calendar: 'persian',
    numberingSystem: 'arabext',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(value);
}

export function formatIranTime(
  date: Date | number | string = new Date(),
  options: Intl.DateTimeFormatOptions = {},
): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(PERSIAN_CALENDAR_LOCALE, {
    timeZone: IRAN_TIME_ZONE,
    numberingSystem: 'arabext',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(value);
}
