import type { ReactElement, ReactNode } from "react";
import { LayoutScaleProvider } from "@catera/mobile-ui";

/** Mounts a component under the scale the Dapur root provides: `v2` with a 48 touch target. */
export function withDapurScale(ui: ReactNode): ReactElement {
  return (
    <LayoutScaleProvider value="v2" target={48}>
      {ui}
    </LayoutScaleProvider>
  );
}
