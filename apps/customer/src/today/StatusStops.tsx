import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { PressableScale, Text, useColors, useMood, useMoodColors } from "@catera/mobile-ui";
import type { Mood } from "@catera/design-tokens";

/**
 * One end of the status line. `window` is the delivery window of the meal's one plate ("11.00–13.00"), or null when the
 * meal has none or several; `state` is the meta line under the label ("Sedang diantar", the dish, "Tidak ada").
 * `status` is where the meal is in the day: `now` (being cooked, on its way, due), `next` (still to come), `done`
 * (arrived, or its report sent) or `none` (no delivery).
 */
export type StopInfo = { window: string | null; state: string; status: "now" | "next" | "none" | "done" };

/** The dot, its halo (4 each side) and the track's thickness, in dp. */
const DOT = 12;
const HALO = DOT + 8;
const TRACK = 2;
/** The strip of dots and track, the `bodyStrong` label line and the `meta` state line of one stop at font scale 1.0. */
export const STATUS_STRIP = HALO;
export const STATUS_LABEL_LINE = 22;
export const STATUS_META_LINE = 18;
export const STATUS_HEIGHT = STATUS_STRIP + STATUS_LABEL_LINE + STATUS_META_LINE;

const STOPS = [
  { mood: "siang", id: "lunch" },
  { mood: "malam", id: "dinner" },
] as const satisfies readonly { mood: Mood; id: string }[];

/**
 * Beranda's two-stop status line: Siang and Malam on one row, joined by a 2dp track. Each stop is a dot over a
 * `bodyStrong` label ("Siang 11.00–13.00") and a `meta` state line, and a 44+ target. It is the app-wide Siang/Malam
 * switch, the same as the day arc it replaces: a `tablist` of two `tab`s whose selected one is the chosen mood, and a
 * press calls `useMood().setMood`. The dot says where the meal is (`now` the current stop colour with a 4dp halo, `next`
 * an ink ring, `none` a `controlRing` ring, `done` a filled muted dot); the chosen stop's label is the full ink.
 * `onHero` reads the hero card's inks (it sits in the hero's body); otherwise the theme's (on the canvas).
 */
export function StatusStops({ lunch, dinner, onHero = false }: { lunch: StopInfo; dinner: StopInfo; onHero?: boolean }) {
  const { t } = useMobile();
  const { mood, setMood } = useMood();
  const c = useColors();
  const palette = useMoodColors();
  const ink = onHero ? palette.heroText : c.charcoal;
  const quiet = onHero ? palette.heroMeta : c.muted;
  const track = onHero ? palette.arcTrack : c.line;
  const info = { lunch, dinner };
  const names = {
    lunch: { title: t("Siang", "Lunch"), label: t("Makan siang", "Lunch") },
    dinner: { title: t("Malam", "Dinner"), label: t("Makan malam", "Dinner") },
  };

  const dot = (id: string, status: StopInfo["status"]) => {
    const style =
      status === "now"
        ? { backgroundColor: palette.stopActive }
        : status === "done"
          ? { backgroundColor: quiet }
          : { borderWidth: 1.5, borderColor: status === "next" ? ink : c.controlRing };
    const circle = <View testID={`status-stop-${id}-dot`} style={[{ width: DOT, height: DOT, borderRadius: DOT / 2 }, style]} />;
    const box = { width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: "center", justifyContent: "center" } as const;
    return status === "now" ? (
      <View testID={`status-stop-${id}-halo`} style={[box, { backgroundColor: `${palette.stopActive}33` }]}>
        {circle}
      </View>
    ) : (
      <View style={box}>{circle}</View>
    );
  };

  return (
    <View testID="status-stops" accessibilityRole="tablist" style={{ flexDirection: "row" }}>
      {STOPS.map(({ mood: value, id }) => {
        const stop = info[id];
        const active = value === mood;
        const name = names[id];
        const title = stop.window ? `${name.title} ${stop.window}` : name.title;
        return (
          <PressableScale
            key={id}
            testID={`status-stop-${id}`}
            accessibilityRole="tab"
            accessibilityLabel={`${name.label}, ${stop.window ? `${stop.window}, ` : ""}${stop.state}`}
            accessibilityState={{ selected: active }}
            // The stop that is already chosen has nothing to confirm: no haptic and no press feedback.
            haptic={active ? "none" : "select"}
            pressFeedback={!active}
            onPress={() => setMood(value)}
            style={{ flex: 1, minHeight: nativeLayout.control.icon }}
          >
            <View style={{ height: STATUS_STRIP, flexDirection: "row", alignItems: "center" }}>
              {dot(id, stop.status)}
              {id === "lunch" ? (
                <View
                  testID="status-stops-track"
                  style={{ flex: 1, height: TRACK, marginHorizontal: nativeLayout.space.xs, borderRadius: TRACK / 2, backgroundColor: track }}
                />
              ) : null}
            </View>
            <View style={{ paddingRight: nativeLayout.space.sm }}>
              <Text variant="bodyStrong" style={{ color: active ? ink : quiet, fontVariant: ["tabular-nums"] }}>
                {title}
              </Text>
              <Text variant="meta" style={{ color: quiet, fontVariant: ["tabular-nums"] }}>
                {stop.state}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
