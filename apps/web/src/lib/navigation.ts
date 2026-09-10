import type { Actor } from "@catera/domain";

export const catalogHref = "/#packages";
export const howItWorksHref = "/#how-it-works";

/** Keep post-auth navigation inside this app, including encoded/backslash cases. */
export function safeReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/") || /[\\\u0000-\u0020]/.test(value))
    return null;
  try {
    const url = new URL(value, "https://catera.invalid");
    if (url.origin !== "https://catera.invalid" || url.pathname === "/login")
      return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function signedInPath(actor: Actor | null, requested?: string | null) {
  const safe = safeReturnPath(requested);
  if (safe) return safe;
  if (actor?.role === "platform_admin") return "/admin";
  if (actor?.role === "owner" || actor?.role === "staff") return "/seller";
  return "/home";
}
