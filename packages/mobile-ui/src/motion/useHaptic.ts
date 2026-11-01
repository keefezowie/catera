import { useMemo } from "react";
import * as Haptics from "expo-haptics";

/**
 * The haptic map: the feel matches the meaning.
 * - tap: a press that does something (buttons, rows, tiles).
 * - select: a choice or a toggle changes (chips, switches, radios, save and unsave, a copied value).
 * - success: something finished (a success toast).
 * - warning: a caution the person can recover from (a warning toast).
 * - error: something failed (an error toast).
 * Toasts play theirs from `tone` (override with `haptic`), so a screen pairs a toast with no haptic call of its own.
 */
export type HapticKind = "tap" | "select" | "success" | "warning" | "error";

// Haptics are decoration: a missing motor or a denied permission must never surface as an error.
const quiet = (run: () => Promise<void>) => () => {
  try {
    run().catch(() => {});
  } catch {
    // synchronous failure on platforms without a haptics module
  }
};

/**
 * Android's own feedback for a choice and a press, played by the view (`performHapticFeedback`): the system's crisp
 * tick and click, at the strength the person set for touch feedback, and nothing when they turned it off. expo-haptics'
 * `selectionAsync` and `impactAsync` drive the vibrator directly instead, a 50ms buzz at 12% that is hard to feel and
 * ignores that setting. The segment tick exists from Android 14; older versions take the clock tick, which every
 * version has.
 */
const androidSelect = () =>
  Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(() =>
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick),
  );
const androidTap = () => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key);

/** `os` is the running platform (a parameter for tests). */
export function hapticsFor(os = process.env.EXPO_OS): Record<HapticKind, () => void> {
  const android = os === "android";
  return {
    tap: quiet(android ? androidTap : () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    select: quiet(android ? androidSelect : () => Haptics.selectionAsync()),
    success: quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    warning: quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    error: quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  };
}

export function useHaptic(): Record<HapticKind, () => void> {
  return useMemo(() => hapticsFor(), []);
}
