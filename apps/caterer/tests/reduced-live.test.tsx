import { act, renderHook } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { useReduced } from "@catera/mobile-ui";

describe("useReduced", () => {
  afterEach(() => jest.restoreAllMocks());

  it("follows a reduced-motion change made while the app is running", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
    let listener: ((on: boolean) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((name: string, cb: (on: boolean) => void) => {
      if (name === "reduceMotionChanged") listener = cb;
      return { remove };
    }) as never);
    const { result, unmount } = renderHook(() => useReduced());
    expect(result.current).toBe(false);
    act(() => listener?.(true));
    expect(result.current).toBe(true);
    act(() => listener?.(false));
    expect(result.current).toBe(false);
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("stays reduced when the system said so at launch", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const { result } = renderHook(() => useReduced());
    expect(result.current).toBe(true);
  });
});
