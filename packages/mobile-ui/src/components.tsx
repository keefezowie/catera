import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  type AccessibilityRole,
  ActivityIndicator,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
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
import type { PaletteKey } from "@catera/design-tokens";
import { PressableScale } from "./motion";
import { StatusBand } from "./StatusBand";
import { themedStyles, useColors } from "./theme";
import { useScreenNavigation, useStackHeaderHeight, useUnderStackHeader } from "./navigation";
import { ScreenHeaderContext, screenInsetBehavior } from "./screenInsets";
import { useScreenBottomEdge, useToastAnchor } from "./toastAnchor";
import { useTopInsetOwned } from "./TopInset";
import { fontFor, fonts } from "./type";

/** The regular-weight family for Plus Jakarta Sans; other weights come from `fonts` / `fontFor`. */
export const FONT = fonts.regular;

const textVariants = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1 },
  title: { fontSize: 30, lineHeight: 39, fontWeight: "700", letterSpacing: -0.8 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4 },
  /** An outcome's one heading, under its art (the success beat): between heading and title, so a long title wraps. */
  outcome: { fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.6 },
  body: { fontSize: 14, lineHeight: 23, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 23, fontWeight: "700" },
  caption: { fontSize: 11, lineHeight: 18, fontWeight: "400" },
  number: { fontSize: 40, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

/**
 * Which palette entry each variant reads; the palette is the active theme's. Direction K (spec 2.1 rules 1 to 3): forest
 * fills the primary button and marks selection, so headings, titles, labels and counts are charcoal ink.
 */
const variantColor: Record<keyof typeof textVariants, PaletteKey> = {
  display: "charcoal",
  title: "charcoal",
  heading: "charcoal",
  outcome: "charcoal",
  body: "charcoal",
  label: "charcoal",
  caption: "muted",
  number: "charcoal",
};

/** The variants a screen reader hears as headings. */
const headerVariants: ReadonlySet<keyof typeof textVariants> = new Set(["title", "heading", "outcome"]);

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
  /** With `numberOfLines`, shrinks the text (down to `minimumFontScale`) instead of cutting it. */
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
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
      accessibilityRole={accessibilityRole ?? (headerVariants.has(variant) ? "header" : undefined)}
      {...rest}
    >
      {children}
    </RNText>
  );
}

