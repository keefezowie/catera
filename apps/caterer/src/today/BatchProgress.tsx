import { View } from "react-native";
import type { KitchenSession } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { StopGlyph, Text, useMoodColors } from "@catera/mobile-ui";
import { jakartaClock } from "./exceptions";

/** How far the whole batch has got: every active row, counted once by the stage it is in. */
export function batchCounts(session: KitchenSession): { total: number; cooking: number; out: number; arrived: number } {
  const c = session.counts;
  const total = Object.values(c).reduce((sum, n) => sum + n, 0);
  return { total, cooking: c.preparing, out: c.out_for_delivery, arrived: c.arrived + c.delivered };
}

/** The latest time any stop was marked Sampai, or null when none was. */
function lastArrival(session: KitchenSession): string | null {
  let best: string | null = null;
  let bestAt = 0;
  for (const stop of session.stops) {
    const at = stop.arrivedAt ? Date.parse(stop.arrivedAt) : Number.NaN;
    if (!Number.isNaN(at) && (best === null || at > bestAt)) {
      best = stop.arrivedAt;
      bestAt = at;
    }
  }
  return best;
}

const BAR = 8;
const DISC = 24;
const GLYPH = 16;
const GAP = 2;

/**
 * Hari ini's progress for the whole batch, under the figures: "{n} dari {total} sampai" with the newest time that
 * explains it, one bar of Sampai, Diantar and Dimasak segments (what is left is the scheduled remainder of the track)
 * and a legend of the same three counts. Delivery-ops tools count stops this way; a single track cannot say that
 * twelve are out while three still cook. Nothing is drawn while every row is scheduled: there is no progress to show.
 * The bar is one image for a screen reader, whose label carries the legend, so the legend is hidden from it.
 */
export function BatchProgress({ session }: { session: KitchenSession }) {
  const { t } = useMobile();
  const ink = useMoodColors();
  const { total, cooking, out, arrived } = batchCounts(session);
  if (!total || cooking + out + arrived === 0) return null;

  const { journey } = session;
  const clock = (iso: string | null) => (iso ? jakartaClock(iso) : null);
  const last = clock(lastArrival(session));
  const left = clock(journey.departedAt);
  const began = clock(journey.cookingAt);
  const meta = last
    ? t(`terakhir ${last}`, `last arrival ${last}`)
    : left
      ? t(`berangkat ${left}`, `left ${left}`)
      : began
        ? t(`mulai masak ${began}`, `started cooking ${began}`)
        : null;

  const parts = [
    { key: "arrived", n: arrived, color: ink.toggleActive, glyph: "house", label: t("Sampai", "Arrived") },
    { key: "out", n: out, color: ink.stopActive, glyph: "motorbike", label: t("Diantar", "On the way") },
    { key: "cooking", n: cooking, color: ink.heroMeta, glyph: "pot", label: t("Dimasak", "Cooking") },
  ] as const;

  return (
    <View testID="batch-progress" style={{ gap: 8 }}>
      <View
        testID="batch-progress-head"
        style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", columnGap: 12 }}
      >
        <Text selectable variant="label" style={{ color: ink.headerText, fontVariant: ["tabular-nums"] }}>
          {t(`${arrived} dari ${total} sampai`, `${arrived} of ${total} arrived`)}
        </Text>
        {meta ? (
          <Text selectable variant="caption" style={{ color: ink.headerMeta, fontVariant: ["tabular-nums"] }}>
            {meta}
          </Text>
        ) : null}
      </View>
      <View
        testID="batch-progress-bar"
        accessible
        accessibilityRole="image"
        accessibilityLabel={t(
          `${arrived} sampai, ${out} diantar, ${cooking} dimasak, dari ${total}`,
          `${arrived} arrived, ${out} on the way, ${cooking} cooking, of ${total}`,
        )}
      >
        <View
          testID="batch-progress-track"
          style={{ flexDirection: "row", gap: GAP, height: BAR, borderRadius: BAR / 2, overflow: "hidden", backgroundColor: ink.arcTrack }}
        >
          {parts.map((p) =>
            p.n > 0 ? (
              <View key={p.key} testID={`batch-progress-segment-${p.key}`} style={{ flex: p.n, backgroundColor: p.color }} />
            ) : null,
          )}
        </View>
      </View>
      <View
        testID="batch-progress-legend"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row", gap: 8 }}
      >
        {[...parts].reverse().map((p) => (
          <View key={p.key} testID={`batch-progress-cell-${p.key}`} style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <View
              style={{ width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: p.color, alignItems: "center", justifyContent: "center" }}
            >
              <StopGlyph name={p.glyph} size={GLYPH} color={ink.hero} />
            </View>
            <View style={{ flex: 1, flexShrink: 1 }}>
              <Text variant="caption" style={{ color: ink.headerMeta }}>
                {p.label}
              </Text>
              <Text selectable variant="label" style={{ color: ink.headerText, fontVariant: ["tabular-nums"] }}>
                {String(p.n)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
