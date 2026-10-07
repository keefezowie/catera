/** Maps server notification hrefs (written for the web) to customer app routes. */
export function customerLink(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000- ]/.test(href)) return "/";
  const path = new URL(href, "https://catera.invalid").pathname.replace(/\/+$/, "") || "/";
  // Older notifications link to the web calendar, which is Jadwal in the app.
  if (path === "/calendar") return "/jadwal";
  // Reports and support cases both live in Bantuan dan laporan.
  if (path === "/support") return "/bantuan";
  const [, section, id, ...rest] = path.split("/");
  if (!id || rest.length) return "/";
  const safe = encodeURIComponent(decodeSegment(id));
  switch (section) {
    case "deliveries":
      return `/hari/${safe}`;
    case "subscriptions":
      return "/jadwal";
    case "claim":
      return `/claim/${safe}`;
    case "renew":
      return `/renew/${safe}`;
    default:
      // "/today", "/home" and anything the app has no screen for open Beranda.
      return "/";
  }
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
