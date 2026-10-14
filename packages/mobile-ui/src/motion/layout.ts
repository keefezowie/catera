import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  type EntryOrExitLayoutType,
} from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useReduced } from "./useReduced";

/** The `layout` prop an `Animated.View` accepts (a transition such as `LinearTransition`). */
export type RowLayoutTransition = ComponentProps<typeof Animated.View>["layout"];

export type RowMotion = {
  entering?: EntryOrExitLayoutType;
  /**
   * The entrance of a row the user's own action brings back (an undo): it waits out the rows' move (`content`) and
   * then fades in over `control`, with no rise. The rows below make room first, so the returning card never shows
   * while the next one still slides across its place (G1a: a fast Urungkan overlapped the next card).
   */
  returning?: EntryOrExitLayoutType;
  exiting?: EntryOrExitLayoutType;
  layout?: RowLayoutTransition;
};

/** How far an inserted row rises while it fades in, in dp. */
const ROW_RISE = 8;

const ease = Easing.bezier(...nativeMotion.ease);

/**
 * Layout animations for a row the user's own action inserts or removes (an address saved, a saved package removed,
 * an import row deleted or put back): `entering` fades in and rises 8dp over `nativeMotion.content` on
 * `nativeMotion.ease`, `exiting` fades out over `nativeMotion.control`, and `layout` moves the rows that remain with
 * `LinearTransition` over `nativeMotion.content`.
 * Spread them on the row's `Animated.View`. Never use them on a first load, a refresh, a search or filter change, a
 * tab return or a mood switch (Decision A): those swap the whole data area through `FadeSwap`, or swap the rows
 * as one block through `RowSwap`.
 * Under reduced motion every field is `undefined`, so rows appear and leave at once.
 */
export function useRowMotion(): RowMotion {
  const reduced = useReduced();
  return useMemo<RowMotion>(
    () =>
      reduced
        ? { entering: undefined, returning: undefined, exiting: undefined, layout: undefined }
        : {
            entering: FadeInDown.duration(nativeMotion.content)
              .easing(ease)
              .withInitialValues({ opacity: 0, transform: [{ translateY: ROW_RISE }] }),
            returning: FadeIn.delay(nativeMotion.content).duration(nativeMotion.control).easing(ease),
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
 * and the rest move. A key that left and comes back (an undo) enters with `returning` instead. `quiet` takes the keys
 * of a read the user did not cause by changing the list (a refresh, a page loaded below) without an entrance. A list that goes back to null starts over: its next set is a first load again.
 *
 * Render only reads: this render's insertions are worked out here and recorded in an effect once the render commits,
 * so a render React throws away (a StrictMode double render, an interrupted transition) leaves nothing behind.
 */
export function useListMotion(keys: readonly string[] | null | undefined, quiet = false): (key: string) => RowMotion {
  const motion = useRowMotion();
  const drawn = useRef<Set<string> | null>(null);
  // Keys that came in as insertions keep their entrance for as long as it runs (`content`), so re-renders during it
  // never flip the row's prop; after that a row a filter brings back mounts with no entrance.
  const inserted = useRef(new Set<string>());
  // Keys a change took off the list; one that comes back is a row put back (an undo), which takes `returning`.
  const gone = useRef(new Set<string>());
  const returned = useRef(new Set<string>());
  const current = keys ? new Set(keys) : null;
  const before = drawn.current;
  const fresh = new Set<string>();
  if (before && !quiet && current)
    for (const key of current) if (!before.has(key) && !inserted.current.has(key)) fresh.add(key);
  // Each set of insertions forgets its entrance once it has run; only unmounting cancels the timers.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  // After each commit the drawn set is the one just shown, and this render's insertions are recorded.
  useEffect(() => {
    if (before && current && !quiet) {
      const left = [...before].filter((key) => !current.has(key));
      for (const key of left) gone.current.add(key);
      // A key only counts as put back for one content window after it left; then it is an ordinary insert again.
      if (left.length) {
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          for (const key of left) gone.current.delete(key);
        }, nativeMotion.content);
        timers.current.add(timer);
      }
    }
    drawn.current = current;
    // A quiet read (a refresh, a page below) is not the user's change: what left before it is forgotten.
    if (!current || quiet) gone.current.clear();
    if (!fresh.size) return;
    for (const key of fresh) {
      inserted.current.add(key);
      if (gone.current.delete(key)) returned.current.add(key);
    }
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      for (const key of fresh) {
        inserted.current.delete(key);
        returned.current.delete(key);
      }
    }, nativeMotion.content);
    timers.current.add(timer);
  });
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  const entering = inserted.current;
  // Read during render without writing: a fresh key that had gone is coming back now.
  const back = (key: string) => returned.current.has(key) || (fresh.has(key) && gone.current.has(key));
  return (key: string) => ({
    entering: fresh.has(key) || entering.has(key) ? (back(key) ? motion.returning : motion.entering) : undefined,
    exiting: motion.exiting,
    layout: motion.layout,
  });
}

/**
 * The entrance of a block of loaded content that arrives below what is already shown (the next page of a list): it
 * fades in as one block over `content` on the Catera ease, as `FadeSwap` brings in a first load, and its rows take no
 * entrance of their own. `undefined` under reduced motion, so the block appears at once.
 */
export function useBlockEnter(): EntryOrExitLayoutType | undefined {
  const reduced = useReduced();
  return useMemo(() => (reduced ? undefined : FadeIn.duration(nativeMotion.content).easing(ease)), [reduced]);
}
