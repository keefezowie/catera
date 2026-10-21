import { useState } from "react";
import type { Stop } from "@catera/domain";

/** The two things a selection can do to its stops. */
export type StopAction = "depart" | "arrive";

/**
 * What a stop can be picked for, by where its meal is. A stop that has not been cooked cannot leave or arrive; one that
 * is cooking can leave; one on its way can be marked Sampai; one already marked Sampai (waiting for the customer, or
 * closed) is past both. The note is the reason, in words, for a stop that cannot take every action.
 */
export function stopChoices(stop: Pick<Stop, "stage">, t: (id: string, en: string) => string) {
  switch (stop.stage) {
    case "preparing":
      return { depart: true, arrive: false, selectable: true, note: null };
    case "out_for_delivery":
      return {
        depart: false,
        arrive: true,
        selectable: true,
        note: t("Sudah berangkat, tinggal ditandai Sampai.", "Already on the way. Mark it Arrived once it's there."),
      };
    case "arrived":
      return { depart: false, arrive: false, selectable: false, note: t("Sudah ditandai sampai.", "Already marked as arrived.") };
    case "delivered":
      return { depart: false, arrive: false, selectable: false, note: t("Sudah diterima.", "Already received.") };
    default:
      return { depart: false, arrive: false, selectable: false, note: t("Belum dimasak.", "Not cooking yet.") };
  }
}

/** The selected stops each action would touch, in route order. */
export function selectedFor(stops: Stop[], selected: ReadonlySet<string>, action: StopAction): Stop[] {
  const stage = action === "depart" ? "preparing" : "out_for_delivery";
  return stops.filter((s) => selected.has(s.deliveryId) && s.stage === stage);
}

/** Stops that can be picked at all: some action is left for them. */
export const selectableStops = (stops: Stop[]) => stops.filter((s) => s.stage === "preparing" || s.stage === "out_for_delivery");

/** Runs of neighbouring stops in the same area, in route order, for "Pilih semua" per area. */
export function areaRuns(stops: Stop[]): { area: string; stops: Stop[] }[] {
  const runs: { area: string; stops: Stop[] }[] = [];
  for (const stop of stops) {
    const last = runs[runs.length - 1];
    if (last && last.area === stop.area) last.stops.push(stop);
    else runs.push({ area: stop.area, stops: [stop] });
  }
  return runs;
}

/** What the order list and the bottom bar share while "Pilih" is on. */
export type Selection = {
  active: boolean;
  selected: ReadonlySet<string>;
  start(): void;
  stop(): void;
  toggle(id: string): void;
  /** Ticks (or clears) a whole run of stops at once. */
  setMany(ids: string[], on: boolean): void;
};

/**
 * "Pilih" mode for one session's stops. A stop that is no longer selectable (another phone marked it, or the day
 * moved on) drops out of the selection by itself, and the mode ends when nothing is left to pick.
 */
export function useStopSelection(stops: Stop[], resetKey: string): Selection {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [keyed, setKeyed] = useState(resetKey);
  if (keyed !== resetKey) {
    setKeyed(resetKey);
    setActive(false);
    setSelected(new Set());
  }
  const open = new Set(selectableStops(stops).map((s) => s.deliveryId));
  const kept = [...selected].filter((id) => open.has(id));
  if (kept.length !== selected.size) setSelected(new Set(kept));
  if (active && open.size === 0) setActive(false);
  return {
    active,
    selected,
    start: () => setActive(true),
    stop: () => {
      setActive(false);
      setSelected(new Set());
    },
    toggle: (id) =>
      setSelected((s) => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setMany: (ids, on) =>
      setSelected((s) => {
        const next = new Set(s);
        for (const id of ids) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
  };
}
