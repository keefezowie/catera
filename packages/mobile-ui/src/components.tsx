import type { ReactNode } from "react";
import {
  Modal,
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
import { colors } from "@catera/design-tokens";
import { fontFor, fonts } from "./type";

/** The regular-weight family for Plus Jakarta Sans; other weights come from `fonts` / `fontFor`. */
export const FONT = fonts.regular;
export { colors };

const textVariants = {
  title: { fontSize: 30, lineHeight: 39, fontWeight: "700", letterSpacing: -0.8, color: colors.forest },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4, color: colors.forest },
  body: { fontSize: 14, lineHeight: 23, fontWeight: "400", color: colors.charcoal },
  label: { fontSize: 12, lineHeight: 23, fontWeight: "700", color: colors.forest },
  caption: { fontSize: 11, lineHeight: 18, fontWeight: "400", color: colors.muted },
  number: { fontSize: 40, fontWeight: "800", letterSpacing: -1, color: colors.forest, fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

export function Text({
  variant = "body",
  style,
  children,
  ...rest
}: {
  variant?: keyof typeof textVariants;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  testID?: string;
  numberOfLines?: number;
}) {
  // Android cannot select weights from a variable font, so a weight becomes a static family.
  // An explicit fontFamily wins over any weight: app code passes `fonts.semibold` etc. in styles it hands to Text.
  const { fontWeight, fontFamily, ...flat } = StyleSheet.flatten([textVariants[variant], style]) as TextStyle;
  return (
    <RNText style={[flat, { fontFamily: fontFamily ?? fontFor(fontWeight) }]} {...rest}>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "text" && styles.textButton,
        disabled && primary && styles.disabled,
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      <RNText
        style={[
          styles.buttonLabel,
          { color: primary ? (disabled ? colors.muted : colors.cream) : colors.forest },
        ]}
      >
        {label}
      </RNText>
    </Pressable>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <RNText style={[styles.chipLabel, { color: selected ? colors.cream : colors.forest }]}>
        {label}
      </RNText>
    </Pressable>
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
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentOn]}
        >
          <RNText
            style={[styles.chipLabel, { color: o.value === value ? colors.cream : colors.forest }]}
          >
            {o.label}
          </RNText>
        </Pressable>
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
  return <View style={[styles.card, cardTones[tone], style]}>{children}</View>;
}

export function Field({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <RNText style={[styles.fieldLabel]}>{label}</RNText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, !!error && { borderColor: colors.danger }]}
        {...input}
      />
      {error ? (
        <RNText style={[styles.caption, { color: colors.danger }]}>{error}</RNText>
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
  min = 0,
  max = 30,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.stepper}>
      <RNText style={[styles.body, { flex: 1, fontFamily: fontFor("600") }]}>{label}</RNText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Kurangi ${label}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={styles.stepButton}
      >
        <RNText style={styles.stepGlyph}>−</RNText>
      </Pressable>
      <RNText style={[styles.body, { width: 24, textAlign: "center", fontFamily: fontFor("800") }]}>
        {value}
      </RNText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Tambah ${label}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={styles.stepButton}
      >
        <RNText style={styles.stepGlyph}>+</RNText>
      </Pressable>
    </View>
  );
}

/** Bottom sheet for short decisions (share, exceptions). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Tutup" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <Text variant="heading">{title}</Text>
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
  const body = <View style={styles.screenBody}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>{body}</ScrollView> : body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const cardTones = StyleSheet.create({
  surface: { backgroundColor: colors.surface, borderColor: colors.line },
  attention: { backgroundColor: colors.cream, borderColor: "#F3DFC3" },
  brand: { backgroundColor: colors.forest, borderColor: colors.forest },
  sage: { backgroundColor: colors.sage, borderColor: colors.sage },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.forest },
  secondary: { borderWidth: 1, borderColor: "#CDD4C4", backgroundColor: "transparent" },
  textButton: { minHeight: 44, paddingHorizontal: 4, backgroundColor: "transparent" },
  disabled: { backgroundColor: "#CFD3C6" },
  buttonLabel: { fontFamily: fontFor("700"), fontSize: 15 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center" },
  chipOn: { backgroundColor: colors.forest },
  chipOff: { borderWidth: 1, borderColor: "#CDD4C4" },
  chipLabel: { fontFamily: fontFor("700"), fontSize: 13 },
  segmented: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 10,
    backgroundColor: colors.sage,
  },
  segment: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.forest },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  fieldLabel: { fontFamily: fontFor("700"), fontSize: 13, color: colors.forest },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#CFD3C6",
    borderRadius: 9,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: FONT,
    fontSize: 15,
    color: colors.charcoal,
  },
  caption: { fontFamily: FONT, fontSize: 12, color: colors.muted },
  body: { fontFamily: FONT, fontSize: 15, color: colors.charcoal },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 52,
  },
  stepButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepGlyph: { fontSize: 22, color: colors.forest },
  scrim: { flex: 1, backgroundColor: "rgba(20,30,25,0.45)" },
  sheet: {
    backgroundColor: colors.surface,
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
    backgroundColor: "#CFD3C6",
  },
  screen: { flex: 1, backgroundColor: colors.canvas },
  screenBody: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  footer: {
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    gap: 8,
  },
});
