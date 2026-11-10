/**
 * Shared Intl formatters. Building an `Intl.NumberFormat`/`DateTimeFormat`/`Collator` costs far more than using one
 * (most of all on Hermes), and the same few locale + option sets are asked for in every list row and every render, so
 * each distinct set is built once and kept. The set of keys stays small: a handful of locales, timezones and options.
 */
const numbers = new Map<string, Intl.NumberFormat>();
const dates = new Map<string, Intl.DateTimeFormat>();
const collators = new Map<string, Intl.Collator>();

function cached<T>(store: Map<string, T>, locale: string, options: object | undefined, build: () => T): T {
  const key = locale + "|" + (options ? JSON.stringify(options) : "");
  let value = store.get(key);
  if (!value) {
    value = build();
    store.set(key, value);
  }
  return value;
}

export function numberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  return cached(numbers, locale, options, () => new Intl.NumberFormat(locale, options));
}

export function dateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached(dates, locale, options, () => new Intl.DateTimeFormat(locale, options));
}

export function collator(locale: string, options?: Intl.CollatorOptions): Intl.Collator {
  return cached(collators, locale, options, () => new Intl.Collator(locale, options));
}

const zoneLabels: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };
/** The name people use for an Indonesian timezone ("WIB"); other zones keep their IANA name. */
export function zoneLabel(timezone: string): string {
  return zoneLabels[timezone] ?? timezone;
}
