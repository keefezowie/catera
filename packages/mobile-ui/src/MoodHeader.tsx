import { use, useState, type ReactNode } from "react";
import { Text as RNText, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeLayout, nativeMotion } from "@catera/design-tokens";
import { MoodArc, type MoodArcProps } from "./brand/MoodArc";
import { DEMO_STRIP_HEIGHT } from "./DemoStrip";
import { useMoodProgress } from "./brand/useMoodProgress";
import { Text } from "./components";
import { useLayoutScale, useScreenMargin } from "./layoutScale";
import { MoodFill } from "./MoodFill";
import { statusBarStyle, useMood, useMoodColors, useMoodLabels } from "./mood";
import { PressableScale } from "./motion";
import { ScreenStatusBar } from "./ScreenStatusBar";
import { moodHeaderTopInset, ScreenHeaderContext } from "./screenInsets";
import { useColors, useThemePreference } from "./theme";
import { useToastAnchor } from "./toastAnchor";
import { useTopInsetOwned } from "./TopInset";
import { fontFor } from "./type";

export { StatusBand } from "./StatusBand";

/** The header's top row, the same on every screen so the headline starts at one height: 48, or 44 under the v2 layout scale. */
const ROW_HEIGHT = 48;
/** The band's top row: one date line, or two when a large font wraps it. */
const BAND_ROW_HEIGHT = 36;
const BAND_GAP = 4;
const TRACK_PADDING = 3;
/** The track's edge (`markerIdle`, 3:1 off the header): the white track is 1.0x off a pale header, so the edge is its boundary. */
const TRACK_EDGE = 1.5;
const TRACK_INNER = TRACK_PADDING - TRACK_EDGE;
const TAB_MIN_WIDTH = 84;
const TAB_PADDING = 12;

/**
 * The Siang / Malam switch: a two-tab tablist on a pill track, with the active pill sliding to the chosen tab.
 * Reads and writes the app's mood; the labels come from `MoodLabelsProvider`. Both tabs are as wide as the wider label, so the
 * pill is the same size on either one and never overhangs the narrower tab.
 */
