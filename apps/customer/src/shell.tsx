import type { ReactNode } from "react";
import { MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "./links";

/** The customer app's one provider: MobileProvider owns the session, commands, realtime,
 * push registration and push-tap routing (through customerLink). */
export function AppProviders({ runtime, children }: { runtime: MobileRuntime; children: ReactNode }) {
  return (
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {children}
    </MobileProvider>
  );
}
