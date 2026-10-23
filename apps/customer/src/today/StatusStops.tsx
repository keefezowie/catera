import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { fontFor, PressableScale, Skeleton, Text, useColors, useMood, useMoodColors, withAlpha } from "@catera/mobile-ui";
import type { Mood } from "@catera/design-tokens";
import type { StopStatus } from "./stopStatus";

/**
 * One end of the status line. `window` is the delivery window of the meal's one plate ("11.00–13.00"), or null when the
 * meal has none or several; `state` is the meta line under the label ("Sedang diantar", the dish, "Tidak ada").
 * `status` is where the meal is in the day (see `stopStatuses`).
 */
export type StopInfo = { window: string | null; state: string; status: StopStatus };

/** The dot, its halo (4 each side), the ring stroke and the track's thickness, in dp. */
const DOT = 12;
export const STATUS_HALO = DOT + 8;
const RING = 2;
const TRACK = 2;
/** A stop's two lines at font scale 1.0: the `bodyStrong` label (22) over the `meta` state line (18) make the 40 row. */
export const STATUS_LABEL_LINE = 22;
export const STATUS_META_LINE = 18;
export const STATUS_ROW = STATUS_LABEL_LINE + STATUS_META_LINE;
/** Each stop is 40 tall and reaches 44 through its hit area. */
const HIT_SLOP = {
  top: (nativeLayout.control.icon - STATUS_ROW) / 2,
  bottom: (nativeLayout.control.icon - STATUS_ROW) / 2,
};

const STOPS = [
  { mood: "siang", id: "lunch" },
  { mood: "malam", id: "dinner" },
] as const satisfies readonly { mood: Mood; id: string }[];

export { withAlpha };

/**
 * Beranda's two-stop status line, set on the mood band directly under the day statement: one 40 tall row, a stop at each end and the 2dp `heroEdge` track between them. A
 * stop is a dot beside a two-line block, the `bodyStrong` label ("Siang 11.00–13.00") over the `meta` state line, 8
 * apart, and a 44 tall target. It is the app-wide Siang/Malam switch, the same as the day arc it replaces: a `tablist`
 * of two `tab`s whose selected one is the chosen mood, and a press calls `useMood().setMood`. The shown meal's label is
 * forest and 700 (selection is not colour alone: it is also heavier, and the tab says selected); the other is ink and
 * 600. The dot says where the meal is: `now` a filled ink dot with a 4dp halo at 16% of the ink (the stop colour of the
 * tracker stays the tracker's own), `next` an ink ring, `none` a `controlRing` ring, `done` a filled muted dot.
 * It sits on the band, so it reads the band's inks (`headerText`, `headerMeta`).
 */
export function StatusStops({ lunch, dinner }: { lunch: StopInfo; dinner: StopInfo }) {
  const { t } = useMobile();
  const { mood, setMood } = useMood();
  const c = useColors();
  const palette = useMoodColors();
  const ink = palette.headerText;
  const quiet = palette.headerMeta;
  const info = { lunch, dinner };
  const names = {
    lunch: { title: t("Siang", "Lunch"), label: t("Makan siang", "Lunch") },
    dinner: { title: t("Malam", "Dinner"), label: t("Makan malam", "Dinner") },
  };

  const dot = (id: string, status: StopInfo["status"]) => {
    const style =
      status === "now"
        ? { backgroundColor: ink }
        : status === "done"
          ? { backgroundColor: quiet }
          : { borderWidth: RING, borderColor: status === "next" ? ink : c.controlRing };
    const circle = <View testID={`status-stop-${id}-dot`} style={[{ width: DOT, height: DOT, borderRadius: DOT / 2 }, style]} />;
    const box = { width: STATUS_HALO, height: STATUS_HALO, borderRadius: STATUS_HALO / 2, alignItems: "center", justifyContent: "center" } as const;
    return status === "now" ? (
      <View testID={`status-stop-${id}-halo`} style={[box, { backgroundColor: withAlpha(ink, 0.16) }]}>
        {circle}
      </View>
    ) : (
      <View style={box}>{circle}</View>
    );
  };

  const stop = (value: Mood, id: "lunch" | "dinner") => {
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
        {dot(id, stopInfo.status)}
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
    <View testID="status-stops" accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", minHeight: STATUS_ROW }}>
      {stop(STOPS[0].mood, STOPS[0].id)}
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
      {stop(STOPS[1].mood, STOPS[1].id)}
    </View>
  );
}

/**
 * The status line while the first read is out, on the band: the same 40 row with two stops of a dot's halo box beside
 * a label line over a state line, so the band keeps its height when the page lands. The blocks read the band's track
 * (`onMood`).
 */
export function StatusStopsPlaceholder() {
  const stop = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm, width: "36%" }}>
      <View style={{ width: STATUS_HALO, height: STATUS_HALO, alignItems: "center", justifyContent: "center" }}>
        <Skeleton onMood width={DOT} height={DOT} radius={DOT / 2} />
      </View>
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
