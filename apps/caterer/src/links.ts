/** Maps server notification hrefs to Catera Dapur routes (completed in Task 11). */
export function dapurLink(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000- ]/.test(href)) return "/";
  return "/";
}
