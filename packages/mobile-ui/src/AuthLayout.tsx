import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ScrollView, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";
import { Button, Field, Screen, Text } from "./components";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { PressableScale } from "./motion";
import { useReduced } from "./motion/useReduced";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboard } from "./useKeyboard";
import { useLayoutScale } from "./layoutScale";
import { StateArt } from "./brand/StateArt";
import { fontFor } from "./type";
import { themedStyles, useColors } from "./theme";

/** The brand mark above a sign-in title: the waving mascot at 56dp. Decorative (StateArt hides it from screen readers). */
export const AUTH_MARK = 56;

/**
 * Gives a block's room back while the keyboard is up: its height and opacity run to 0 over `nativeMotion.control` and
 * back, and jump there at once under reduced motion so the page does not move. Before the block's height is measured
 * it lays out naturally.
 */
function Collapsible({ hidden, children, testID }: { hidden: boolean; children: ReactNode; testID: string }) {
  const reduced = useReduced();
  const [full, setFull] = useState<number | null>(null);
  const shown = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    const to = hidden ? 0 : 1;
    shown.value = reduced ? to : withTiming(to, { duration: nativeMotion.control, easing: Easing.bezier(...nativeMotion.ease) });
  }, [hidden, reduced, shown]);
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
 * The head of a sign-in or sign-up screen, left-aligned: a small mark that gives its room back while the keyboard is
 * up (the waving mascot at 56dp, or `brand` as a wordmark where there is no mascot), then the large title, the screen's
 * one heading, and under it one line that says what this method needs.
 */
export function AuthHeading({ title, subtitle, brand }: { title: string; subtitle?: string; brand?: string }) {
  const c = useColors();
  const { up } = useKeyboard();
  return (
    <View style={{ gap: 8, paddingTop: 8 }}>
      <Collapsible hidden={up} testID="auth-mark">
        {brand ? (
          <Text style={{ color: c.charcoal, fontFamily: fontFor("800"), fontSize: 17, lineHeight: 24 }}>{brand}</Text>
        ) : (
          <StateArt pose="melambai" base={AUTH_MARK} style={{ alignSelf: "flex-start" }} />
        )}
      </Collapsible>
      <Text variant="display" accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={{ color: c.muted }}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * Text tabs for the sign-in method: the chosen one is bold ink with a forest bar under it, the others are muted.
 * Each tab is a 48dp target; they sit at the start of the row and wrap under large text.
 */
export function MethodTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            haptic="select"
            onPress={() => onChange(o.value)}
            style={[styles.tab, { borderBottomColor: on ? c.forest : "transparent" }]}
          >
            <RNText style={[styles.label, { color: on ? c.charcoal : c.muted, fontFamily: fontFor(on ? "800" : "600") }]}>{o.label}</RNText>
          </PressableScale>
        );
      })}
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

/** A group of children with the sign-in screens' field gap. */
export function AuthFields({ children }: { children: ReactNode }) {
  return <View style={{ gap: 14 }}>{children}</View>;
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 24 },
  tab: { minHeight: 48, minWidth: 48, paddingHorizontal: 4, justifyContent: "center", alignItems: "center", borderBottomWidth: 3 },
  label: { fontSize: 16 },
}));

/** A password field with a show/hide toggle at its end edge. Everything else is `Field`'s. */
export function PasswordField({
  label,
  showWord,
  hideWord,
  showA11y,
  hideA11y,
  ...field
}: {
  label: string;
  showWord: string;
  hideWord: string;
  showA11y: string;
  hideA11y: string;
} & Omit<ComponentProps<typeof Field>, "label" | "trailing" | "secureTextEntry">) {
  const [shown, setShown] = useState(false);
  return (
    <Field
      label={label}
      {...field}
      secureTextEntry={!shown}
      trailing={
        <Button
          variant="text"
          label={shown ? hideWord : showWord}
          accessibilityLabel={shown ? hideA11y : showA11y}
          onPress={() => setShown((s) => !s)}
        />
      }
    />
  );
}

/**
 * A sign-in or sign-up page that keeps its action in reach of the keyboard. On Android the window is edge-to-edge and
 * the keyboard draws over the page without resizing it, so the page adds the keyboard's height under its content (the
 * scroll view can then bring the error and the primary button above it), and scrolls to the end whenever `revealKey`
 * changes (a failed attempt), so the error and the button are what is on screen. iOS insets the scroll view itself.
 * No dependency: it reads the keyboard events (`useKeyboard`). The customer scale's Screen already pays the bottom inset
 * (the 3-button navigation bar); Dapur's does not, so there the page adds the bottom inset to the keyboard padding.
 */
export function AuthScreen({ children, revealKey }: { children: ReactNode; revealKey?: string | number }) {
  const { up, height } = useKeyboard();
  const insets = useSafeAreaInsets();
  const scaled = useLayoutScale() === "v2";
  const reduced = useReduced();
  const ref = useRef<ScrollView>(null);
  const android = process.env.EXPO_OS !== "ios";
  useEffect(() => {
    if (!android || !revealKey) return;
    // After the new row (the error) has laid out.
    const frame = requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: !reduced }));
    return () => cancelAnimationFrame(frame);
  }, [android, revealKey, reduced]);
  useEffect(() => {
    if (!android || !up) return;
    // The keyboard padding is in place with this render; the mascot is still collapsing, so wait for it to finish
    // (at once under reduced motion) and then bring the end of the page, the primary button, above the keyboard.
    // The fields come before the button, so the end of the page keeps the focused field on screen.
    let frame = 0;
    const timer = setTimeout(
      () => {
        frame = requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: !reduced }));
      },
      reduced ? 0 : nativeMotion.control + 40,
    );
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [android, up, height, reduced]);
  return (
    <Screen scrollRef={ref} extraBottom={android && up ? height + (scaled ? 0 : insets.bottom) : 0}>
      {children}
    </Screen>
  );
}
