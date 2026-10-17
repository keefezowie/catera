import type { ReactNode } from "react";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";

/** Mounts an isolated component under the app's providers with a signed-out session (for components that read `useMobile`). */
export function withMobile(ui: ReactNode) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "isolated", app: "dapur" });
  runtime.api = { ...runtime.api, me: async () => ({ actor: null, demo: false }) } as unknown as MobileRuntime["api"];
  return (
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      {ui}
    </MobileProvider>
  );
}
