import { useRef, useState, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  type AccessibilityRole,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, type PaletteKey } from "@catera/design-tokens";
import { PressableScale, useReduced } from "./motion";
import { themedStyles, useColors } from "./theme";
import { useTopInsetOwned } from "./TopInset";
import { fontFor, fonts } from "./type";

/** The regular-weight family for Plus Jakarta Sans; other weights come from `fonts` / `fontFor`. */
export const FONT = fonts.regular;
export { colors };

const textVariants = {
  title: { fontSize: 30, lineHeight: 39, fontWeight: "700", letterSpacing: -0.8 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 23, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 23, fontWeight: "700" },
  caption: { fontSize: 11, lineHeight: 18, fontWeight: "400" },
  number: { fontSize: 40, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

/** Which palette entry each variant reads; the palette is the active theme's. */
const variantColor: Record<keyof typeof textVariants, PaletteKey> = {
  title: "forest",
  heading: "forest",
  body: "charcoal",
  label: "forest",
  caption: "muted",
  number: "forest",
};

export function Text({
  variant = "body",
  style,
  children,
  accessibilityRole,
  ...rest
}: {
  variant?: keyof typeof textVariants;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  testID?: string;
  numberOfLines?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessible?: boolean;
  /** Lets the user copy the text; set it on data and error messages. */
  selectable?: boolean;
}) {
  const palette = useColors();
  // Android cannot select weights from a variable font, so a weight becomes a static family.
  // An explicit fontFamily wins over any weight: app code passes `fonts.semibold` etc. in styles it hands to Text.
  // The variant colour comes first so a caller's own colour still wins.
  const { fontWeight, fontFamily, ...flat } = StyleSheet.flatten([
    textVariants[variant],
    { color: palette[variantColor[variant]] },
    style,
  ]) as TextStyle;
  return (
    <RNText
      style={[flat, { fontFamily: fontFamily ?? fontFor(fontWeight) }]}
      accessibilityRole={accessibilityRole ?? (variant === "title" || variant === "heading" ? "header" : undefined)}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary";
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic={disabled ? "none" : "tap"}
      onPress={onPress}
      style={[
        styles.button,
        primary && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "text" && styles.textButton,
        disabled && primary && styles.disabled,
        // A secondary or text button has no fill to grey out, so a disabled one fades instead.
        disabled && !primary && styles.disabledQuiet,
        style,
      ]}
    >
      <RNText
        style={[
          styles.buttonLabel,
          { color: primary ? (disabled ? c.muted : c.cream) : c.forest },
        ]}
      >
        {label}
      </RNText>
    </PressableScale>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <RNText style={[styles.chipLabel, { color: selected ? c.cream : c.forest }]}>
        {label}
      </RNText>
    </PressableScale>
  );
}

export function Segmented<T extends string>({
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
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <PressableScale
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          haptic="select"
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentOn]}
        >
          <RNText
            style={[styles.chipLabel, { color: o.value === value ? c.cream : c.forest }]}
          >
            {o.label}
          </RNText>
        </PressableScale>
      ))}
    </View>
  );
}

export function Card({
  children,
  tone = "surface",
  style,
}: {
  children: ReactNode;
  tone?: "surface" | "attention" | "brand" | "sage";
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const cardTones = useCardTones();
  return <View style={[styles.card, cardTones[tone], style]}>{children}</View>;
}

export function Field({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string } & TextInputProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <RNText style={[styles.fieldLabel]}>{label}</RNText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[styles.input, !!error && { borderColor: c.danger }]}
        {...input}
      />
      {error ? (
        <RNText style={[styles.caption, { color: c.danger }]}>{error}</RNText>
      ) : hint ? (
        <RNText style={styles.caption}>{hint}</RNText>
      ) : null}
    </View>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  decreaseLabel,
  increaseLabel,
  min = 0,
  max = 30,
}: {
  label: string;
  /** Translated accessibility labels, e.g. "Kurangi Porsi per hari" / "Tambah Porsi per hari". */
  decreaseLabel: string;
  increaseLabel: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const styles = useStyles();
  return (
    <View style={styles.stepper}>
      <RNText style={[styles.body, { flex: 1, fontFamily: fontFor("600") }]}>{label}</RNText>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        accessibilityState={{ disabled: value <= min }}
        disabled={value <= min}
        haptic="select"
        onPress={() => onChange(value - 1)}
        style={styles.stepButton}
      >
        <RNText style={styles.stepGlyph}>−</RNText>
      </PressableScale>
      <RNText style={[styles.body, { width: 24, textAlign: "center", fontFamily: fontFor("800") }]}>
        {value}
      </RNText>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
        accessibilityState={{ disabled: value >= max }}
        disabled={value >= max}
        haptic="select"
        onPress={() => onChange(value + 1)}
        style={styles.stepButton}
      >
        <RNText style={styles.stepGlyph}>+</RNText>
      </PressableScale>
    </View>
  );
}

