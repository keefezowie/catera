/** Maps server notification hrefs (written for the web seller area) to Catera Dapur routes. */
export function dapurLink(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000- ]/.test(href)) return "/";
  const url = new URL(href, "https://catera.invalid");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const date = url.searchParams.get("date");
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/?date=${date}` : "/";
  switch (path) {
    case "/seller":
    case "/seller/schedule":
    case "/seller/calendar":
      return day;
    case "/seller/customers":
      return "/pelanggan";
    case "/seller/menu":
      return "/menu";
    case "/seller/settings":
      return url.hash === "#payout" ? "/aktifkan" : "/usaha";
    default:
      // Support cases live on the web for now; Hari ini is where the caterer acts.
      return "/";
  }
}
