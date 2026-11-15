import { View } from "react-native";
import type { KitchenSession } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { DecorativeIcon, StopGlyph, Text, useMoodColors } from "@catera/mobile-ui";
import { jakartaClock } from "./exceptions";

/** How far the whole batch has got: every active row, counted once by the stage it is in. */
export function batchCounts(session: KitchenSession): {
  total: number;
  scheduled: number;
  cooking: number;
  out: number;
  arrived: number;
} {
  const c = session.counts;
  const total = Object.values(c).reduce((sum, n) => sum + n, 0);
  return { total, scheduled: c.scheduled, cooking: c.preparing, out: c.out_for_delivery, arrived: c.arrived + c.delivered };
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

const STEPS = ["cook", "depart", "arrive"] as const;
type Step = (typeof STEPS)[number];

/**
 * Hari ini's progress for the whole batch, under the figures, as three steps: Masak, Antar, Sampai. The current step is
 * the earliest stage any stop is still in (stops leave in subsets), so it is `journey.stage`: scheduled means Masak
 * is current, preparing means Masak is done and Antar is current, out_for_delivery means Sampai is current, and a batch
 * with every stop arrived has all three done. The current step carries the count: Masak "n dari total" that have
 * started, Antar "n dari total" that have left, Sampai "n dari total" that arrived.
 * The bar shows whenever the meal has deliveries, so before cooking Masak is current at "0 dari total". Under the
 * current step (under Sampai once all are done) sits the newest time that explains it: "terakhir" (latest arrival),
 * else "berangkat", else "mulai masak". The bar is one image for a screen reader, whose label states the current step,
 * its count and that time. Step names wrap under large text rather than clip.
 */
export function BatchProgress({ session }: { session: KitchenSession }) {
  const { t } = useMobile();
  const ink = useMoodColors();
  const { total, scheduled, out, arrived } = batchCounts(session);
  if (!total) return null;

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

  const stage = journey.stage;
  const current: Step | null =
    stage === "scheduled" ? "cook" : stage === "preparing" ? "depart" : stage === "out_for_delivery" ? "arrive" : null;
  const names: Record<Step, string> = { cook: t("Masak", "Cook"), depart: t("Antar", "Deliver"), arrive: t("Sampai", "Arrive") };
  const glyphs = { cook: "pot", depart: "motorbike", arrive: "house" } as const;
  const count: Record<Step, number> = { cook: total - scheduled, depart: out + arrived, arrive: arrived };
  const done = (s: Step) => current === null || STEPS.indexOf(s) < STEPS.indexOf(current);
  const metaStep: Step = current ?? "arrive";
  const withMeta = meta ? `, ${meta}` : "";

  const label = current
    ? t(
        `Langkah ${names[current]}, ${count[current]} dari ${total}`,
        `Step ${names[current]}, ${count[current]} of ${total}`,
      ) +
      withMeta +
      (current === "arrive" ? t(". Masak dan Antar selesai", ". Cook and Deliver done") : current === "depart" ? t(". Masak selesai", ". Cook done") : "")
    : t("Masak, Antar, dan Sampai selesai", "Cook, Deliver and Arrive done") + withMeta;

  return (
    <View testID="batch-progress" accessible accessibilityRole="image" accessibilityLabel={label} style={{ gap: 4 }}>
      <View testID="batch-progress-bar" style={{ flexDirection: "row", gap: 6 }}>
        {STEPS.map((s) => {
          const isDone = done(s);
          const isCurrent = s === current;
          const fg = isDone || isCurrent ? ink.hero : ink.headerMeta;
          return (
            <View
              key={s}
              testID={`batch-step-${s}`}
              style={{
                flex: isCurrent ? 2 : 1,
                minHeight: 32,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isCurrent ? ink.stopActive : ink.markerIdle,
                backgroundColor: isCurrent ? ink.stopActive : isDone ? ink.toggleActive : "transparent",
              }}
            >
              {isDone ? <DecorativeIcon name="checkmark" size={14} color={fg} /> : <StopGlyph name={glyphs[s]} size={14} color={fg} />}
              <Text variant="label" style={{ flexShrink: 1, color: fg, fontVariant: ["tabular-nums"], textAlign: "center" }}>
                {isCurrent ? `${names[s]} · ${t(`${count[s]} dari ${total}`, `${count[s]} of ${total}`)}` : names[s]}
              </Text>
            </View>
          );
        })}
      </View>
      {meta ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {STEPS.map((s) => (
            <View key={s} style={{ flex: s === current ? 2 : 1 }}>
              {s === metaStep ? (
                <Text
                  testID="batch-progress-meta"
                  variant="caption"
                  style={{ color: ink.headerMeta, fontVariant: ["tabular-nums"], textAlign: "center" }}
                >
                  {meta}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
