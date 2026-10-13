import { use, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { router } from "expo-router";
import {
  NavigationContext,
  NavigationRouteContext,
  PreventRemoveContext,
} from "expo-router/react-navigation";

/**
 * The confirm and action sheets are routes (`/konfirmasi`, `/aksi`) declared in each app's root stack with
 * `sheetOptions({ detents: "fit" })`, and so are the customer app's choice sheets. A route cannot take a callback as a
 * param, so the caller's question waits in a registry (`parkQuestion`), under an id the route reads from `?id=`, until
 * the sheet answers it or closes (`useQuestionRoute`). Each question is answered exactly once: the first of the sheet's
 * own buttons, a swipe down, the hardware back or Close wins, and the entry is dropped. The answer is given once the
 * sheet has gone, never while it is still sliding away, so whatever the asker opens next is presented over a settled
 * screen.
 */

/**
 * When a sheet puts the screen reader on its title (`useSheetTitleFocus`). Fixed numbers, never the motion tokens, so a
 * change of pace cannot move the focus (spec 4.1).
 * - `SHEET_FOCUS_FALLBACK_MS`: after mount, for a sheet whose present never reports (outside a navigator).
 * - `SHEET_FOCUS_SETTLE_MS`: after the present, the focus is sent once more. TalkBack re-asserts its focus on the window
 *   under the sheet when react-native-screens hides the page beneath it, and that can land after the present.
 */
export const SHEET_FOCUS_FALLBACK_MS = 400;
export const SHEET_FOCUS_SETTLE_MS = 250;

/** How many sheets are mounted now. Any sheet counts: a confirm over Ada masalah keeps the page hidden. */
let sheetsUp = 0;
const sheetWatchers = new Set<() => void>();

function countSheet(change: 1 | -1) {
  sheetsUp += change;
  sheetWatchers.forEach((watch) => watch());
}

function watchSheets(watch: () => void) {
  sheetWatchers.add(watch);
  return () => void sheetWatchers.delete(watch);
}

/** Counts this sheet as up while it is mounted. Every sheet's title row calls it (`useSheetTitleFocus`). */
export function useSheetPresence(): void {
  useEffect(() => {
    countSheet(1);
    return () => countSheet(-1);
  }, []);
}

/**
 * True while a sheet route is on top. The chrome outside the sheet's stack (the demo strip, the tab bar) leaves the
 * accessibility tree then, so TalkBack cannot fall back onto it when the page under the sheet is hidden; it comes back
 * when the last sheet unmounts. react-native-screens already hides the screens under the sheet in its own stack.
 */
export function useSheetOnTop(): boolean {
  return useSyncExternalStore(watchSheets, () => sheetsUp > 0, () => false);
}

/** A view's accessibility props while a sheet covers it: out of the tree on Android and iOS, or as normal. */
export function coveredBySheet(covered: boolean) {
  return {
    importantForAccessibility: covered ? ("no-hide-descendants" as const) : ("auto" as const),
    accessibilityElementsHidden: covered,
  };
}

/** The icon in the confirm sheet's circle: the rantang for a kitchen step, the bin for a deletion, the flag for a report. */
export type ConfirmIcon = "rantang" | "trash" | "flag";

export type ConfirmInput = {
  title: string;
  /** The consequence, in one or two short sentences. */
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** "danger" fills the confirm button in the danger ink: the action deletes or discards something. */
  tone?: "danger";
  icon?: ConfirmIcon;
};

export type ActionItem = {
  key: string;
  label: string;
  /** An Ionicons glyph name ("calendar-outline"). */
  icon: string;
  /** A destructive item: drawn in the danger ink, below a divider, after every other item. */
  tone?: "danger";
  /** Shown but not choosable (the cutoff has passed). Prefer leaving an item out when it never applies. */
  disabled?: boolean;
};

export type ActionSheetInput = {
  title: string;
  /** The item the actions are about: an optional photo, its name and up to a few short lines. */
  context?: { image?: string; title: string; lines: string[] };
  items: ActionItem[];
  /** The spoken name of the iOS Close, translated by the caller (`t("Tutup", "Close")`); "Tutup" when left out. */
  closeLabel?: string;
};

export const CONFIRM_ROUTE = "/konfirmasi";
export const ACTION_ROUTE = "/aksi";

type Waiting<I, R> = { input: I; answer: (result: R) => void };

/** The questions of one kind of sheet route waiting for their answers, by id. Keep one at module level per route. */
export type QuestionRegistry<I, R> = Map<string, Waiting<I, R>>;

const confirms: QuestionRegistry<ConfirmInput, boolean> = new Map();
const actions: QuestionRegistry<ActionSheetInput, string | null> = new Map();
let nextId = 0;

/**
 * Parks a question in `registry`, opens the sheet route at `pathname` with its id, and resolves once with the sheet's
 * answer (or `fallback` if the route cannot open). The route reads it with `useQuestionRoute`.
 */
export function parkQuestion<I, R>(registry: QuestionRegistry<I, R>, pathname: string, input: I, fallback: NoInfer<R>): Promise<R> {
  nextId += 1;
  const id = `${nextId}`;
  return new Promise<R>((resolve) => {
    registry.set(id, {
      input,
      answer: (result) => {
        registry.delete(id);
        resolve(result);
      },
    });
    try {
      router.push({ pathname, params: { id } } as never);
    } catch {
      registry.get(id)?.answer(fallback);
    }
  });
}

/** Answers a waiting question once; later answers for the same id are ignored. */
function answerQuestion<I, R>(registry: QuestionRegistry<I, R>, id: string | undefined, result: R) {
  if (id) registry.get(id)?.answer(result);
}

/**
 * Closes a question route that has nothing to show. Opened from the app it goes back to the screen under it; a cold OS
 * link to `/konfirmasi` or `/aksi` has nothing under it, so Beranda replaces it instead of an empty stack.
 */
export function leaveStray(navigation: { canGoBack(): boolean; goBack(): void }) {
  if (navigation.canGoBack()) navigation.goBack();
  else router.replace("/" as never);
}

/**
 * How long an iOS sheet takes to slide away once its route has gone (UIKit's sheet dismissal). react-native-screens
 * drops the close event of a screen that has already left the React tree, so an answer waits this long after the route
 * goes instead. Unverified on a device (no Mac); see the iOS device list in the Phase G kickoff.
 */
export const SHEET_CLOSE_MS = 400;

/**
 * The route side of `parkQuestion`: the question waiting under `?id=` (read once, as the entry is dropped when
 * answered), and `close(result)`, which closes the sheet once and answers `result` when it has gone. Without a `close`
 * (Close, the hardware back, a swipe down, an unmount) the answer is `fallback`. A route with nothing waiting (restored
 * after a reload, or a stray link) closes itself, to Beranda when nothing is under it (a cold OS link).
 *
 * When the answer is given matters on iOS: the sheet is a UIKit presentation that keeps sliding away after its route
 * has left the stack, and UIKit refuses to present another sheet (Pindah tanggal opened from the day's "…") while one
 * is still leaving. So the answer waits for the route's own close transition (`beforeRemove` then `transitionEnd`),
 * which arrives when UIKit reports a swipe; when the route has gone first (the sheet's own buttons close it from JS),
 * it waits `SHEET_CLOSE_MS` after the route goes. Android's bottom sheet lives in the app's window, so there the answer
 * comes as the route goes. `leave` replaces the default `goBack` (a choice that opens its own next screen in the
 * sheet's place). `os` defaults to the running platform.
 */
export function useQuestionRoute<I, R>(
  registry: QuestionRegistry<I, R>,
  fallback: NoInfer<R>,
  os: string | undefined = process.env.EXPO_OS,
): { input: I | undefined; close: (result: R, leave?: () => void) => void } {
  const navigation = use(NavigationContext);
  const route = use(NavigationRouteContext);
  const id = (route?.params as { id?: string } | undefined)?.id;
  // Read once: the entry is dropped when answered, while the sheet still shows as it slides away.
  const [input] = useState(() => (id ? registry.get(id)?.input : undefined));
  const stray = !input;
  const result = useRef(fallback);
  const closing = useRef(false);
  const removing = useRef(false);

  useEffect(() => {
    if (!navigation) return;
    if (stray) {
      leaveStray(navigation);
      return;
    }
    const onRemove = navigation.addListener("beforeRemove", () => {
      removing.current = true;
    });
    // The route's own close has ended (UIKit's swipe, reported while the route is still mounted): answer now.
    const onClosed = navigation.addListener("transitionEnd" as never, (e: { data?: { closing?: boolean } }) => {
      if (e.data?.closing && (removing.current || closing.current)) answerQuestion(registry, id, result.current);
    });
    return () => {
      onRemove();
      onClosed();
    };
  }, [navigation, registry, id, stray]);

  // The route has left the tree (its own close from JS, a back, or its navigator unmounting): answer what is left,
  // once the iOS sheet has slid away. A no-op once answered.
  useEffect(
    () => () => {
      if (!id || !registry.has(id)) return;
      const value = result.current;
      if (os === "ios") setTimeout(() => answerQuestion(registry, id, value), SHEET_CLOSE_MS);
      else answerQuestion(registry, id, value);
    },
    [registry, id, os],
  );

  // One answer and one close, however many taps land while the sheet slides away.
  const close = useCallback(
    (value: R, leave?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      result.current = value;
      if (leave) leave();
      else navigation?.goBack();
    },
    [navigation],
  );
  return { input, close };
}

/** The `/konfirmasi` route's side of `useConfirm`. */
export function useConfirmRoute(os?: string) {
  return useQuestionRoute(confirms, false, os);
}
/** The `/aksi` route's side of `useActionSheet`. */
export function useActionRoute(os?: string) {
  return useQuestionRoute(actions, null, os);
}

/**
 * Asks before an irreversible or customer-visible action, in the native confirm sheet (`/konfirmasi`). Resolves true on
 * the confirm button; false on cancel, Close, a swipe down or the hardware back. It resolves once the sheet has gone.
 */
export function useConfirm(): (input: ConfirmInput) => Promise<boolean> {
  return useCallback((input: ConfirmInput) => parkQuestion(confirms, CONFIRM_ROUTE, input, false), []);
}

/**
 * Offers several secondary actions on one item in the native action sheet (`/aksi`), destructive items last. Resolves
 * the chosen item's key, or null when the sheet closes without a choice, once the sheet has gone: the asker may open
 * the next sheet straight away.
 */
export function useActionSheet(): (input: ActionSheetInput) => Promise<string | null> {
  return useCallback((input: ActionSheetInput) => parkQuestion(actions, ACTION_ROUTE, input, null), []);
}

type Translate = (id: string, en: string) => string;

export type UnsavedGuardOptions = {
  /** The app's form of address: the customer app says "Anda", Catera Dapur says "kamu". */
  voice?: "anda" | "kamu";
  /** The app's `t(id, en)`; without it the copy is Indonesian. */
  t?: Translate;
  /** The noun in English ("report"), for `t`. */
  nounEn?: string;
  /** Called after the person chose to discard, so the screen can drop a kept draft. */
  onDiscard?: () => void;
  /** The running platform, for tests. */
  os?: string;
};

/** What the discard question says. Exported so the copy has one home. */
export function unsavedCopy(noun: string, { voice = "anda", t = (id) => id, nounEn = noun }: UnsavedGuardOptions = {}): ConfirmInput {
  const who = voice === "kamu" ? "kamu" : "Anda";
  return {
    title: t(`Buang ${noun}?`, `Discard ${nounEn}?`),
    message: t(`Yang sudah ${who} tulis akan hilang.`, "What you wrote will be lost."),
    confirmLabel: t("Buang", "Discard"),
    cancelLabel: t("Lanjut menulis", "Keep writing"),
    tone: "danger",
    icon: "trash",
  };
}

/**
 * Whether a screen's removal can still be held. The native stack turns a sheet's own close into a POP that names the
 * sheet as its source: on iOS that is a swipe the stack already held (`preventNativeDismiss`), so the sheet is still
 * up; on Android it is a swipe the bottom sheet has already finished, so the sheet is gone and holding the route would
 * leave it on no screen. Every other removal (Close, the hardware back, a link) can be held. `os` defaults to the
 * running platform.
 */
export function canHoldRemoval(
  action: { type: string; source?: string },
  routeKey: string,
  os: string | undefined = process.env.EXPO_OS,
): boolean {
  return os === "ios" || !(action.type === "POP" && action.source === routeKey);
}

/**
 * Keeps typed input from being lost when its sheet closes. While `dirty` (the person typed something), leaving the
 * screen asks first through the confirm sheet ("Buang {noun}?"): Close, the hardware back and, on iOS, a swipe down,
 * which the native stack holds while `dirty` (`preventNativeDismiss`). Nothing typed: the screen closes at once.
 * Android's bottom sheet cannot be held: a swipe has already closed it natively when the stack hears of it, and holding
 * the route then would leave it on no screen, so that close goes through. A screen that must not lose text keeps a
 * draft for that case (Ada masalah does). Outside a navigator (component tests) it does nothing.
 */
export function useUnsavedGuard(dirty: boolean, noun: string, options: UnsavedGuardOptions = {}): void {
  const navigation = use(NavigationContext);
  const route = use(NavigationRouteContext);
  const prevent = use(PreventRemoveContext);
  const confirm = useConfirm();
  const id = useId();
  const latest = useRef({ dirty, noun, options });
  latest.current = { dirty, noun, options };
  const asking = useRef(false);
  const leaving = useRef(false);
  const routeKey = route?.key;
  const setPreventRemove = prevent?.setPreventRemove;

  // Tells the native stack to hold the iOS swipe while there is text to lose.
  useEffect(() => {
    if (!setPreventRemove || !routeKey) return;
    setPreventRemove(id, routeKey, dirty);
    return () => setPreventRemove(id, routeKey, false);
  }, [setPreventRemove, id, routeKey, dirty]);

  useEffect(() => {
    if (!navigation || !routeKey) return;
    return navigation.addListener("beforeRemove", (e) => {
      const { dirty: unsaved, noun: what, options: opts } = latest.current;
      if (!unsaved || leaving.current) return;
      if (!canHoldRemoval(e.data.action, routeKey, opts.os)) return;
      // One question at a time, and never a trap: a removal that lands while the question is still open goes through
      // instead of waiting behind an answer that may never come.
      if (asking.current) return;
      e.preventDefault();
      asking.current = true;
      void confirm(unsavedCopy(what, opts)).then((discard) => {
        asking.current = false;
        if (!discard) return;
        opts.onDiscard?.();
        // The screen may already be gone (removed while the question was open): then there is nothing left to close.
        if (!navigation.getState()?.routes.some((r) => r.key === routeKey)) return;
        leaving.current = true;
        try {
          navigation.dispatch(e.data.action);
        } finally {
          // Removed, or held by something else: either way the next close asks again.
          leaving.current = false;
        }
      });
    });
  }, [navigation, routeKey, confirm]);
}
