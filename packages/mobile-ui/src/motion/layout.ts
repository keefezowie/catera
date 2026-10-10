import { useMemo, type ComponentProps } from "react";
import Animated, { Easing, FadeInDown, FadeOut, LinearTransition, type EntryOrExitLayoutType } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useReduced } from "./useReduced";

/** The `layout` prop an `Animated.View` accepts (a transition such as `LinearTransition`). */
export type RowLayoutTransition = ComponentProps<typeof Animated.View>["layout"];

export type RowMotion = {
  entering?: EntryOrExitLayoutType;
  exiting?: EntryOrExitLayoutType;
  layout?: RowLayoutTransition;
};

/** How far an inserted row rises while it fades in, in dp. */
const ROW_RISE = 8;

const ease = Easing.bezier(...nativeMotion.ease);

/**
 * Layout animations for a row the user's own action inserts or removes (an address saved, a saved package removed,
 * an import row accepted): `entering` fades in and rises 8dp over `content` (220ms) on the Catera ease, `exiting`
 * fades out over `control` (120ms), and `layout` moves the rows that remain with `LinearTransition` over `content`.
 * Spread them on the row's `Animated.View`. Never use them on a first load, a refresh, a search or filter change, a
 * tab return or a mood switch (Decision A): those swap the whole data area through `FadeSwap`.
 * Under reduced motion every field is `undefined`, so rows appear and leave at once.
 */
export function useRowMotion(): RowMotion {
  const reduced = useReduced();
  return useMemo<RowMotion>(
    () =>
      reduced
        ? { entering: undefined, exiting: undefined, layout: undefined }
        : {
            entering: FadeInDown.duration(nativeMotion.content)
              .easing(ease)
              .withInitialValues({ opacity: 0, transform: [{ translateY: ROW_RISE }] }),
            exiting: FadeOut.duration(nativeMotion.control).easing(ease),
            layout: LinearTransition.duration(nativeMotion.content).easing(ease),
          },
    [reduced],
  );
}
