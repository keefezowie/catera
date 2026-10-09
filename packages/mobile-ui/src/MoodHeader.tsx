import { useState, type ReactNode } from "react";
import { StyleSheet, Text as RNText, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeMotion } from "@catera/design-tokens";
import { DayArc } from "./brand/DayArc";
import { MalamPattern } from "./brand/MalamPattern";
import { useMoodProgress } from "./brand/useMoodProgress";
import { Text } from "./components";
import { useMood, useMoodColors, useMoodLabels } from "./mood";
import { PressableScale } from "./motion";
import { useTopInsetOwned } from "./TopInset";
import { fontFor } from "./type";

export { StatusBand } from "./StatusBand";

const TRACK_PADDING = 3;
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
      style={{ flexDirection: "row", padding: TRACK_PADDING, borderRadius: 999, backgroundColor: palette.toggleTrack }}
    >
      <Animated.View
        testID="mood-toggle-pill"
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: TRACK_PADDING,
            bottom: TRACK_PADDING,
            left: TRACK_PADDING,
            width: tabWidth,
            borderRadius: 999,
            backgroundColor: palette.toggleActive,
          },
          reduced ? rest : slide,
        ]}
      />
      {options.map((option, index) => {
        const active = option.value === mood;
        const ink = active ? palette.onToggleActive : palette.headerMeta;
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
 * strip already does), and holds the meta line, the headline, an optional toggle or trailing control, an optional day
 * arc and anything else the screen puts in it. `overlap` leaves room at the bottom for a card that rides up over it.
 * Its fill is two stacked layers, Siang and Malam, and the Malam one fades in and out.
 */
export function MoodHeader({
  meta,
  title,
  trailing,
  toggle = false,
  arc = false,
  children,
  overlap = 0,
  testID = "mood-header",
}: {
  meta?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
  toggle?: boolean;
  arc?: boolean;
  children?: ReactNode;
  overlap?: 0 | 58;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const topOwned = useTopInsetOwned();
  const siang = useMoodColors("siang");
  const malam = useMoodColors("malam");
  const palette = useMoodColors();
  const { progress, target, reduced } = useMoodProgress(nativeMotion.content);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const radius = overlap === 58 ? 32 : 28;
  const hasRow = meta != null || toggle || trailing != null;

  return (
    <View
      testID={testID}
      style={{
        overflow: "hidden",
        paddingTop: (topOwned ? 0 : insets.top) + 12,
        paddingBottom: 16 + overlap,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
        borderCurve: "continuous",
      }}
    >
      <View
        testID="mood-fill-siang"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: siang.header }]}
      />
      <Animated.View
        testID="mood-fill-malam"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: malam.header }, reduced ? { opacity: target } : fade]}
      >
        {/* In the Malam layer, so the lunchboxes fade in and out with the fill instead of snapping. Below the toggle
            row, so they show beside the headline instead of hiding behind the toggle. */}
        <MalamPattern mood="malam" top={(topOwned ? 0 : insets.top) + 12 + 54 + 4} />
      </Animated.View>
      <View
        testID="mood-header-content"
        style={{ maxWidth: 760, width: "100%", alignSelf: "center", paddingHorizontal: 20, gap: 12 }}
      >
        {hasRow ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              {isText(meta) ? (
                <Text variant="label" style={{ color: palette.headerMeta, lineHeight: 18 }}>
                  {meta}
                </Text>
              ) : (
                meta
              )}
            </View>
            <View style={{ flexShrink: 0 }}>{toggle ? <MoodToggle /> : trailing}</View>
          </View>
        ) : null}
        {isText(title) ? (
          <Text variant="display" accessibilityRole="header" style={{ color: palette.headerText }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {arc ? <DayArc /> : null}
        {children}
      </View>
    </View>
  );
}
