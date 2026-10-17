/** Photos from the API may be site-relative ("/food/…"). */
export function photoUri(src: string, apiBase: string): string {
  return src.startsWith("/") && !src.startsWith("//") ? apiBase + src : src;
}
