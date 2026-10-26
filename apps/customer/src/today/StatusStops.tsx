import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import {
  fontFor,
  PressableScale,
  Skeleton,
  Text,
  useColors,
  useMood,
  useMoodColors,
  useStackedLayout,
} from "@catera/mobile-ui";
import type { Mood } from "@catera/design-tokens";
import { useChoiceFade } from "../selectionRing";

/**
 * One end of the status line. `window` is the delivery window of the meal's one plate ("11.00–13.00"), or null when the
 * meal has none or several; `state` is the meta line under the label ("Sedang diantar", the dish, "Tidak ada").
 */
export type StopInfo = { window: string | null; state: string };

/** The sun or moon marker: its circle, the glyph in it and the idle ring's stroke, in dp. */
export const STATUS_MARKER = 36;
const GLYPH = 18;
const MARKER_RING = 1.5;
const TRACK = 2;
/** A stop's two lines at font scale 1.0: the `bodyStrong` label (22) over the `meta` state line (18) make the 40 row. */
export const STATUS_LABEL_LINE = 22;
export const STATUS_META_LINE = 18;
export const STATUS_ROW = STATUS_LABEL_LINE + STATUS_META_LINE;
/**
 * Under this effective width (`width / fontScale`) the two stops stack, one under the other at full width, with no track:
 * side by side they broke words ("2 pengant-aran", "17.0-0–19.00") on a 360dp phone at font scale 1.3 (277). At 412dp and
 * 1.3 (317) each label still wraps between the meal and its window.
 */
export const STOPS_STACK_BELOW = 300;
/** Each stop is 40 tall and reaches 44 through its hit area. */
const HIT_SLOP = {
  top: (nativeLayout.control.icon - STATUS_ROW) / 2,
  bottom: (nativeLayout.control.icon - STATUS_ROW) / 2,
};

const STOPS = [
  { mood: "siang", id: "lunch", icon: "sunny" },
  { mood: "malam", id: "dinner", icon: "moon" },
] as const satisfies readonly { mood: Mood; id: string; icon: string }[];

const circle = {
  width: STATUS_MARKER,
  height: STATUS_MARKER,
  borderRadius: STATUS_MARKER / 2,
  alignItems: "center",
  justifyContent: "center",
} as const;

/**
 * A stop's marker, the sun or the moon of the day arc it replaces: both wear the `markerIdle` ring and glyph, and the
 * chosen one is covered by the filled `markerActive` disc with its glyph in `onToggleActive`, which fades in over
 * `control` when its meal is chosen and out when it is not (at once under reduced motion). It is drawing only: the tab
 * says selected.
 */
function Marker({ id, icon, active }: { id: string; icon: (typeof STOPS)[number]["icon"]; active: boolean }) {
  const palette = useMoodColors();
  const fade = useChoiceFade(active);
  return (
    <View
      testID={`status-stop-${id}-marker`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: STATUS_MARKER, height: STATUS_MARKER }}
    >
      <View testID={`status-stop-${id}-ring`} style={[circle, { borderWidth: MARKER_RING, borderColor: palette.markerIdle }]}>
        <Ionicons name={icon} size={GLYPH} color={palette.markerIdle} />
      </View>
      <Animated.View
        testID={`status-stop-${id}-disc`}
        style={[StyleSheet.absoluteFill, circle, { backgroundColor: palette.markerActive }, fade]}
      >
        <Ionicons name={icon} size={GLYPH} color={palette.onToggleActive} />
      </Animated.View>
    </View>
  );
}

/**
 * Beranda's two-stop status line, set on the mood band directly under the day statement: one 40 tall row, a stop at each
 * end and the 2dp `heroEdge` track between them. A stop is the sun or moon marker beside a two-line block, the
 * `bodyStrong` label ("Siang 11.00–13.00") over the `meta` state line, 8 apart, and a 44 tall target. It is the app-wide
 * Siang/Malam switch, the same as the day arc it replaces: a `tablist` of two `tab`s whose selected one is the chosen
 * mood, and a press calls `useMood().setMood`. The chosen meal shows three ways: its marker is the filled disc, its
 * label is forest and 700 (the other is ink and 600), and the tab says selected. Where each meal is in its day is the
 * state line's to say. It sits on the band, so it reads the band's inks (`headerText`, `headerMeta`).
 */
