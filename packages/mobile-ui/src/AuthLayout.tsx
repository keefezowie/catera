import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Keyboard, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";
import { Button, Field, Text } from "./components";
import { PressableScale } from "./motion";
import { StateArt } from "./brand/StateArt";
import { fontFor } from "./type";
import { themedStyles, useColors } from "./theme";

/** Whether the on-screen keyboard is up. iOS announces it a beat earlier (`will`), Android only when it is shown (`did`). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const ios = process.env.EXPO_OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/** The brand mark above a sign-in title: the waving mascot at 56dp. Decorative (StateArt hides it from screen readers). */
export const AUTH_MARK = 56;

/**
 * The head of a sign-in or sign-up screen, left-aligned: a small mascot mark that gives its room back while the
 * keyboard is up, then the large title and, under it, one line that says what this method needs.
 */
export function AuthHeading({ title, subtitle, mark = true }: { title: string; subtitle?: string; mark?: boolean }) {
  const c = useColors();
  const keyboard = useKeyboardVisible();
  return (
    <View style={{ gap: 8, paddingTop: 8 }}>
      {mark && !keyboard ? <StateArt pose="melambai" base={AUTH_MARK} style={{ alignSelf: "flex-start" }} /> : null}
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
  tab: { minHeight: 48, justifyContent: "center", borderBottomWidth: 3 },
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
