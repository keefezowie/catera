import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { fontFor, PressableScale, Skeleton, Text, useMood, useMoodColors, useReduced } from "@catera/mobile-ui";
import type { Mood } from "@catera/design-tokens";

/**
 * One half of the switch. `window` is the delivery window of the meal's one plate ("11.00–13.00"), or null when the
 * meal has none or several; `state` is where that meal is today ("Sedang diantar", "2 pengantaran", "Tidak ada").
 */
export type StopInfo = { window: string | null; state: string };

/** The pill's height at font scale 1.0: the `bodyStrong` meal (22) over the `meta` line (18), 10 above and below. */
export const STATUS_PILL = 60;
const EDGE = 1.5;
/** The door's inset from the track. */
const GAP = 4;
const GLYPH = 18;
/** How far the sun sinks and the moon rises while the door crosses. */
const DRIFT = 3;
/** The door's spring: settles in about 350ms with a hint of overshoot. */
const DOOR_SPRING = { damping: 26, stiffness: 320, mass: 1 };

const STOPS = [
  { mood: "siang", id: "lunch", icon: "sunny" },
  { mood: "malam", id: "dinner", icon: "moon" },
] as const satisfies readonly { mood: Mood; id: string; icon: string }[];

type Stop = (typeof STOPS)[number];

/**
 * A half's content: the sun or moon, the meal in `bodyStrong` 700 over where it is today in `meta`. The state stays
 * on the switch so a meal that needs the customer (a lunch to confirm) shows while the other meal is chosen; the window
 * is in the tab's spoken name and on the hero. The glyph drifts with the door: the sun sinks as the door leaves Siang and the moon rises as it reaches Malam.
 */
function Half({
  stop,
  title,
  info,
  ink,
  quiet,
  door,
  lit,
}: {
  stop: Stop;
  title: string;
  info: StopInfo;
  ink: string;
  quiet: string;
  door: SharedValue<number>;
  lit?: boolean;
}) {
  const lunch = stop.id === "lunch";
  const drift = useAnimatedStyle(() =>
    lunch
      ? { transform: [{ translateY: door.value * DRIFT }], opacity: 1 - door.value * 0.35 }
      : { transform: [{ translateY: (1 - door.value) * DRIFT }], opacity: 0.65 + door.value * 0.35 },
  );
  return (
    <View style={styles.half}>
      <Animated.View style={drift}>
        <Ionicons name={stop.icon} size={GLYPH} color={ink} />
      </Animated.View>
      <View style={{ flexShrink: 1 }}>
        <Text testID={lit ? undefined : `status-stop-${stop.id}-label`} variant="bodyStrong" style={{ color: ink, fontFamily: fontFor("700") }}>
          {title}
        </Text>
        <Text variant="meta" style={{ color: quiet, fontVariant: ["tabular-nums"] }}>
          {info.state}
        </Text>
      </View>
    </View>
  );
}

/**
 * Beranda's Siang/Malam switch, on the mood band under the day statement: a pill with a sliding door. The track is the
 * card colour (`toggleTrack`) with the 1.5 `heroEdge`; the door is a `toggleActive` (forest) pill over the chosen half
 * that slides across on a spring when the meal changes. The door carries its own copy of both halves in
 * `onToggleActive`, held still while the door moves, so each label changes colour exactly where the door's edge passes.
 * It is a `tablist` of two `tab`s whose selected one is the chosen mood; a press calls `useMood().setMood`. Each tab is
 * spoken as its meal, window and state. Under reduced motion the door jumps.
 */
export function StatusStops({ lunch, dinner }: { lunch: StopInfo; dinner: StopInfo }) {
  const { t } = useMobile();
  const { mood, setMood } = useMood();
  const palette = useMoodColors();
  const reduced = useReduced();
  const [width, setWidth] = useState(0);
  const chosen = mood === "malam" ? 1 : 0;
  const door = useSharedValue(chosen);
  useEffect(() => {
    door.value = reduced ? chosen : withSpring(chosen, DOOR_SPRING);
  }, [chosen, reduced, door]);
  const info = { lunch, dinner };
  const names = {
    lunch: { title: t("Siang", "Lunch"), label: t("Makan siang", "Lunch") },
    dinner: { title: t("Malam", "Dinner"), label: t("Makan malam", "Dinner") },
  };
  // Inside the edges. The door is half of it less one gap, and travels its own width.
  const inner = Math.max(0, width - EDGE * 2);
  const doorWidth = inner / 2 - GAP;
  const doorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: door.value * doorWidth }] }));
  // The door's copy moves back as far as the door moves on, so it sits exactly over the track's copy.
  const litStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -GAP - door.value * doorWidth }] }));

  return (
    <View
      testID="status-stops"
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: palette.toggleTrack, borderColor: palette.heroEdge }]}
    >
      {STOPS.map((stop) => {
        const active = stop.mood === mood;
        const stopInfo = info[stop.id];
        const name = names[stop.id];
        return (
          <PressableScale
            key={stop.id}
            testID={`status-stop-${stop.id}`}
            accessibilityRole="tab"
            accessibilityLabel={`${name.label}, ${stopInfo.window ? `${stopInfo.window}, ` : ""}${stopInfo.state}`}
            accessibilityState={{ selected: active }}
            // The chosen half has nothing to confirm: no haptic. The door is the press feedback.
            haptic={active ? "none" : "select"}
            pressFeedback={false}
            onPress={() => setMood(stop.mood)}
            style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}
          >
            <Half stop={stop} title={name.title} info={stopInfo} ink={palette.heroText} quiet={palette.heroMeta} door={door} />
          </PressableScale>
        );
      })}
      {doorWidth > 0 ? (
        <Animated.View
          testID="status-stops-door"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.door, { width: doorWidth, backgroundColor: palette.toggleActive }, doorStyle]}
        >
          <Animated.View style={[styles.lit, { width: inner }, litStyle]}>
            {STOPS.map((stop) => (
              <Half
                key={stop.id}
                stop={stop}
                title={names[stop.id].title}
                info={info[stop.id]}
                ink={palette.onToggleActive}
                quiet={palette.onToggleActive}
                door={door}
                lit
              />
            ))}
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", minHeight: STATUS_PILL, borderRadius: 999, borderWidth: EDGE, borderCurve: "continuous" },
  half: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: nativeLayout.space.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  door: { position: "absolute", top: GAP, bottom: GAP, left: GAP, borderRadius: 999, borderCurve: "continuous", overflow: "hidden" },
  lit: { position: "absolute", top: -GAP, bottom: -GAP, left: 0, flexDirection: "row" },
});

/** The switch while the first read is out, on the band: the same pill, so the band keeps its height when the page lands. */
export function StatusStopsPlaceholder() {
  return (
    <View testID="status-stops-placeholder" style={{ height: STATUS_PILL }}>
      <Skeleton onMood width="100%" height={STATUS_PILL} radius={STATUS_PILL / 2} />
    </View>
  );
}
