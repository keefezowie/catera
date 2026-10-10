import { createContext, Fragment, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { nativeMotion } from "@catera/design-tokens";
import { Text } from "./components";
import { useReduced } from "./motion";
import { useColors } from "./theme";
import { ANDROID_TAB_BAR, ToastAnchorContext, type ToastAnchor } from "./toastAnchor";
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
/**
 * With a screen reader on, reaching the action takes longer than 5s. Android asks the system for the user's own
 * accessibility timeout (`getRecommendedTimeoutMillis`); iOS has no such setting, so it holds 10s.
 */
const IOS_SCREEN_READER_ACTION_MS = 10000;
/** The entrance travel, in dp: from the edge the toast sits against (iOS top, or bottom in a sheet; Android bottom). */
const ENTER_TRAVEL = 12;
/** With no anchor from the focused screen, iOS assumes a standard 44pt bar and Android the tab bar. */
const IOS_BAR = 44;
const GAP = 8;

const ease = Easing.bezier(...nativeMotion.ease);

// Without a provider (isolated component tests) a toast is silently dropped.
const ToastContext = createContext<ToastApi>({ show: () => {}, hide: () => {} });

/** Shows a routine outcome ("Alamat disimpan") with an optional action ("Urungkan"). Needs a `ToastProvider` above. */
export function useToast(): ToastApi {
  return use(ToastContext);
}

type Shown = ToastInput & { id: number };

/** The edge every anchor clears (the lowest header bottom, the highest footer top), and whether any is a sheet. */
function mergeAnchors(anchors: ReadonlyMap<object, ToastAnchor>): ToastAnchor {
  let top: number | undefined;
  let bottom: number | undefined;
  let sheet = false;
  for (const anchor of anchors.values()) {
    if (anchor.top !== undefined) top = Math.max(top ?? anchor.top, anchor.top);
    if (anchor.bottom !== undefined) bottom = Math.max(bottom ?? anchor.bottom, anchor.bottom);
    if (anchor.sheet) sheet = true;
  }
  return { top, bottom, sheet };
}

/**
 * One per app, inside `ThemeProvider` and around the navigator, so every screen can report a routine outcome without
 * a dialog. One toast at a time: a new one replaces the shown one. It closes itself after 3s, or 5s when it carries an
 * action; while a screen reader is on, an action toast stays until its action is used, it is replaced, or the
 * platform's recommended timeout passes. Each `show` is announced once, with its action's name.
 * iOS draws a pill under the focused screen's header, or at the bottom when that screen is a sheet (above the home
 * indicator, the keyboard and any footer); Android a Material snackbar above its tab bar or footer (see
 * `useToastAnchor`). `os` defaults to the running platform.
 */
export function ToastProvider({ children, os = process.env.EXPO_OS }: { children: ReactNode; os?: string }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [anchors, setAnchors] = useState<ReadonlyMap<object, ToastAnchor>>(() => new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);
  const shownId = useRef(0);
  const screenReader = useRef(false);
  // iOS only: a sheet's toast sits above the keyboard. Android's window resizes for the keyboard, so it needs nothing.
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    if (os !== "ios") return;
    const onShow = Keyboard.addListener("keyboardWillShow", (e) => setKeyboard(e.endCoordinates.height));
    const onHide = Keyboard.addListener("keyboardWillHide", () => setKeyboard(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [os]);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (on) => {
        if (live) screenReader.current = on === true;
      },
      () => {},
    );
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", (on) => {
      screenReader.current = on === true;
    });
    return () => {
      live = false;
      subscription?.remove();
    };
  }, []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const hide = useCallback(() => {
    clearTimer();
    shownId.current = 0;
    setShown(null);
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      clearTimer();
      nextId.current += 1;
      const id = nextId.current;
      shownId.current = id;
      setShown({ ...input, id });
      AccessibilityInfo.announceForAccessibility(input.action ? `${input.message}, ${input.action.label}` : input.message);
      // A timeout that resolves after this toast was replaced or closed schedules nothing.
      const closeAfter = (ms: number) => {
        if (shownId.current === id) timer.current = setTimeout(hide, ms);
      };
      if (!input.action) return closeAfter(SHOW_MS);
      if (!screenReader.current) return closeAfter(SHOW_WITH_ACTION_MS);
      if (os !== "android") return closeAfter(IOS_SCREEN_READER_ACTION_MS);
      AccessibilityInfo.getRecommendedTimeoutMillis(SHOW_WITH_ACTION_MS).then(
        (ms) => closeAfter(typeof ms === "number" && ms > SHOW_WITH_ACTION_MS ? ms : SHOW_WITH_ACTION_MS),
        () => closeAfter(SHOW_WITH_ACTION_MS),
      );
    },
    [hide, os],
  );

  useEffect(() => clearTimer, []);

  const register = useCallback((key: object, anchor: ToastAnchor | null) => {
    setAnchors((prev) => {
      const current = prev.get(key);
      if (anchor === null) {
        if (!current) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      }
      if (current && current.top === anchor.top && current.bottom === anchor.bottom) return prev;
      return new Map(prev).set(key, anchor);
    });
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);
  const anchor = useMemo(() => mergeAnchors(anchors), [anchors]);
  // iOS presents sheets and modals in their own controllers above this tree, so the toast lives in a window of its
  // own there to stay on top of them. Android keeps every screen in this window, so the toast simply draws last.
  const Overlay = os === "ios" ? FullWindowOverlay : Fragment;

  return (
    <ToastAnchorContext.Provider value={register}>
      <ToastContext.Provider value={api}>
        {children}
        <Overlay>
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {shown ? (
              <ToastView
                key={shown.id}
                toast={shown}
                anchor={anchor}
                keyboard={keyboard}
                onDone={hide}
                ios={os === "ios"}
              />
            ) : null}
          </View>
        </Overlay>
      </ToastContext.Provider>
    </ToastAnchorContext.Provider>
  );
}