export function MoodToggle() {
  const { mood, setMood } = useMood();
  const labels = useMoodLabels();
  const palette = useMoodColors();
  const { progress, target, reduced } = useMoodProgress(nativeMotion.selection);
  // The natural width of each tab's icon and label, measured inside the tab (the tab itself is sized from these).
  const [content, setContent] = useState<[number, number]>([0, 0]);
  const measure = (index: 0 | 1) => (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setContent((prev) => {
      if (prev[index] === width) return prev;
      return index === 0 ? [width, prev[1]] : [prev[0], width];
    });
  };
  const tabWidth = Math.max(TAB_MIN_WIDTH, Math.max(content[0], content[1]) + TAB_PADDING * 2);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * tabWidth }] }));
  const rest = { transform: [{ translateX: target * tabWidth }] };

  const options = [
    { value: "siang", icon: "sunny" },
    { value: "malam", icon: "moon" },
  ] as const;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        padding: TRACK_INNER,
        borderRadius: 999,
        backgroundColor: palette.toggleTrack,
        borderWidth: TRACK_EDGE,
        borderColor: palette.markerIdle,
      }}
    >
      <Animated.View
        testID="mood-toggle-pill"
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: TRACK_INNER,
            bottom: TRACK_INNER,
            left: TRACK_INNER,
            width: tabWidth,
            borderRadius: 999,
            // The selected segment is a pill in the card colour with a forest ring and label (direction K).
            backgroundColor: palette.onToggleActive,
            borderWidth: 2,
            borderColor: palette.toggleActive,
          },
          reduced ? rest : slide,
        ]}
      />
      {options.map((option, index) => {
        const active = option.value === mood;
        const ink = active ? palette.toggleActive : palette.headerMeta;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={labels[option.value]}
            accessibilityState={{ selected: active }}
            // The tab that is already chosen has nothing to confirm.
            haptic={active ? "none" : "select"}
            onPress={() => setMood(option.value)}
            style={{
              minHeight: 48,
              width: tabWidth,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
            }}
          >
            <View
              testID={`mood-tab-content-${option.value}`}
              onLayout={measure(index as 0 | 1)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name={option.icon} size={14} color={ink} />
              <RNText style={{ fontFamily: fontFor("700"), fontSize: 13, color: ink }}>{labels[option.value]}</RNText>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const isText = (node: ReactNode): node is string | number => typeof node === "string" || typeof node === "number";

/**
 * The rounded block that opens a screen. It paints under the status bar and pays that inset itself (unless the demo
 * strip already does), and holds the meta line, the headline, an optional toggle and trailing control, an optional day
 * arc switch and anything else the screen puts in it. `overlap` leaves room at the bottom for a card that rides up
 * over it. Its fill is `MoodFill`: two stacked layers, Siang and Malam, and the Malam one fades in and out.
 * - A string `title` is set in the `title` variant (30/39), which holds a long, dynamic name at large font scales. A
 *   short fixed headline can opt into `titleVariant="display"` (34/40).
 * - The top row is 48dp on every screen, whether it holds the meta line, a trailing control, the toggle or nothing,
 *   so switching tabs never moves the headline. The toggle's 48dp tabs ride on a 3dp track that overhangs the row
 *   evenly above and below. The meta line carries a fact (a date, the area), never the tab's own name. With both a
 *   toggle and a trailing control, the toggle comes first and the trailing control (Dapur's settings gear for a helper
 *   on Menu) sits at the end.
 * - Under the v2 layout scale the top row is 44 (`nativeLayout.control.icon`), the icon button size; classic keeps 48.
 * - `plain` is a header with no mood band: no fill, no rounded corners, the screen's canvas behind it, 8 above the row
 *   and nothing below (the screen body's own 16 follows), and its own meta text in the muted ink. The caller colours the
 *   controls it puts inside (Jelajah). The Screen draws a canvas status band for it (`Screen plainHeader`).
 * - `band` is the customer layout's compact band (v2): a 36 top row instead of 48 and 4 between its lines. `overlap` is then the height the card behind it rides up over the band (104 on Beranda).
 * - `arc` puts the day arc under the headline as the Siang / Malam switch (`MoodArc`, with each end's title and detail
 *   line). The arc is then the switch, so the toggle is not drawn in the top row even when `toggle` is set.
 * - While its screen is focused it sets the status-bar glyphs for the mood (`statusBarStyle`); once a pushed screen
 *   covers it, the app's default for the theme shows again.
 * - While its screen is focused it reports its bottom edge to the toast (`useToastAnchor`), so on a tab root the iOS
 *   toast sits under the headline and the toggle instead of over them. The edge is the space above the header (the
 *   demo strip, or on iOS the status bar the scroll view insets it below) plus its laid-out height.
 */
export function MoodHeader({
  meta,
  title,
  titleVariant = "title",
  trailing,
  toggle = false,
  arc,
  children,
  overlap = 0,
  band = false,
  plain = false,
  testID = "mood-header",
}: {
  meta?: ReactNode;
  title: ReactNode;
  titleVariant?: "title" | "display";
  trailing?: ReactNode;
  toggle?: boolean;
  arc?: MoodArcProps;
  children?: ReactNode;
  /** How far a card rides up over the bottom of the header: 58 (the classic hero), 104 (the v2 band) or none. */
  overlap?: number;
  /** The compact band of the customer layout scale. */
  band?: boolean;
  /** No mood fill or rounded band: the header sits on the canvas (v2 Jelajah). */
  plain?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const topOwned = useTopInsetOwned();
  const margin = useScreenMargin();
  const inScreenHeader = use(ScreenHeaderContext);
  const topInset = moodHeaderTopInset({ top: insets.top, topOwned, inScreenHeader });
  const palette = useMoodColors();
  const canvasInk = useColors();
  const v2 = useLayoutScale() === "v2";
  const { mood } = useMood();
  const { scheme } = useThemePreference();
  const radius = overlap > 0 ? 32 : 28;
  const rowHeight = band ? BAND_ROW_HEIGHT : v2 ? nativeLayout.control.icon : ROW_HEIGHT;
  const [height, setHeight] = useState<number>();
  const above = topOwned ? insets.top + DEMO_STRIP_HEIGHT : insets.top - topInset;
  useToastAnchor(height === undefined ? null : { top: above + height });

  return (
    <View
      testID={testID}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={
        plain
          ? { paddingTop: topInset + 8 }
          : {
              overflow: "hidden",
              paddingTop: topInset + 12,
              paddingBottom: 16 + overlap,
              borderBottomLeftRadius: radius,
              borderBottomRightRadius: radius,
              borderCurve: "continuous",
            }
      }
    >
      <ScreenStatusBar style={statusBarStyle({ scheme, mood, demo: topOwned })} />
      {plain ? null : <MoodFill surface="header" testID="mood-fill" />}
      <View
        testID="mood-header-content"
        style={{
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
          paddingHorizontal: margin,
          gap: band ? BAND_GAP : plain ? nativeLayout.space.sm : 12,
        }}
      >
        <View testID="mood-header-row" style={{ minHeight: rowHeight, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            {isText(meta) ? (
              <Text variant="label" style={{ color: plain ? canvasInk.muted : palette.headerMeta, lineHeight: 18 }}>
                {meta}
              </Text>
            ) : (
              meta
            )}
          </View>
          {toggle && !arc ? (
            <View style={{ flexShrink: 0, marginVertical: -TRACK_PADDING }}>
              <MoodToggle />
            </View>
          ) : null}
          {trailing != null ? <View style={{ flexShrink: 0 }}>{trailing}</View> : null}
        </View>
        {isText(title) ? (
          <Text variant={titleVariant} accessibilityRole="header" style={{ color: plain ? canvasInk.charcoal : palette.headerText }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {arc ? <MoodArc {...arc} /> : null}
        {children}
      </View>
    </View>
  );
}
