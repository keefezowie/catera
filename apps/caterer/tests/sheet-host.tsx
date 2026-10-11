import { useEffect, useState, type ReactNode } from "react";
import { act } from "@testing-library/react-native";
import type { ActionSheetInput, ConfirmInput } from "@catera/mobile-ui";

/**
 * Component tests without the real router. A Dapur sheet is a route, so a screen opens it with `router.push` and the
 * sheet closes itself with `router.back`. Here `router.push` to a sheet path shows that sheet in `SheetHost`, mounted
 * next to the screen under the same providers, and `router.back` hides it again: the screen and its sheet share the
 * session, the shared stores and the parked day, as they do on the phone.
 *
 * Use it from a test file with
 *   jest.mock("expo-router", () => require("./sheet-host").routerModule);
 * and, where the confirm and action sheets should answer from the test,
 *   jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
 */

/** A pushed path, split: `/atur-antaran/d-1?meal=lunch` is `{ path: "/atur-antaran/d-1", params: { meal: "lunch" } }`. */
export type Opened = { path: string; params: Record<string, string> };

function parse(to: unknown): Opened | null {
  if (typeof to === "string") {
    const url = new URL(to, "https://dapur.invalid");
    return { path: decodeURIComponent(url.pathname), params: Object.fromEntries(url.searchParams) };
  }
  if (to && typeof to === "object" && "pathname" in to) {
    const { pathname, params } = to as { pathname: string; params?: Record<string, unknown> };
    return { path: pathname, params: Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])) };
  }
  return null;
}

/** The sheet paths the host shows (and Impor's photo viewer, a screen above it); any other push is only recorded. */
const SHEETS = [/^\/atur-antaran\//, /^\/balas\//, /^\/impor-baris$/, /^\/impor-foto$/, /^\/tim$/];

let show: ((opened: Opened | null) => void) | null = null;

/** The options each stack screen was declared with, by route name, as a stand-in `Stack` records them. */
export const declared: Record<string, Record<string, unknown> | undefined> = {};

/** Records each `Stack.Screen`'s options (a function of the route is called with empty params); draws nothing. */
const Stack = Object.assign(({ children }: { children?: ReactNode }) => <>{children}</>, {
  Screen: ({ name, options }: { name: string; options?: unknown }) => {
    declared[name] =
      typeof options === "function" ? (options as (a: unknown) => Record<string, unknown>)({ route: { name, params: {} } }) : (options as Record<string, unknown>);
    return null;
  },
  Protected: ({ guard, children }: { guard: boolean; children?: ReactNode }) => (guard ? <>{children}</> : null),
});

export const routerModule = {
  Stack,
  router: {
    push: jest.fn((to: unknown) => {
      const opened = parse(to);
      if (opened && SHEETS.some((r) => r.test(opened.path))) show?.(opened);
    }),
    back: jest.fn(() => show?.(null)),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  Link: () => null,
  useLocalSearchParams: () => ({}),
};

/** Shows the sheet the last push opened, drawn by `render`, until `router.back` closes it. */
export function SheetHost({ render }: { render: (opened: Opened) => ReactNode }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  useEffect(() => {
    show = setOpened;
    return () => {
      if (show === setOpened) show = null;
    };
  }, []);
  return opened ? <>{render(opened)}</> : null;
}

/** The confirm questions asked so far, in order, each with its resolver. */
const confirms: { input: ConfirmInput; resolve: (yes: boolean) => void }[] = [];
/** The action sheets asked so far, and what each resolves to (set before the tap). */
const actions: { input: ActionSheetInput; resolve: (key: string | null) => void }[] = [];

export const confirm = jest.fn(
  (input: ConfirmInput) => new Promise<boolean>((resolve) => confirms.push({ input, resolve })),
);
export const actionSheet = jest.fn(
  (input: ActionSheetInput) => new Promise<string | null>((resolve) => actions.push({ input, resolve })),
);

/** Every `useUnsavedGuard(dirty, noun, options)` a render made, in order: what a close would ask about. */
export const unsavedGuard = jest.fn();

/**
 * `@catera/mobile-ui` with `useConfirm` and `useActionSheet` answered by the test instead of the sheet routes, and
 * `useUnsavedGuard` recorded (outside a navigator it does nothing anyway).
 */
export function mobileUiModule() {
  return {
    ...jest.requireActual("@catera/mobile-ui"),
    useConfirm: () => confirm,
    useActionSheet: () => actionSheet,
    useUnsavedGuard: (...args: unknown[]) => unsavedGuard(...args),
  };
}

/** What the screen's last render would ask on a close: null when nothing typed would be lost. */
export function lastGuard() {
  const call = unsavedGuard.mock.calls[unsavedGuard.mock.calls.length - 1] as [boolean, string, { voice?: string; nounEn?: string }];
  if (!call) throw new Error("No unsaved guard");
  const [dirty, noun, options] = call;
  return dirty ? { noun, voice: options?.voice, nounEn: options?.nounEn } : null;
}

/** The last confirm question: its copy, and a press on one of its two buttons (a cancel sends `false`). */
export function lastConfirm() {
  const asked = confirms[confirms.length - 1];
  if (!asked) throw new Error("No confirm sheet was asked");
  const { input } = asked;
  return {
    ...input,
    labels: [input.cancelLabel, input.confirmLabel],
    press: (label: string) => act(async () => asked.resolve(label === input.confirmLabel)),
  };
}

/** The last action sheet: its input, and a choice of one of its keys (or `null`, closed without a choice). */
export function lastActionSheet() {
  const asked = actions[actions.length - 1];
  if (!asked) throw new Error("No action sheet was asked");
  return { ...asked.input, choose: (key: string | null) => act(async () => asked.resolve(key)) };
}

/** Forgets the questions of the previous test. */
export function resetSheets() {
  confirms.length = 0;
  actions.length = 0;
  for (const name of Object.keys(declared)) delete declared[name];
  show?.(null);
}
