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

const TRACK_PADDING = 3;

type Tab = { x: number; width: number };

/**
 * The Siang / Malam switch: a two-tab tablist on a pill track, with the active pill sliding to the chosen tab.
 * Reads and writes the app's mood; the labels come from the provider.
 */
export function MoodToggle() {
  const { mood, setMood } = useMood();
  const labels = useMoodLabels();
  const palette = useMoodColors();
  const { progress, target, reduced } = useMoodProgress(nativeMotion.selection);
  const [tabs, setTabs] = useState<[Tab, Tab]>([
    { x: 0, width: 0 },
    { x: 0, width: 0 },
  ]);
  const measure = (index: 0 | 1) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabs((prev) => (prev[index].x === x && prev[index].width === width ? prev : index === 0 ? [{ x, width }, prev[1]] : [prev[0], { x, width }]));
  };

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: tabs[0].x + progress.value * (tabs[1].x - tabs[0].x) }],
  }));
  const rest = { transform: [{ translateX: tabs[0].x + target * (tabs[1].x - tabs[0].x) }] };

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
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: TRACK_PADDING,
            bottom: TRACK_PADDING,
            left: 0,
            width: Math.max(tabs[0].width, tabs[1].width),
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
            onLayout={measure(index as 0 | 1)}
            onPress={() => setMood(option.value)}
            style={{
              minHeight: 48,
              minWidth: 84,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: 999,
            }}
          >
            <Ionicons name={option.icon} size={14} color={ink} />
            <RNText style={{ fontFamily: fontFor("700"), fontSize: 13, color: ink }}>{labels[option.value]}</RNText>
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
      />
      {/* Below the toggle row, so the lunchboxes show beside the headline instead of hiding behind the toggle. */}
      <MalamPattern top={(topOwned ? 0 : insets.top) + 12 + 54 + 4} />
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
