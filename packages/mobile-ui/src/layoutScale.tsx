import { createContext, use, type ReactNode } from "react";
import { nativeLayout } from "@catera/design-tokens";

/** `classic` is today's geometry (Catera Dapur); `v2` is the customer layout scale (`nativeLayout`). */
export type LayoutScaleName = "classic" | "v2";

/** The side margin a screen had before the scale existed. */
const CLASSIC_MARGIN = 20;

// Without a provider the shared components keep today's geometry, so an app opts in by mounting one.
const LayoutScaleContext = createContext<LayoutScaleName>("classic");

/** One per app root. Components below it read `useLayoutScale()` and take `nativeLayout` sizes under `v2`. */
export function LayoutScaleProvider({ value, children }: { value: LayoutScaleName; children: ReactNode }) {
  return <LayoutScaleContext.Provider value={value}>{children}</LayoutScaleContext.Provider>;
}

export function useLayoutScale(): LayoutScaleName {
  return use(LayoutScaleContext);
}

/** The screen's side margin: 16 under `v2`, 20 otherwise. */
export function useScreenMargin(): number {
  return useLayoutScale() === "v2" ? nativeLayout.margin : CLASSIC_MARGIN;
}
