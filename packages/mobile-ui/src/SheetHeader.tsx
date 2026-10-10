import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, ScrollView, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeMotion } from "@catera/design-tokens";
import { Text } from "./components";
import { HeaderIconButton } from "./HeaderIconButton";
import { useScreenNavigation } from "./navigation";
import { useColors } from "./theme";
import { useToastAnchor } from "./toastAnchor";
import { fonts } from "./type";

/** iOS reserves this much on each side of the centred title: the 44pt Close and its mirror. */
const IOS_SIDE = 44;

/**
 * Puts the screen reader on a sheet's title once the sheet has risen, so TalkBack and VoiceOver start on what the sheet
 * is, not on the page under it or the first button. It moves on the stack's `transitionEnd` (the sheet's own appear),
 * which cancels the fallback after the `feature` duration; outside a navigator only the fallback runs. Returns the ref
 * for the title text.
 */
export function useSheetTitleFocus() {
  const ref = useRef<RNText>(null);
  const navigation = useScreenNavigation();
  useEffect(() => {
    const focus = () => {
      if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus");
    };
    const timer = setTimeout(focus, nativeMotion.feature);
    // The sheet's own appear is the better moment: once it lands, the fallback timer has nothing left to do.
    const appeared = navigation?.addListener("transitionEnd" as never, (e: { data?: { closing?: boolean } }) => {
      if (e.data?.closing) return;
      clearTimeout(timer);
      focus();
    });
    return () => {
      clearTimeout(timer);
      appeared?.();
    };
  }, [navigation]);
  return ref;
}

/**
 * Android's Material drag handle (32×4 in a 36dp band), which react-native-screens does not draw. Hidden from screen
 * readers: back and a swipe down close the sheet.
 */
export function SheetHandle() {
  const palette = useColors();
  return (
    <View
      testID="sheet-handle-band"
      style={{ height: 36, alignItems: "center", justifyContent: "center" }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View testID="sheet-handle" style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: palette.fieldBorder }} />
    </View>
  );
}

/**
 * The scrolling content of a form sheet (`sheetOptions({ detents: "form" })`), under its `SheetHeader`. Keyboard: on
 * iOS the scroll view insets itself so the focused field stays above the keyboard (`automaticallyAdjustKeyboardInsets`);
 * on Android a two-detent sheet expands to its top detent while the keyboard is up (react-native-screens'
 * `SheetDelegate`), and the scroll view keeps taps on its buttons while it is up. The foot clears the home indicator or
 * the gesture bar. `os` defaults to the running platform.
 */
export function SheetBody({ children, os = process.env.EXPO_OS }: { children: ReactNode; os?: string }) {
  const insets = useSafeAreaInsets();
  const ios = os === "ios";
  return (
    <ScrollView
      testID="sheet-body"
      style={{ flex: 1 }}
      automaticallyAdjustKeyboardInsets={ios}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: ios ? 20 : 24, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 16 }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * The title row of a native sheet (`sheetOptions`), drawn by the sheet itself because its stack header is hidden.
 * - iOS: a 44pt Close at the leading edge (spoken `closeLabel`, "Tutup" by default) and the title 17 bold, centred,
 *   under the system grabber.
 * - Android: the Material drag handle (32×4 in a 36dp band) and the title 22 bold at the start edge, the M3 sheet title.
 *   There is no Close: back and a swipe down close the sheet.
 * `context` is an optional line under the title (the day, the package). Close calls `onClose`, else goes back.
 * The screen reader starts on the title (`useSheetTitleFocus`).
 * In a sheet it also tells the toast so (`useToastAnchor`), so on iOS a sheet without a `Screen` still shows its
 * toasts at the bottom. `os` defaults to the running platform.
 */
export function SheetHeader({
  title,
  context,
  onClose,
  closeLabel = "Tutup",
  os = process.env.EXPO_OS,
}: {
  title: string;
  context?: string;
  onClose?: () => void;
  /** The translated spoken name of Close; this package has no i18n. */
  closeLabel?: string;
  os?: string;
}) {
  const palette = useColors();
  const navigation = useScreenNavigation();
  const titleRef = useSheetTitleFocus();
  useToastAnchor({});
  const ios = os === "ios";
  const close = onClose ?? (() => navigation?.goBack());
  const contextLine = context ? (
    <Text selectable style={{ color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: ios ? "center" : "left" }}>
      {context}
    </Text>
  ) : null;

  if (ios)
    return (
      <View style={{ paddingTop: 12, paddingHorizontal: 8, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: IOS_SIDE }}>
          <HeaderIconButton icon="close" label={closeLabel} onPress={close} os="ios" />
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <RNText
              ref={titleRef}
              accessibilityRole="header"
              style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: palette.charcoal, textAlign: "center" }}
            >
              {title}
            </RNText>
          </View>
          <View style={{ width: IOS_SIDE }} />
        </View>
        {contextLine ? <View style={{ paddingHorizontal: IOS_SIDE + 4 }}>{contextLine}</View> : null}
      </View>
    );

  return (
    <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
      <SheetHandle />
      <RNText
        ref={titleRef}
        accessibilityRole="header"
        style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: palette.charcoal, textAlign: "left" }}
      >
        {title}
      </RNText>
      {contextLine}
    </View>
  );
}
