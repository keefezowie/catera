/** Photos from the API are site-relative ("/uploads/…"); picked or CDN photos are already absolute. */
export function photoUri(src: string, apiBase: string): string {
  return src.startsWith("/") && !src.startsWith("//") ? apiBase + src : src;
}