export function StatusStops({ lunch, dinner }: { lunch: StopInfo; dinner: StopInfo }) {
  const { t } = useMobile();
  const { mood, setMood } = useMood();
  const c = useColors();
  const palette = useMoodColors();
  const stacked = useStackedLayout(STOPS_STACK_BELOW);
  const ink = palette.headerText;
  const quiet = palette.headerMeta;
  const info = { lunch, dinner };
  const names = {
    lunch: { title: t("Siang", "Lunch"), label: t("Makan siang", "Lunch") },
    dinner: { title: t("Malam", "Dinner"), label: t("Makan malam", "Dinner") },
  };

  const stop = ({ mood: value, id, icon }: (typeof STOPS)[number]) => {
    const stopInfo = info[id];
    const active = value === mood;
    const name = names[id];
    const title = stopInfo.window ? `${name.title} ${stopInfo.window}` : name.title;
    return (
      <PressableScale
        key={id}
        testID={`status-stop-${id}`}
        accessibilityRole="tab"
        accessibilityLabel={`${name.label}, ${stopInfo.window ? `${stopInfo.window}, ` : ""}${stopInfo.state}`}
        accessibilityState={{ selected: active }}
        // The stop that is already chosen has nothing to confirm: no haptic and no press feedback.
        haptic={active ? "none" : "select"}
        pressFeedback={!active}
        hitSlop={HIT_SLOP}
        onPress={() => setMood(value)}
        style={{ flexShrink: 1, minHeight: STATUS_ROW, flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm }}
      >
        <Marker id={id} icon={icon} active={active} />
        <View style={{ flexShrink: 1 }}>
          <Text
            testID={`status-stop-${id}-label`}
            variant="bodyStrong"
            style={{
              // forest: selection (the shown meal's stop)
              color: active ? c.forest : ink,
              fontFamily: fontFor(active ? "700" : "600"),
              fontVariant: ["tabular-nums"],
            }}
          >
            {title}
          </Text>
          <Text variant="meta" style={{ color: quiet, fontVariant: ["tabular-nums"] }}>
            {stopInfo.state}
          </Text>
        </View>
      </PressableScale>
    );
  };

  return (
    <View
      testID="status-stops"
      accessibilityRole="tablist"
      style={
        stacked
          ? { alignItems: "flex-start", gap: nativeLayout.space.sm }
          : { flexDirection: "row", alignItems: "center", minHeight: STATUS_ROW }
      }
    >
      {stop(STOPS[0])}
      {stacked ? null : (
        <View
          testID="status-stops-track"
          style={{
            flex: 1,
            minWidth: nativeLayout.space.md,
            height: TRACK,
            marginHorizontal: nativeLayout.space.sm,
            borderRadius: TRACK / 2,
            backgroundColor: palette.heroEdge,
          }}
        />
      )}
      {stop(STOPS[1])}
    </View>
  );
}

/**
 * The status line while the first read is out, on the band: the same 40 row with two stops of a marker's circle beside
 * a label line over a state line, so the band keeps its height when the page lands. The blocks read the band's track
 * (`onMood`).
 */
export function StatusStopsPlaceholder() {
  const stop = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm, width: "36%" }}>
      <Skeleton onMood width={STATUS_MARKER} height={STATUS_MARKER} radius={STATUS_MARKER / 2} />
      <View style={{ flex: 1 }}>
        <View style={{ height: STATUS_LABEL_LINE, justifyContent: "center" }}>
          <Skeleton onMood width="86%" height={14} />
        </View>
        <View style={{ height: STATUS_META_LINE, justifyContent: "center" }}>
          <Skeleton onMood width="60%" height={12} />
        </View>
      </View>
    </View>
  );
  return (
    <View
      testID="status-stops-placeholder"
      style={{ height: STATUS_ROW, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
    >
      {stop}
      {stop}
    </View>
  );
}
