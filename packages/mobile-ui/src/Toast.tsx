import { createContext, Fragment, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { nativeMotion } from "@catera/design-tokens";
import { Text } from "./components";
import { useReduced } from "./motion";
import { useColors } from "./theme";
import { fonts } from "./type";

export type ToastInput = {
  message: string;
  action?: { label: string; onPress: () => void };
  tone?: "success" | "error";
};

export type ToastApi = { show(input: ToastInput): void; hide(): void };

/** How long a toast stays: long enough to read; one with an action stays long enough to reach it. */
const SHOW_MS = 3000;
const SHOW_WITH_ACTION_MS = 5000;
/** The entrance travel, in dp: iOS from above, Android from below. */
const ENTER_TRAVEL = 12;
/** iOS sits the pill under a standard 44pt navigation bar; Android sits the snackbar above the 80dp navigation bar. */
const IOS_BAR = 44;
const ANDROID_NAV_BAR = 80;
const GAP = 8;

const ease = Easing.bezier(...nativeMotion.ease);

// Without a provider (isolated component tests) a toast is silently dropped.
const ToastContext = createContext<ToastApi>({ show: () => {}, hide: () => {} });

/** Shows a routine outcome ("Alamat disimpan") with an optional action ("Urungkan"). Needs a `ToastProvider` above. */
export function useToast(): ToastApi {
  return use(ToastContext);
}

type Shown = ToastInput & { id: number };

/**
 * One per app, inside `ThemeProvider` and around the navigator, so every screen can report a routine outcome without
 * a dialog. One toast at a time: a new one replaces the shown one. It closes itself after 3s, or 5s when it carries an
 * action, and each `show` is announced once to screen readers. iOS draws a pill under the navigation bar; Android a
 * Material snackbar above the navigation bar. `os` defaults to the running platform.
 */
export function ToastProvider({ children, os = process.env.EXPO_OS }: { children: ReactNode; os?: string }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const hide = useCallback(() => {
    clearTimer();
    setShown(null);
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      clearTimer();
      nextId.current += 1;
      setShown({ ...input, id: nextId.current });
      AccessibilityInfo.announceForAccessibility(input.message);
      timer.current = setTimeout(hide, input.action ? SHOW_WITH_ACTION_MS : SHOW_MS);
    },
    [hide],
  );

  useEffect(() => clearTimer, []);

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);
  // iOS presents sheets and modals in their own controllers above this tree, so the toast lives in a window of its
  // own there to stay on top of them. Android keeps every screen in this window, so the toast simply draws last.
  const Overlay = process.env.EXPO_OS === "ios" ? FullWindowOverlay : Fragment;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Overlay>
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {shown ? <ToastView key={shown.id} toast={shown} onDone={hide} ios={os === "ios"} /> : null}
        </View>
      </Overlay>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone, ios }: { toast: Shown; onDone: () => void; ios: boolean }) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReduced();

  const motion = useMemo(
    () =>
      reduced
        ? { entering: undefined, exiting: undefined }
        : {
            // Reanimated's FadeInUp starts above its place and FadeInDown below it; both travel 12dp here.
            entering: (ios ? FadeInUp : FadeInDown)
              .duration(nativeMotion.content)
              .easing(ease)
              .withInitialValues({ opacity: 0, transform: [{ translateY: ios ? -ENTER_TRAVEL : ENTER_TRAVEL }] }),
            exiting: FadeOut.duration(nativeMotion.control).easing(ease),
          },
    [reduced, ios],
  );

  // The lane is the full width less 16 on each side. iOS: the pill hugs its words in the lane's centre. Android: the
  // snackbar fills the lane up to Material's 600dp.
  const lane = ios ? { top: insets.top + IOS_BAR + GAP } : { bottom: insets.bottom + ANDROID_NAV_BAR + GAP };
  const shape = ios
    ? { borderRadius: 22, minHeight: 44, maxWidth: 560, paddingStart: 18, paddingEnd: toast.action ? 6 : 18, borderCurve: "continuous" as const }
    : { borderRadius: 4, minHeight: 48, width: "100%" as const, maxWidth: 600, paddingStart: 16, paddingEnd: toast.action ? 8 : 16 };

  const press = () => {
    toast.action?.onPress();
    onDone();
  };

  return (
    <Animated.View
      testID="toast"
      pointerEvents="box-none"
      entering={motion.entering}
      exiting={motion.exiting}
      style={[styles.lane, lane]}
    >
      <View testID="toast-surface" style={[styles.surface, shape, { backgroundColor: palette.toast }]}>
      {toast.tone === "error" ? (
        <View testID="toast-error" accessible={false} importantForAccessibility="no-hide-descendants">
          <Ionicons name="alert-circle" size={20} color={palette.onToast} />
        </View>
      ) : null}
      <Text
        style={{
          flexShrink: 1,
          color: palette.onToast,
          fontFamily: ios ? fonts.semibold : fonts.regular,
          fontSize: 14,
          lineHeight: 20,
          paddingVertical: ios ? 12 : 14,
        }}
      >
        {toast.message}
      </Text>
      {toast.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toast.action.label}
          onPress={press}
          android_ripple={{ color: palette.toastAction, borderless: false }}
          style={({ pressed }) => ({
            minHeight: ios ? 44 : 48,
            paddingHorizontal: ios ? 12 : 8,
            justifyContent: "center",
            borderRadius: ios ? 22 : 4,
            opacity: ios && pressed ? 0.5 : 1,
          })}
        >
          <Text numberOfLines={1} style={{ color: palette.toastAction, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 }}>
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lane: { position: "absolute", start: 16, end: 16, alignItems: "center" },
  surface: { flexDirection: "row", alignItems: "center", gap: 10 },
});