/** Bottom sheet for short decisions (share, exceptions). */
export function Sheet({
  visible,
  onClose,
  title,
  closeLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Translated accessibility label of the scrim ("Tutup" / "Close"). */
  closeLabel: string;
  children: ReactNode;
}) {
  const reduced = useReduced();
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
      <View style={styles.sheet} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <View style={styles.grabber} />
        {title ? <Text variant="heading">{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const styles = useStyles();
  // The demo strip owns the status-bar inset while it is shown, so the screen must not add a second one.
  const topOwned = useTopInsetOwned();
  // KeyboardAvoidingView measures its frame relative to its parent, but the keyboard is positioned in the window.
  // The header and the demo strip sit above this screen, so on iOS the padding is short by exactly their height.
  // Rather than have each of them report a height (and go stale when a headerless screen is pushed on top), the
  // screen asks the OS where its own top edge really is, and re-asks whenever it is laid out.
  // iOS keyboard behaviour is not covered by jest or the Android emulator; it is unverified on a device.
  const frame = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const measureFrame = () => {
    if (Platform.OS !== "ios") return;
    frame.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setKeyboardOffset(Math.max(0, Math.round(y)));
    });
  };
  const body = (
    <View testID="screen-body" style={styles.screenBody}>
      {children}
    </View>
  );
  return (
    <SafeAreaView
      ref={frame}
      onLayout={measureFrame}
      style={styles.screen}
      edges={topOwned ? ["left", "right"] : ["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        {scroll ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? (
          <View testID="screen-footer" style={styles.footer}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The round surface button: back, close, heart. 48dp target. */
export function RoundButton({
  icon,
  label,
  onPress,
  selected,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      haptic="tap"
      onPress={onPress}
      style={[styles.round, style]}
    >
      <Ionicons name={icon} size={22} color={c.forest} />
    </PressableScale>
  );
}

const useCardTones = themedStyles((c) => ({
  surface: { backgroundColor: c.surface, borderColor: c.line },
  attention: { backgroundColor: c.cream, borderColor: c.attentionBorder },
  brand: { backgroundColor: c.forest, borderColor: c.forest },
  sage: { backgroundColor: c.sage, borderColor: c.sage },
}));

const useStyles = themedStyles((c) => ({
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: c.forest },
  secondary: { borderWidth: 1, borderColor: c.secondaryBorder, backgroundColor: "transparent" },
  textButton: { minHeight: 48, paddingHorizontal: 4, backgroundColor: "transparent" },
  disabled: { backgroundColor: c.fieldBorder },
  disabledQuiet: { opacity: 0.45 },
  buttonLabel: { fontFamily: fontFor("700"), fontSize: 15 },
  chip: { minHeight: 48, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center" },
  chipOn: { backgroundColor: c.forest },
  chipOff: { borderWidth: 1, borderColor: c.secondaryBorder },
  chipLabel: { fontFamily: fontFor("700"), fontSize: 13 },
  segmented: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 10,
    backgroundColor: c.sage,
  },
  segment: { flex: 1, minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: c.forest },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  fieldLabel: { fontFamily: fontFor("700"), fontSize: 13, color: c.forest },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.fieldBorder,
    borderRadius: 9,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    fontFamily: FONT,
    fontSize: 15,
    color: c.charcoal,
  },
  caption: { fontFamily: FONT, fontSize: 12, color: c.muted },
  body: { fontFamily: FONT, fontSize: 15, color: c.charcoal },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 52,
  },
  stepButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  stepGlyph: { fontSize: 22, color: c.forest },
  scrim: { flex: 1, backgroundColor: "rgba(20,30,25,0.45)" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 10,
    gap: 14,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: c.fieldBorder,
  },
  screen: { flex: 1, backgroundColor: c.canvas },
  keyboard: { flex: 1 },
  screenBody: { paddingHorizontal: 20, paddingTop: 16, gap: 16, maxWidth: 760, width: "100%", alignSelf: "center" },
  footer: {
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.surface,
    gap: 8,
  },
}));
