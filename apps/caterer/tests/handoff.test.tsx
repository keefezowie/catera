import { useEffect } from "react";
import { Text } from "react-native";
import { render, renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import { HANDOFF_WAIT_MS, pushAfterClose, stackSettled, useHandoffStack, type SheetEvents } from "../src/today/handoff";

/** The tab route's navigation, as the tab stack's layout sees it: records its listeners so a test can blur the tab. */
const mockTab: { listeners: Record<string, (() => void)[]> } = { listeners: {} };
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useNavigation: () => ({
    addListener: (type: string, fn: () => void) => {
      (mockTab.listeners[type] ??= []).push(fn);
      return () => {
        mockTab.listeners[type] = mockTab.listeners[type].filter((f) => f !== fn);
      };
    },
  }),
}));

type Event = { target?: string; data?: { closing?: boolean } };

/** The sheet screen's navigation: native-stack emits `transitionEnd` to it with the route key as the target. */
function fakeSheetNavigation() {
  let listeners: ((e: Event) => void)[] = [];
  const events: SheetEvents = {
    addListener: (_type, fn) => {
      listeners.push(fn);
      return () => {
        listeners = listeners.filter((f) => f !== fn);
      };
    },
  };
  return { events, emit: (e: Event) => listeners.forEach((fn) => fn(e)), count: () => listeners.length };
}

const HREF = "/pindah-tanggal/d-1?meal=lunch&date=2026-10-08";

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockTab.listeners = {};
});
afterEach(() => {
  // Nothing may be left waiting for the next test.
  jest.advanceTimersByTime(HANDOFF_WAIT_MS * 2);
  jest.useRealTimers();
});

describe("the hand-off from a tab sheet to a root-stack sheet", () => {
  it("closes the sheet first and pushes only once the tab stack reports the dismissal ended", () => {
    pushAfterClose(HREF);
    expect(router.back).toHaveBeenCalledTimes(1);
    // Still dismissing: nothing is pushed, however long the platform takes within the wait.
    jest.advanceTimersByTime(HANDOFF_WAIT_MS - 1);
    expect(router.push).not.toHaveBeenCalled();
    stackSettled();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(HREF);
    // One-shot: the timer and a second report change nothing.
    stackSettled();
    jest.advanceTimersByTime(HANDOFF_WAIT_MS * 2);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("opens on the sheet's own transitionEnd (closing, its key) and ignores every other event", () => {
    const sheet = fakeSheetNavigation();
    pushAfterClose(HREF, { sheet: { events: sheet.events, key: "atur-antaran-k1" } });
    // Another route finishing, the sheet appearing, and an event without data: none of them is this sheet leaving.
    sheet.emit({ target: "index-k0", data: { closing: true } });
    sheet.emit({ target: "atur-antaran-k1", data: { closing: false } });
    sheet.emit({ target: "atur-antaran-k1" });
    expect(router.push).not.toHaveBeenCalled();
    sheet.emit({ target: "atur-antaran-k1", data: { closing: true } });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(HREF);
    // It stops listening once it has opened; the stack's own report then changes nothing.
    expect(sheet.count()).toBe(0);
    stackSettled();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("opens anyway after the wait when no event comes", () => {
    const sheet = fakeSheetNavigation();
    pushAfterClose("/pindah-tanggal/d-2", { sheet: { events: sheet.events, key: "k" } });
    jest.advanceTimersByTime(HANDOFF_WAIT_MS);
    expect(router.push).toHaveBeenCalledWith("/pindah-tanggal/d-2");
    expect(sheet.count()).toBe(0);
    stackSettled();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("a newer hand-off replaces the one still waiting", () => {
    const first = fakeSheetNavigation();
    pushAfterClose("/pindah-tanggal/d-1", { sheet: { events: first.events, key: "k1" } });
    pushAfterClose("/pindah-tanggal/d-3");
    expect(first.count()).toBe(0);
    first.emit({ target: "k1", data: { closing: true } });
    expect(router.push).not.toHaveBeenCalled();
    stackSettled();
    jest.advanceTimersByTime(HANDOFF_WAIT_MS);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/pindah-tanggal/d-3");
  });

  it("the sheet unmounting alone pushes nothing: React leaves the tree before the native dismissal ends", () => {
    function Sheet() {
      useEffect(() => pushAfterClose(HREF), []);
      return <Text>sheet</Text>;
    }
    const view = render(<Sheet />);
    view.unmount();
    expect(router.push).not.toHaveBeenCalled();
    stackSettled();
    expect(router.push).toHaveBeenCalledWith(HREF);
  });
});

describe("the tab stack that hosts the hand-off", () => {
  it("hands its finished transitions to the waiting hand-off", () => {
    const { result } = renderHook(() => useHandoffStack("k-1:owner"));
    pushAfterClose(HREF);
    result.current.onFinishTransitioning();
    expect(router.push).toHaveBeenCalledWith(HREF);
  });

  it("cancels the waiting hand-off when the tab loses focus: neither the stack's report nor the timer opens it", () => {
    renderHook(() => useHandoffStack("k-1:owner"));
    pushAfterClose(HREF);
    mockTab.listeners.blur.forEach((fn) => fn());
    stackSettled();
    jest.advanceTimersByTime(HANDOFF_WAIT_MS * 2);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("cancels it on sign-out", () => {
    const { rerender } = renderHook(({ session }: { session: string | undefined }) => useHandoffStack(session), {
      initialProps: { session: "k-1:owner" as string | undefined },
    });
    pushAfterClose(HREF);
    rerender({ session: undefined });
    stackSettled();
    jest.advanceTimersByTime(HANDOFF_WAIT_MS * 2);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("cancels it when the stack goes", () => {
    const { unmount } = renderHook(() => useHandoffStack("k-1:owner"));
    pushAfterClose(HREF);
    unmount();
    jest.advanceTimersByTime(HANDOFF_WAIT_MS * 2);
    expect(router.push).not.toHaveBeenCalled();
  });
});
