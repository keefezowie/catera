import { useEffect, useRef, type ReactNode } from "react";
import { MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "./links";
// Old screens (Jadwal, Jelajah, Akun, purchase and payment) still read the old provider
// until Tasks 8–13 replace them; it no longer routes pushes or subscribes to realtime.
import { NativeProvider, useNative } from "./context";
import { NativeSavedProvider } from "./saved";

/** Keeps the old provider's session in step with MobileProvider while both are mounted. */
function LegacySessionBridge({ children }: { children: ReactNode }) {
  const mobile = useMobile();
  const legacy = useNative();
  const mobileId = mobile.ready ? (mobile.actor?.id ?? "") : null;
  const legacyId = legacy.ready ? (legacy.actor?.id ?? "") : null;
  const seenMobile = useRef<string | null>(null);
  const seenLegacy = useRef<string | null>(null);
  // Each effect fires only when one side's signed-in identity changes (sign-in, logout),
  // then asks the other side to re-read the shared SecureStore session.
  useEffect(() => {
    if (mobileId === null) return;
    const previous = seenMobile.current;
    seenMobile.current = mobileId;
    if (previous !== null && previous !== mobileId && legacyId !== mobileId) void legacy.refresh();
  }, [mobileId]);
  useEffect(() => {
    if (legacyId === null) return;
    const previous = seenLegacy.current;
    seenLegacy.current = legacyId;
    if (previous !== null && previous !== legacyId && mobileId !== legacyId) void mobile.refresh();
  }, [legacyId]);
  return <>{children}</>;
}

/** The old provider in the shell: no push routing and no realtime channel of its own
 * (MobileProvider owns both); the shell's revision reloads the old screens instead. */
function LegacyProvider({ children }: { children: ReactNode }) {
  const { revision } = useMobile();
  return (
    <NativeProvider routeNotifications={false} realtime={false} externalRevision={revision}>
      {children}
    </NativeProvider>
  );
}

/** The customer app's providers: the shared MobileProvider owns the session, pushes and
 * realtime; the old provider stays mounted for the screens Tasks 8–13 have not replaced. */
export function AppProviders({ runtime, children }: { runtime: MobileRuntime; children: ReactNode }) {
  return (
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <LegacyProvider>
        <NativeSavedProvider>
          <LegacySessionBridge>{children}</LegacySessionBridge>
        </NativeSavedProvider>
      </LegacyProvider>
    </MobileProvider>
  );
}
