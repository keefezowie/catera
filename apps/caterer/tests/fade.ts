import { FadeIn } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";

/**
 * Watches the fades FadeSwap starts. A fade is a layout animation built once per swap (`FadeIn.duration(content)`), not a
 * `withTiming` call, so this returns the same `mock.calls` shape those tests filter (`[1, { duration }]` per fade).
 */
export function spyFades() {
  const spy = jest.spyOn(FadeIn, "duration");
  return {
    get mock() {
      return {
        calls: spy.mock.calls
          .filter(([duration]) => duration === nativeMotion.content)
          .map(([duration]) => [1, { duration }] as [number, { duration: number }]),
      };
    },
    mockRestore: () => spy.mockRestore(),
  };
}
