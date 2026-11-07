import * as core from "@catera/mobile-core";
import { redirectSystemPath as toRoute } from "../src/nav";

/**
 * Rewrites OS links to a bare tab root so each opens in its own tab (see `redirectSystemPath` in src/nav.ts). While a
 * Google sign-in is open, its own redirect to auth/callback (Android delivers it as a deep link too) opens nothing:
 * `signInWithGoogle` exchanges that code itself.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // Optional call: suites that mock @catera/mobile-core without it still route.
  if (core.oauthRedirectPending?.() && /auth\/callback/.test(path)) return null;
  return toRoute({ path, initial });
}
