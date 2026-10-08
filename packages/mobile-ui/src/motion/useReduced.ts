import { useReducedMotion } from "react-native-reanimated";

/** True when the system asks for reduced motion (Android "Remove animations", iOS "Reduce Motion"). */
export function useReduced(): boolean {
  return useReducedMotion();
}
