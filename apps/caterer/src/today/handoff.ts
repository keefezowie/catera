import { useEffect } from "react";
import { router, useNavigation } from "expo-router";

/** The longest the hand-off waits for the stop's sheet to finish leaving before it opens the next sheet anyway. */
export const HANDOFF_WAIT_MS = 1000;

/** What the hand-off listens on for the sheet's own "gone" event: the sheet screen's navigation (native-stack). */
export type SheetEvents = {
  addListener: (
    type: "transitionEnd",
    listener: (e: { target?: string; data?: { closing?: boolean } }) => void,
  ) => () => void;
};

/** The hand-off waiting for the sheet to go: one at a time, a newer one replaces it. */
let waiting: { open: () => void; cancel: () => void } | null = null;

/**
 * Closes the sheet the person is on (a tab-stack form sheet) and opens `href` in the root stack once that sheet has
 * finished leaving. The two stacks are separate navigators: pushing while the tab stack still animates its sheet away
 * can find iOS mid-dismissal and swallow the root presentation.
 *
 * The sheet unmounting is NOT the signal. Native-stack renders only the routes in its state, so `router.back()`
 * unmounts the sheet in the next commit while the native dismissal is still running. What does mark the end:
 * - the tab stack's own `onFinishTransitioning` (`stackSettled`, wired by `useHandoffStack`). iOS emits it from the
 *   completion of `dismissViewControllerAnimated` (react-native-screens `RNSScreenStack.mm`, `afterTransitions`);
 *   Android from `ScreenStack.endViewTransition` once the sheet's exit animator ends. The stack stays mounted, so its
 *   event has a live receiver.
 * - native-stack's `transitionEnd` with `closing: true` for the sheet's route key (emitted from the screen's
 *   `onDisappear`), when `sheet` is given. It comes from a screen whose React subtree is already gone, so it is a
 *   second chance, not the one the hand-off relies on.
 * Whichever comes first opens `href`, once. A timer opens it regardless, so a missing event cannot strand the person.
 */
export function pushAfterClose(href: string, options: { sheet?: { events: SheetEvents; key: string }; wait?: number } = {}) {
  const { sheet, wait = HANDOFF_WAIT_MS } = options;
  waiting?.cancel();
  let done = false;
  const stop = sheet?.events.addListener("transitionEnd", (e) => {
    if (e.target === sheet.key && e.data?.closing === true) open();
  });
  const timer = setTimeout(() => open(), wait);
  function finish() {
    done = true;
    clearTimeout(timer);
    stop?.();
    if (waiting === handoff) waiting = null;
  }
  function open() {
    if (done) return;
    finish();
    router.push(href as never);
  }
  const handoff = {
    open,
    cancel: () => {
      if (!done) finish();
    },
  };
  waiting = handoff;
  router.back();
}

/** The tab stack finished a transition: the hand-off waiting for its sheet to leave, if any, opens now. */
export function stackSettled() {
  waiting?.open();
}

/** Drops the hand-off still waiting, if any: the person left the tab or signed out, so nothing opens later. */
export function cancelHandoff() {
  waiting?.cancel();
}

const HOST_PROPS = { onFinishTransitioning: stackSettled };

/**
 * For each tab's stack: reports its finished transitions to the hand-off, and cancels a waiting hand-off when the tab
 * loses focus (another tab, or a screen above the tabs), the session changes (`session` names the signed-in actor,
 * nothing when signed out) or the stack goes. Returns the stack's `unstable_nativeProps`.
 */
export function useHandoffStack(session: string | undefined) {
  const navigation = useNavigation();
  useEffect(() => navigation?.addListener?.("blur", cancelHandoff), [navigation]);
  // The cleanup runs when the session changes (sign-out, another account, a role change) and when the stack unmounts.
  useEffect(() => cancelHandoff, [session]);
  return HOST_PROPS;
}
