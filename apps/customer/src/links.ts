import { nativeReturnPath } from "./auth";

/** Old web hrefs that point at the package list. */
const DISCOVER = new Set(["/#packages", "/#how-it-works", "/?view=list#how-it-works"]);

/** The one mapper from server and old hrefs (notifications, pushes, action feed, old links)
 * to customer app routes. Anything it cannot place opens Beranda. */
export function customerLink(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000- ]/.test(href)) return "/";
  if (DISCOVER.has(href)) return "/jelajah";
  let url: URL;
  try {
    url = new URL(href, "https://catera.invalid");
  } catch {
    return "/";
  }
  if (url.origin !== "https://catera.invalid") return "/";
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const query = url.search;
  const [, section = "", id, ...rest] = path.split("/");

  if (!id)
    switch (section) {
      // Older notifications link to the web calendar, which is Jadwal in the app.
      case "calendar":
        return "/jadwal";
      // Reports and support cases both live in Bantuan dan laporan (?checkoutId= opens payment help).
      case "support":
        return "/bantuan" + query;
      case "discover":
        return "/jelajah";
      case "saved":
        return "/disimpan";
      case "addresses":
        return "/alamat";
      case "account":
        return "/akun";
      case "jadwal":
      case "jelajah":
      case "akun":
      case "bantuan":
      case "disimpan":
      case "alamat":
      case "pembayaran":
      case "notifications":
        return "/" + section;
      default:
        // "/", "/today", "/home" and anything the app has no screen for open Beranda.
        return "/";
    }

  const safe = encodeURIComponent(decodeSegment(id));
  if (section === "subscriptions" && rest.length === 1 && rest[0] === "menu") return `/pilih-menu/${safe}${query}`;
  if (rest.length) return "/";
  switch (section) {
    case "deliveries":
    case "hari":
      return `/hari/${safe}`;
    case "subscriptions":
      return `/subscriptions/${safe}`;
    case "payment":
    case "bayar":
      return `/bayar/${safe}`;
    case "packages":
    case "package":
    case "paket":
      return `/paket/${safe}`;
    // The checkout stub keeps sending renewals to Perpanjang and purchases to Beli.
    case "checkout":
    case "beli":
    case "masalah":
    case "pilih-menu":
      return nativeReturnPath(`/${section}/${safe}${query}`);
    case "claim":
      return `/claim/${safe}`;
    case "renew":
      return `/renew/${safe}`;
    default:
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
