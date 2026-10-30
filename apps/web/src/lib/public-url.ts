/** Canonical web origin for absolute URLs (metadata, robots, sitemap); Vercel's production host is the fallback. */
export function publicOrigin() {
  const configured = process.env.CATERA_PUBLIC_URL;
  if (configured) return new URL(configured).origin;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? "https://" + vercel : "http://localhost:3000";
}
