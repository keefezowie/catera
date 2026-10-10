import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  type AccessibilityRole,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { PaletteKey } from "@catera/design-tokens";
import { PressableScale, useReduced } from "./motion";
import { StatusBand } from "./StatusBand";
import { themedStyles, useColors } from "./theme";
import { useScreenNavigation, useUnderStackHeader } from "./navigation";
import { useTopInsetOwned } from "./TopInset";
import { fontFor, fonts } from "./type";

/** The regular-weight family for Plus Jakarta Sans; other weights come from `fonts` / `fontFor`. */
export const FONT = fonts.regular;

const textVariants = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1 },
  title: { fontSize: 30, lineHeight: 39, fontWeight: "700", letterSpacing: -0.8 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 23, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 23, fontWeight: "700" },
  caption: { fontSize: 11, lineHeight: 18, fontWeight: "400" },
  number: { fontSize: 40, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

/** Which palette entry each variant reads; the palette is the active theme's. */
const variantColor: Record<keyof typeof textVariants, PaletteKey> = {
  display: "forest",
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
  ink,
  edge,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  disabled?: boolean;
  accessibilityLabel?: string;
  /** The label colour, for a button on a surface the theme does not own (the Malam hero is dark in both themes). */
  ink?: string;
  /** The border colour of a secondary button, for the same reason. */
  edge?: string;
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
        variant === "secondary" && edge !== undefined && { borderColor: edge },
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
          { color: ink ?? (primary ? (disabled ? c.muted : c.cream) : c.forest) },
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
  style,
  ...input
}: { label: string; hint?: string; error?: string } & TextInputProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <RNText style={[styles.fieldLabel]}>{label}</RNText>
      {/* The caller's style extends the base input style; spreading it after would replace the fill, border and ink. */}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...input}
        style={[styles.input, !!error && { borderColor: c.danger }, style]}
      />
      {error ? (
        <RNText selectable style={[styles.caption, { color: c.danger }]}>
          {error}
        </RNText>
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

const SHEET_PADDING = 20;

/**
 * The height of the on-screen keyboard while it is up, or 0. The Sheet's Modal reaches under the system bars
 * (navigationBarTranslucent), and Android does not resize such a window for the keyboard, so the sheet reads the
 * keyboard itself. iOS announces the frame before it animates, so the sheet moves with it.
 */
function useKeyboardHeight(active: boolean): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!active) {
      setHeight(0);
      return;
    }
    const ios = process.env.EXPO_OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active]);
  return height;
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
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight(visible);
  // A sheet taller than the room left above the keyboard scrolls inside itself, so its title and its last button stay
  // reachable. It only becomes scrollable when it overflows: an inner list (a day picker) then keeps its own touches.
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const overflow = content > viewport + 1;
  return (
    // The modal window reaches under the status and gesture bars so the scrim covers them; without it the screen
    // behind shows through the gesture band as a bright strip. The sheet then pads its own bottom to clear that band.
    // Android refuses a translucent navigation bar without a translucent status bar, so both are set.
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduced ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <View style={styles.sheetRoot}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
        <View
          style={[
            styles.sheet,
            // With the keyboard up it covers the gesture band, so the sheet clears the keyboard instead of the inset.
            // The top margin keeps a full-height sheet below the status bar.
            { paddingBottom: SHEET_PADDING + (keyboard > 0 ? keyboard : insets.bottom), marginTop: insets.top + 8 },
          ]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <View style={styles.grabber} />
          {title ? <Text variant="heading">{title}</Text> : null}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={overflow}
            showsVerticalScrollIndicator={overflow}
            onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
            onContentSizeChange={(_w, h) => setContent(h)}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Where the Android content title ends, in scroll content coordinates, before it is laid out. */
const NO_LINE = Number.POSITIVE_INFINITY;

export function Screen({
  children,
  scroll = true,
  footer,
  header,
  nativeTitle,
  title,
  bleed = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  /**
   * A full-bleed header (MoodHeader). It paints under the status bar and pays the top inset itself, so the screen
   * drops its own top edge; it scrolls with the page, above the capped body.
   */
  header?: ReactNode;
  /**
   * The screen's name under a native stack header. iOS shows it as the large title that collapses into the bar. On
   * Android it is the first content line (headline small, 24/32, wraps), and the bar takes it once that line has
   * scrolled under the bar and clears it when the line comes back.
   */
  nativeTitle?: string;
  /** A bar title on both platforms, for a short name that needs no content line ("Senin 12 Okt"). */
  title?: string;
  /** The page starts under a transparent header (a photo header), so iOS must not inset it below the bar. */
  bleed?: boolean;
}) {
  const styles = useStyles();
  // The demo strip owns the status-bar inset while it is shown, so the screen must not add a second one. A stack
  // header above the screen pays it too.
  const topOwned = useTopInsetOwned();
  const underHeader = useUnderStackHeader();
  const navigation = useScreenNavigation();
  const ios = process.env.EXPO_OS === "ios";
  const contentTitle = !ios && nativeTitle ? nativeTitle : null;
  const lineEnd = useRef(NO_LINE);
  const [titleInBar, setTitleInBar] = useState(false);
  useLayoutEffect(() => {
    if (!navigation) return;
    if (title !== undefined) navigation.setOptions({ title });
    else if (nativeTitle !== undefined)
      navigation.setOptions(ios ? { title: nativeTitle } : { headerTitle: titleInBar ? nativeTitle : "" });
  }, [navigation, title, nativeTitle, ios, titleInBar]);
  const onScroll = contentTitle
    ? (e: NativeSyntheticEvent<NativeScrollEvent>) => setTitleInBar(e.nativeEvent.contentOffset.y >= lineEnd.current)
    : undefined;
  // On iOS the scroll view insets itself for the keyboard (automaticallyAdjustKeyboardInsets); the avoiding view only
  // lifts a footer, which sits outside the scroll view. It measures its frame relative to its parent while the
  // keyboard is positioned in the window, so the screen asks the OS where its own top edge really is.
  // iOS keyboard behaviour is not covered by jest or the Android emulator; it is unverified on a device.
  const frame = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const measureFrame = () => {
    if (!ios || !footer) return;
    frame.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setKeyboardOffset(Math.max(0, Math.round(y)));
    });
  };
  const lead = contentTitle ? (
    <View
      testID="screen-native-title"
      style={styles.nativeTitle}
      onLayout={(e) => {
        lineEnd.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
      }}
    >
      <Text variant="heading" style={styles.nativeTitleText}>
        {contentTitle}
      </Text>
    </View>
  ) : null;
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
      edges={topOwned || header || underHeader ? ["left", "right"] : ["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboard}
        enabled={ios && !!footer}
        behavior={ios ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        {scroll ? (
          // The first scroll view in the screen: iOS collapses the large title and minimizes the tab bar from it.
          <ScrollView
            testID="screen-scroll"
            contentInsetAdjustmentBehavior={bleed ? "never" : "automatic"}
            automaticallyAdjustKeyboardInsets={ios}
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={onScroll ? 16 : undefined}
          >
            {header}
            {lead}
            {body}
          </ScrollView>
        ) : (
          <>
            {header}
            {lead}
            {body}
          </>
        )}
        {footer ? (
          <View testID="screen-footer" style={styles.footer}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {/* Last, so it paints above the scrolled page; the demo strip already covers the inset when it is shown. */}
      {header && !topOwned ? <StatusBand /> : null}
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
  disabled: { backgroundColor: c.disabledFill },
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
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(20,30,25,0.45)" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SHEET_PADDING,
    paddingTop: 10,
    gap: 14,
    // The sheet gives up height before it leaves the window, and its body scrolls inside what is left.
    flexShrink: 1,
  },
  sheetBody: { flexShrink: 1 },
  sheetContent: { gap: 14 },
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
  // Material 3 headline small; the bar's 64dp row already sits above it, so it starts close under the bar.
  nativeTitle: { paddingHorizontal: 20, paddingTop: 4, maxWidth: 760, width: "100%", alignSelf: "center" },
  nativeTitleText: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: 0, color: c.forest },
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