/** How long a button waits before it shows its spinner: an answer faster than this never flashes one. */
export const BUSY_DELAY_MS = 150;

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
  accessibilityLabel,
  accessibilityHint,
  ink,
  edge,
  style,
  spinnerTestID = "button-spinner",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  disabled?: boolean;
  /**
   * An action is waiting on the API. After `BUSY_DELAY_MS` the label gives way to a spinner in the label colour; the
   * button keeps its width and height (the label stays in the layout, unseen), ignores presses, and keeps the label
   * as its accessible name. The spinner is a wait, not decoration, so reduced motion keeps it.
   */
  busy?: boolean;
  accessibilityLabel?: string;
  /** What a screen reader adds after the label, such as why a disabled button waits. */
  accessibilityHint?: string;
  /** The label colour, for a button on a surface the theme does not own (the Malam hero is dark in both themes). */
  ink?: string;
  /** The border colour of a secondary button, for the same reason. */
  edge?: string;
  style?: StyleProp<ViewStyle>;
  spinnerTestID?: string;
}) {
  const primary = variant === "primary";
  const c = useColors();
  const styles = useStyles();
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!busy) {
      setSpinning(false);
      return;
    }
    const timer = setTimeout(() => setSpinning(true), BUSY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [busy]);
  const labelColor = ink ?? (primary ? (disabled ? c.muted : c.cream) : c.forest);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy }}
      disabled={disabled || busy}
      haptic={disabled || busy ? "none" : "tap"}
      onPress={() => {
        if (!busy) onPress();
      }}
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
      <RNText style={[styles.buttonLabel, { color: labelColor }, spinning && { opacity: 0 }]}>{label}</RNText>
      {spinning ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator testID={spinnerTestID} color={labelColor} />
        </View>
      ) : null}
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
      <RNText style={[styles.chipLabel, { color: selected ? c.cream : c.charcoal }]}>
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
            style={[styles.chipLabel, { color: o.value === value ? c.cream : c.charcoal }]}
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
  /** No forest tone: direction K never fills a card in forest (rules 1, 2 and 6). */
  tone?: "surface" | "attention" | "sage";
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
  onScroll,
  refreshControl,
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
  /**
   * The page starts under a transparent header (a photo header), so iOS must not inset it below the bar. That screen
   * owns its bar while it scrolls (through `onScroll`), so the Android scrolled tone stays off.
   */
  bleed?: boolean;
  /** The scroll view's own events, for a screen whose header follows its content (Paket's photo). */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Pull to refresh on the page's scroll view (a `RefreshControl`); ignored when `scroll` is false. */
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const styles = useStyles();
  const palette = useColors();
  // The demo strip owns the status-bar inset while it is shown, so the screen must not add a second one. A stack
  // header above the screen pays it too.
  const topOwned = useTopInsetOwned();
  const underHeader = useUnderStackHeader();
  const navigation = useScreenNavigation();
  // The toast sits under the native header as it is right now (large or collapsed) and above the tab bar when the
  // screen is inside the tabs; a footer reports its own top (ScreenFooter). In an iOS sheet the header height is
  // measured inside the sheet, so `useToastAnchor` marks the anchor as a sheet and the toast goes to the bottom.
  const headerHeight = useStackHeaderHeight();
  const bottomEdge = useScreenBottomEdge();
  useToastAnchor({ top: underHeader && headerHeight ? headerHeight : undefined, bottom: bottomEdge });
  const ios = process.env.EXPO_OS === "ios";
  const contentTitle = !ios && nativeTitle ? nativeTitle : null;
  const lineEnd = useRef(NO_LINE);
  const [titleInBar, setTitleInBar] = useState(false);
  const inBar = useRef(false);
  useLayoutEffect(() => {
    if (!navigation) return;
    if (title !== undefined) navigation.setOptions({ title });
    else if (nativeTitle !== undefined)
      navigation.setOptions(ios ? { title: nativeTitle } : { headerTitle: titleInBar ? nativeTitle : "" });
  }, [navigation, title, nativeTitle, ios, titleInBar]);
  // Material's small top app bar takes the surface-container tone (the navigation bar's `tabBar`) once the page has
  // scrolled under it and goes back to the canvas at the top. iOS keeps its own large-title behaviour, and a screen
  // that owns its bar (`bleed`) decides for itself. The options change only when the page crosses the top.
  const tonal = !ios && underHeader && !bleed && scroll && !!navigation;
  const scrolledRef = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  const toned = useRef(false);
  useLayoutEffect(() => {
    if (!tonal || !navigation || (!scrolled && !toned.current)) return;
    toned.current = true;
    navigation.setOptions({ headerStyle: { backgroundColor: scrolled ? palette.tabBar : palette.canvas } });
  }, [tonal, navigation, scrolled, palette.tabBar, palette.canvas]);
  const handleScroll =
    contentTitle || tonal || onScroll
      ? (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          if (contentTitle && (y >= lineEnd.current) !== inBar.current) {
            inBar.current = y >= lineEnd.current;
            setTitleInBar(inBar.current);
          }
          if (tonal && (y > 0) !== scrolledRef.current) {
            scrolledRef.current = y > 0;
            setScrolled(scrolledRef.current);
          }
          onScroll?.(e);
        }
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
          // The first scroll view in the screen: iOS collapses the large title and minimizes the tab bar from it, and
          // insets it for the status bar and the floating tab bar, under a full-bleed header too (the header then pays
          // no top inset of its own on iOS, through ScreenHeaderContext). A photo header runs under the bar and opts out.
          <ScrollView
            testID="screen-scroll"
            contentInsetAdjustmentBehavior={screenInsetBehavior({ header: !!header, bleed })}
            automaticallyAdjustKeyboardInsets={ios}
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={handleScroll ? 16 : undefined}
            refreshControl={refreshControl}
          >
            {header ? <ScreenHeaderContext.Provider value>{header}</ScreenHeaderContext.Provider> : null}
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
        {footer ? <ScreenFooter>{footer}</ScreenFooter> : null}
      </KeyboardAvoidingView>
      {/* Last, so it paints above the scrolled page; the demo strip already covers the inset when it is shown. */}
      {header && !topOwned ? <StatusBand /> : null}
    </SafeAreaView>
  );
}

/**
 * A Screen's footer, under its scroll view. On iOS the floating tab bar inside a tab, or the home indicator above the
 * tabs, covers the screen's foot, so the footer adds the bottom safe area under its own padding and its surface runs
 * beneath the bar. Android adds nothing: inside the tabs NativeTabs already ends the screen above the navigation bar
 * (the edge would add 0), and above the tabs the edge would add the gesture bar's inset, which this change leaves as it
 * was. While its screen is focused it reports its top edge to the toast, so the Android snackbar sits above the
 * StickyAction instead of over it. `os` defaults to the running platform.
 */
export function ScreenFooter({ children, os = process.env.EXPO_OS }: { children: ReactNode; os?: string }) {
  const styles = useStyles();
  const bottomEdge = useScreenBottomEdge();
  const [height, setHeight] = useState<number>();
  useToastAnchor(height === undefined ? null : { bottom: bottomEdge + height });
  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);
  if (os === "ios")
    return (
      <SafeAreaView testID="screen-footer" edges={["bottom"]} style={styles.footer} onLayout={onLayout}>
        {children}
      </SafeAreaView>
    );
  return (
    <View testID="screen-footer" style={styles.footer} onLayout={onLayout}>
      {children}
    </View>
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
  // Direction K: a card stands off the page by its fill (1.33:1), so it draws no visible border.
  surface: { backgroundColor: c.surface, borderColor: c.surface },
  attention: { backgroundColor: c.cream, borderColor: c.attentionBorder },
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
  fieldLabel: { fontFamily: fontFor("700"), fontSize: 13, color: c.charcoal },
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
  stepGlyph: { fontSize: 22, color: c.forest }, // forest: action (the stepper's + and -)
  screen: { flex: 1, backgroundColor: c.canvas },
  keyboard: { flex: 1 },
  screenBody: { paddingHorizontal: 20, paddingTop: 16, gap: 16, maxWidth: 760, width: "100%", alignSelf: "center" },
  // Material 3 headline small; the bar's 56dp row already sits above it, so it starts close under the bar.
  nativeTitle: { paddingHorizontal: 20, paddingTop: 4, maxWidth: 760, width: "100%", alignSelf: "center" },
  nativeTitleText: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: 0, color: c.charcoal },
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