function ToastView({
  toast,
  anchor,
  keyboard,
  onDone,
  ios,
}: {
  toast: Shown;
  anchor: ToastAnchor;
  keyboard: number;
  onDone: () => void;
  ios: boolean;
}) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReduced();
  // Every placement but iOS full-screen sits against the bottom edge, and enters from below.
  const atTop = ios && !anchor.sheet;

  const motion = useMemo(
    () =>
      reduced
        ? { entering: undefined, exiting: undefined }
        : {
            // Reanimated's FadeInUp starts above its place and FadeInDown below it; both travel 12dp here.
            entering: (atTop ? FadeInUp : FadeInDown)
              .duration(nativeMotion.content)
              .easing(ease)
              .withInitialValues({ opacity: 0, transform: [{ translateY: atTop ? -ENTER_TRAVEL : ENTER_TRAVEL }] }),
            exiting: FadeOut.duration(nativeMotion.control).easing(ease),
          },
    [reduced, atTop],
  );

  // iOS full screen: under the focused screen's header, never under the status bar; with no header reported, under a
  // 44pt bar. iOS sheet: at the window's bottom, above the home indicator and any footer, lifted by the part of the
  // keyboard that rises past the home indicator (the keyboard covers that inset). Android: above the focused screen's
  // tab bar or footer, never in the system inset; with none reported, above the tab bar. The lane is the full width
  // less 16 on each side: the iOS pill hugs its words in the lane's centre, the Android snackbar fills the lane up to
  // Material's 600dp.
  const lane = atTop
    ? { top: (anchor.top !== undefined ? Math.max(anchor.top, insets.top) : insets.top + IOS_BAR) + GAP }
    : ios
      ? {
          bottom:
            Math.max(anchor.bottom ?? insets.bottom, insets.bottom) + Math.max(0, keyboard - insets.bottom) + GAP,
        }
      : {
          bottom:
            (anchor.bottom !== undefined ? Math.max(anchor.bottom, insets.bottom) : insets.bottom + ANDROID_TAB_BAR) +
            GAP,
        };
  const shape = ios
    ? {
        borderRadius: 22,
        minHeight: 44,
        maxWidth: 560,
        paddingStart: 18,
        paddingEnd: toast.action ? 6 : 18,
        borderCurve: "continuous" as const,
      }
    : {
        borderRadius: 4,
        minHeight: 48,
        width: "100%" as const,
        maxWidth: 600,
        paddingStart: 16,
        paddingEnd: toast.action ? 8 : 16,
      };

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
            <Text
              numberOfLines={1}
              style={{ color: palette.toastAction, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 }}
            >
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
