import { useMemo } from "react";
import * as Haptics from "expo-haptics";

export type HapticKind = "tap" | "select" | "success" | "warning";

// Haptics are decoration: a missing motor or a denied permission must never surface as an error.
const quiet = (run: () => Promise<void>) => () => {
  try {
    run().catch(() => {});
  } catch {
    // synchronous failure on platforms without a haptics module
  }
};

export function useHaptic(): Record<HapticKind, () => void> {
  return useMemo(
    () => ({
      tap: quiet(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      select: quiet(() => Haptics.selectionAsync()),
      success: quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    }),
    [],
  );
}
