import { shortDate, type Locale } from "@catera/domain";

/**
 * Links to detail screens that carry the name the caller already shows, as `title`, so the native header is final on
 * the first frame instead of showing a placeholder ("Paket", "Hari") until the screen has loaded.
 */
const titled = (path: string, title: string) => (title ? `${path}?title=${encodeURIComponent(title)}` : path);

/** /subscriptions/{id}: a plan, named after its package. */
export const planHref = (id: string, name: string) => titled(`/subscriptions/${encodeURIComponent(id)}`, name);

/** /hari/{id}: a delivery day, titled with its date ("Senin 12 Okt"). */
export const dayHref = (id: string, date: string, locale: Locale) =>
  titled(`/hari/${encodeURIComponent(id)}`, date ? shortDate(date, locale) : "");

/** /paket/{id}: a package, named after itself. */
export const packageHref = (id: string, name: string) => titled(`/paket/${encodeURIComponent(id)}`, name);
