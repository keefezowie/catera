import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle, type ScrollViewInstance } from "react-native";
import { Button, Field, Screen, Text } from "./components";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { PressableScale } from "./motion";
import { useReduced } from "./motion/useReduced";
import { useKeyboard } from "./useKeyboard";
import { AuthMascot } from "./brand/AuthMascot";
import { AUTH_MARK } from "./brand/authMark";
import type { MascotPose } from "./brand/MascotArt";
import { useColors } from "./theme";

export { AUTH_MARK } from "./brand/authMark";

/** The collapse's length: about an Android keyboard's slide, so the page rises with it. */
const COLLAPSE_MS = 260;

/**
 * Gives a block's room back while the keyboard is up, so what is under it rises: its height and opacity run to 0 on
 * one eased curve and back. With `keyboard` (Android's keyboard state, on the UI thread) the curve starts the frame the
 * keyboard starts to open or close, where `hidden` (Android's `keyboardDidShow`) would only arrive once it is up; the
 * curve is timed, not tied to the keyboard's reported height, which some phones send in a few coarse steps. Without it
 * (iOS, where `hidden` arrives as the keyboard starts) the same curve runs from `hidden`. Under reduced motion they
 * jump, so the page does not move. Before the block's height is measured it lays out naturally.
 */
function Collapsible({
  hidden,
  keyboard,
  children,
  testID,
}: {
  hidden: boolean;
  keyboard?: SharedValue<KeyboardState>;
  children: ReactNode;
  testID: string;
}) {
  const reduced = useReduced();
  const [full, setFull] = useState<number | null>(null);
  const shown = useSharedValue(hidden ? 0 : 1);
  const ease = Easing.bezier(...nativeMotion.ease);
  useEffect(() => {
    if (keyboard) return;
    const to = hidden ? 0 : 1;
    shown.value = reduced ? to : withTiming(to, { duration: COLLAPSE_MS, easing: ease });
  }, [hidden, reduced, shown, keyboard]);
  useAnimatedReaction(
    () => (keyboard ? keyboard.value : KeyboardState.UNKNOWN),
    (state, previous) => {
      if (!keyboard || reduced || state === previous) return;
      const up = state === KeyboardState.OPENING || state === KeyboardState.OPEN;
      const down = state === KeyboardState.CLOSING || state === KeyboardState.CLOSED;
      if (up || down) shown.value = withTiming(up ? 0 : 1, { duration: COLLAPSE_MS, easing: ease });
    },
  );
  const style = useAnimatedStyle(() => (full === null ? {} : { height: full * shown.value, opacity: shown.value, overflow: "hidden" }));
  // Reduced motion draws the end state from the props themselves: no timing, nothing to ease.
  const still = full === null ? undefined : { height: hidden ? 0 : full, opacity: hidden ? 0 : 1, overflow: "hidden" as const };
  return (
    <Animated.View testID={testID} style={reduced ? still : style} pointerEvents={hidden ? "none" : "auto"}>
      <View onLayout={(e) => full === null && setFull(e.nativeEvent.layout.height)} style={{ alignSelf: "flex-start" }}>
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * The head of a sign-in or sign-up screen, left-aligned: a small mark (the waving mascot at 56dp), then the large title, the screen's one heading, and under it one line that says
 * what this method needs. The mark gives its room back while the keyboard is up and the page rises under it; on Android
 * the collapse starts from the keyboard's own state on the UI thread (Android announces the keyboard to JS only once it
 * is up, too late to move with it).
 */
export function AuthHeading({ title, subtitle, pose = "melambai" }: { title: string; subtitle?: string; pose?: MascotPose }) {
  const c = useColors();
  const { up } = useKeyboard();
  // Without these flags Reanimated adds window margins in Expo Go, which does not report edge-to-edge.
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  return (
    <View style={{ gap: 8, paddingTop: 8 }}>
      <Collapsible hidden={up} keyboard={process.env.EXPO_OS === "ios" ? undefined : keyboard.state} testID="auth-mark">
        <AuthMascot pose={pose} base={AUTH_MARK} />
      </Collapsible>
      <Text variant="display" accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={{ color: c.muted }}>{subtitle}</Text> : null}
    </View>
  );
}

/** "Belum punya akun? Daftar": a plain sentence and its action, centred under the primary button as in the reference. */
export function AuthSwitch({ prompt, action, onPress, style }: { prompt: string; action: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 4 }, style]}>
      <Text style={{ color: c.muted }}>{prompt}</Text>
      <Button variant="text" label={action} onPress={onPress} />
    </View>
  );
}

/** A password field with a show/hide toggle at its end edge. Everything else is `Field`'s. */
export function PasswordField({
  label,
  showA11y,
  hideA11y,
  shown: shownProp,
  onShownChange,
  ...field
}: {
  label: string;
  showA11y: string;
  hideA11y: string;
  /** Controlled show/hide, so a password pair can toggle together. */
  shown?: boolean;
  onShownChange?: (v: boolean) => void;
} & Omit<ComponentProps<typeof Field>, "label" | "trailing" | "secureTextEntry">) {
  const c = useColors();
  const [own, setOwn] = useState(false);
  const shown = shownProp ?? own;
  const setShown = (v: boolean) => (onShownChange ? onShownChange(v) : setOwn(v));
  return (
    <Field
      label={label}
      {...field}
      secureTextEntry={!shown}
      trailing={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={shown ? hideA11y : showA11y}
          accessibilityState={{ selected: shown }}
          haptic="select"
          onPress={() => setShown(!shown)}
          style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={22} color={c.muted} />
        </PressableScale>
      }
    />
  );
}

/**
 * A sign-in or sign-up page that keeps its action in reach of the keyboard: `Screen` makes the room for the keyboard, and
 * on Android this page scrolls to the end whenever `revealKey` changes (a failed attempt), so the error and the button
 * are what is on screen. iOS insets the scroll view itself.
 */
export function AuthScreen({ children, revealKey, footer }: { children: ReactNode; revealKey?: string | number; footer?: ReactNode }) {
  const reduced = useReduced();
  const ref = useRef<ScrollViewInstance>(null);
  const android = process.env.EXPO_OS !== "ios";
  useEffect(() => {
    if (!android || !revealKey) return;
    // After the new row (the error) has laid out.
    const frame = requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: !reduced }));
    return () => cancelAnimationFrame(frame);
  }, [android, revealKey, reduced]);
  return (
    <Screen scrollRef={ref} footer={footer}>
      {children}
    </Screen>
  );
}
