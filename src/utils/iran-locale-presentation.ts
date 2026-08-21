/**
 * Presentation-only locale shim for the Persian build.
 *
 * Several legacy panels call Date#toLocale* without a locale/timezone. On a
 * Windows laptop configured for English this would still render Gregorian/local
 * time even when the dashboard language is Persian. We only intercept calls
 * that rely on the browser default locale; explicit UTC / machine-readable
 * formatters remain untouched, so API timestamps, filtering and calculations
 * are not changed.
 */
import { IRAN_TIME_ZONE, PERSIAN_CALENDAR_LOCALE } from './persian-datetime';

let installed = false;

function isPersianUi(): boolean {
  if (typeof document === 'undefined') return false;
  return (document.documentElement.getAttribute('lang') || '').toLowerCase().startsWith('fa');
}

function withIranOptions(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return {
    ...(options || {}),
    timeZone: IRAN_TIME_ZONE,
    calendar: 'persian',
    numberingSystem: 'arabext',
  };
}

export function installIranLocalePresentation(): void {
  if (installed) return;
  installed = true;

  const originalDate = Date.prototype.toLocaleDateString;
  const originalTime = Date.prototype.toLocaleTimeString;
  const originalDateTime = Date.prototype.toLocaleString;

  Date.prototype.toLocaleDateString = function patchedToLocaleDateString(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    if (isPersianUi() && (locales == null || locales === 'en-US')) {
      return originalDate.call(this, PERSIAN_CALENDAR_LOCALE, withIranOptions(options));
    }
    return originalDate.call(this, locales, options);
  };

  Date.prototype.toLocaleTimeString = function patchedToLocaleTimeString(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    if (isPersianUi() && (locales == null || locales === 'en-US')) {
      return originalTime.call(this, PERSIAN_CALENDAR_LOCALE, withIranOptions(options));
    }
    return originalTime.call(this, locales, options);
  };

  Date.prototype.toLocaleString = function patchedToLocaleString(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    if (isPersianUi() && (locales == null || locales === 'en-US')) {
      return originalDateTime.call(this, PERSIAN_CALENDAR_LOCALE, withIranOptions(options));
    }
    return originalDateTime.call(this, locales, options);
  };
}
