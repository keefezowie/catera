import { createContext, use, type ReactNode } from "react";
import { nativeLayout } from "@catera/design-tokens";

/** `classic` is the pre-scale geometry (Dapur screens mounted without its root); `v2` is the layout scale (`nativeLayout`). */
export type LayoutScaleName = "classic" | "v2";

/** The side margin a screen had before the scale existed. */
const CLASSIC_MARGIN = 20;

/** The touch target the smaller v2 controls reach when the root names none: the customer app's 44. */
const DEFAULT_TARGET = 44;

// Without a provider the shared components keep the classic geometry, so an app opts in by mounting one.
const LayoutScaleContext = createContext<LayoutScaleName>("classic");
const TouchTargetContext = createContext<number>(DEFAULT_TARGET);

/**
 * One per app root. Components below it read `useLayoutScale()` and take `nativeLayout` sizes under `v2`. `target` is
 * the touch target, in dp, that the smaller v2 controls reach through `hitSlop`: 44 by default, 48 in Catera Dapur.
 */
export function LayoutScaleProvider({
  value,
  target = DEFAULT_TARGET,
  children,
}: {
  value: LayoutScaleName;
  target?: number;
  children: ReactNode;
}) {
  return (
    <LayoutScaleContext.Provider value={value}>
      <TouchTargetContext.Provider value={target}>{children}</TouchTargetContext.Provider>
    </LayoutScaleContext.Provider>
  );
}

export function useLayoutScale(): LayoutScaleName {
  return use(LayoutScaleContext);
}

/** The touch target the root asked for: 44 unless it passed `target`. */
export function useTouchTarget(): number {
  return use(TouchTargetContext);
}

/** The screen's side margin: 16 under `v2`, 20 otherwise. */
export function useScreenMargin(): number {
  return useLayoutScale() === "v2" ? nativeLayout.margin : CLASSIC_MARGIN;
}
