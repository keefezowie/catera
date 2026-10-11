import { useCallback, useEffect, useMemo, useRef, type ComponentProps } from "react";
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

/**
 * `useRowMotion` for a keyed list, so only rows the user's own action inserts get an entrance (Decision A).
 *
 * `keys` is every key the data holds, not only the rows a filter or search shows, or null while nothing has loaded.
 * A key that was not in the previous drawn set enters; the keys of the first set drawn (the first load) never do, and
 * neither does a row a filter or search brings back, because its key was already held. Rows that leave always exit
 * and the rest move. `quiet` takes the keys of a read the user did not cause by changing the list (a pull to refresh)
 * without an entrance. A list that goes back to null starts over: its next set is a first load again.
 */
export function useListMotion(keys: readonly string[] | null | undefined, quiet = false): (key: string) => RowMotion {
  const motion = useRowMotion();
  const drawn = useRef<Set<string> | null>(null);
  // Keys that came in as insertions keep their entrance for as long as it runs (`content`), so re-renders during it
  // never flip the row's prop; after that a row a filter brings back mounts with no entrance.
  const inserted = useRef(new Set<string>());
  const current = keys ? new Set(keys) : null;
  const before = drawn.current;
  const fresh: string[] = [];
  if (before && !quiet && current)
    for (const key of current) if (!before.has(key) && !inserted.current.has(key)) fresh.push(key);
  for (const key of fresh) inserted.current.add(key);
  // After each commit the drawn set is the one just shown.
  useEffect(() => {
    drawn.current = current;
  });
  // Each set of insertions forgets its entrance once it has run; only unmounting cancels the timers.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (!fresh.length) return;
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      for (const key of fresh) inserted.current.delete(key);
    }, nativeMotion.content);
    timers.current.add(timer);
  });
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  return useCallback(
    (key: string) => ({
      entering: inserted.current.has(key) ? motion.entering : undefined,
      exiting: motion.exiting,
      layout: motion.layout,
    }),
    // `before` changes with every commit, so the callback reads the inserted set of this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [before, quiet, motion],
  );
}
