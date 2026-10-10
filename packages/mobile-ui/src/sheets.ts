import { use, useCallback, useEffect, useId, useRef } from "react";
import { router } from "expo-router";
import {
  NavigationContext,
  NavigationRouteContext,
  PreventRemoveContext,
} from "expo-router/react-navigation";

/**
 * The confirm and action sheets are routes (`/konfirmasi`, `/aksi`) declared in each app's root stack with
 * `sheetOptions({ detents: "fit" })`. A route cannot take a callback as a param, so the caller's question waits here,
 * under an id the route reads from `?id=`, until the sheet answers it or closes. Each question is answered exactly once:
 * the first of the sheet's own buttons, a swipe down, the hardware back or Close wins, and the entry is dropped.
 */

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

const confirms = new Map<string, Waiting<ConfirmInput, boolean>>();
const actions = new Map<string, Waiting<ActionSheetInput, string | null>>();
let nextId = 0;

/** Parks the question, opens its route, and resolves once with the sheet's answer (or `fallback` if it cannot open). */
function ask<I, R>(registry: Map<string, Waiting<I, R>>, pathname: string, input: I, fallback: R): Promise<R> {
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

/**
 * Closes a confirm or action route that has nothing to show. Opened from the app it goes back to the screen under it; a
 * cold OS link to `/konfirmasi` or `/aksi` has nothing under it, so Beranda replaces it instead of an empty stack.
 */
export function leaveStray(navigation: { canGoBack(): boolean; goBack(): void }) {
  if (navigation.canGoBack()) navigation.goBack();
  else router.replace("/" as never);
}

/** The question a sheet route shows, or undefined when nothing waits under that id (a restored or stray route). */
export function confirmWaiting(id: string | undefined): ConfirmInput | undefined {
  return id ? confirms.get(id)?.input : undefined;
}
export function actionWaiting(id: string | undefined): ActionSheetInput | undefined {
  return id ? actions.get(id)?.input : undefined;
}

/** Answers a waiting confirm once; later answers for the same id are ignored. */
export function answerConfirm(id: string | undefined, result: boolean) {
  if (id) confirms.get(id)?.answer(result);
}
/** Answers a waiting action sheet once with the chosen key, or null when it closed without a choice. */
export function answerAction(id: string | undefined, result: string | null) {
  if (id) actions.get(id)?.answer(result);
}

/**
 * Asks before an irreversible or customer-visible action, in the native confirm sheet (`/konfirmasi`). Resolves true on
 * the confirm button; false on cancel, Close, a swipe down or the hardware back.
 */
export function useConfirm(): (input: ConfirmInput) => Promise<boolean> {
  return useCallback((input: ConfirmInput) => ask(confirms, CONFIRM_ROUTE, input, false), []);
}

/**
 * Offers several secondary actions on one item in the native action sheet (`/aksi`), destructive items last. Resolves
 * the chosen item's key, or null when the sheet closes without a choice.
 */
export function useActionSheet(): (input: ActionSheetInput) => Promise<string | null> {
  return useCallback((input: ActionSheetInput) => ask(actions, ACTION_ROUTE, input, null), []);
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
