import * as core from "@catera/mobile-core";
import { systemPath } from "../src/nav";

/** OS links (pushes opened by the system, exp:// and catera:// links): a tab root selects its tab; a cold Ada masalah
 * link opens its Hari first (`systemPath`). While a Google sign-in is open, its own redirect to auth/callback (Android
 * delivers it as a deep link too) opens nothing: `signInWithGoogle` exchanges that code itself. */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // Optional call: suites that mock @catera/mobile-core without it still route.
  if (core.oauthRedirectPending?.() && /auth\/callback/.test(path)) return null;
  return systemPath(path, initial);
}
