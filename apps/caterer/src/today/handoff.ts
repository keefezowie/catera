import { router } from "expo-router";

/** The longest the hand-off waits for the stop's sheet to finish leaving before it opens the next sheet anyway. */
export const HANDOFF_WAIT_MS = 1000;

/** The hand-off waiting for the sheet to go: one at a time, a newer one replaces it. */
let waiting: { open: () => void; cancel: () => void } | null = null;

/**
 * Closes the sheet the person is on (a tab-stack sheet) and opens `href` in the root stack once that sheet has gone. The
 * two stacks are separate navigators, so pushing in the same tick can find the root stack still presenting over the
 * dismissing sheet (iOS swallows the push). The sheet reports it is gone by unmounting (`sheetGone`), which native-stack
 * does only after the dismissal has ended; a timer opens it regardless, so a sheet that never reports cannot strand it.
 */
export function pushAfterClose(href: string, wait = HANDOFF_WAIT_MS) {
  waiting?.cancel();
  let done = false;
  const timer = setTimeout(() => open(), wait);
  function open() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (waiting === handoff) waiting = null;
    router.push(href as never);
  }
  const handoff = {
    open,
    cancel: () => {
      done = true;
      clearTimeout(timer);
    },
  };
  waiting = handoff;
  router.back();
}

/** Called when the sheet unmounts: the hand-off waiting for it, if any, opens now. */
export function sheetGone() {
  waiting?.open();
}
