import { act, renderHook } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { resetReducedMotionStore, useReduced } from "@catera/mobile-ui";

let emit: (on: boolean) => void;
let listeners: number;

function system({ atLaunch, enabled = false }: { atLaunch: boolean; enabled?: boolean }) {
  resetReducedMotionStore();
  listeners = 0;
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(atLaunch);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((name: string, cb: (on: boolean) => void) => {
    if (name === "reduceMotionChanged") {
      emit = cb;
      listeners += 1;
    }
    return { remove: () => {} };
  }) as never);
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(enabled);
}

describe("useReduced", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    resetReducedMotionStore();
  });

  it("follows a reduced-motion change made while the app is running", () => {
    system({ atLaunch: false });
    const { result } = renderHook(() => useReduced());
    expect(result.current).toBe(false);
    act(() => emit(true));
    expect(result.current).toBe(true);
    act(() => emit(false));
    expect(result.current).toBe(false);
  });

  it("a hook mounted after the setting changed starts with the new value, on one shared listener", () => {
    system({ atLaunch: false });
    const first = renderHook(() => useReduced());
    act(() => emit(true));
    expect(first.result.current).toBe(true);
    const second = renderHook(() => useReduced());
    expect(second.result.current).toBe(true);
    expect(listeners).toBe(1);
  });

  it("reads the setting once at start, for a component that mounts before any change", async () => {
    system({ atLaunch: false, enabled: true });
    const { result } = renderHook(() => useReduced());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it("stays reduced when the system said so at launch", async () => {
    system({ atLaunch: true, enabled: true });
    const { result } = renderHook(() => useReduced());
    await act(async () => {});
    expect(result.current).toBe(true);
  });
});
