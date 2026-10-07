/** Screens the app may return to after signing in (`next`); anything else returns to Beranda. */
const RETURNABLE =
  /^\/(?:discover|jelajah|jadwal|akun|bantuan|alamat|pembayaran|notifications|disimpan|(?:checkout|payment|package|hari|masalah|claim|renew|bayar|paket|beli|pilih-menu)\/[^/]+|subscriptions\/[^/]+(?:\/menu)?)?$/;

export function nativeReturnPath(value?: string): string {
  if (!value || /[\\\u0000- ]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://catera.invalid");
    if (!value.startsWith("/") || url.origin !== "https://catera.invalid") return "/";
    // Old screens that moved: support is Bantuan dan laporan, account is Akun, and so on.
    const moved: Record<string, string> = {
      "/support": "/bantuan",
      "/account": "/akun",
      "/addresses": "/alamat",
      "/saved": "/disimpan",
    };
    if (moved[url.pathname]) return moved[url.pathname] + url.search;
    if (!RETURNABLE.test(url.pathname)) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
