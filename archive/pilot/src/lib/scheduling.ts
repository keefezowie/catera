import type { Snapshot } from "./types";
export type ScheduleInput = {
  customer_id: string;
  starts_on: string;
  ends_on: string;
  weekdays: number[];
  slot_ids: string[];
};
export function previewSchedule(s: Snapshot, input: ScheduleInput) {
  const rows: { date: string; slot_id: string; grant_id: string | null }[] = [];
  if (!input.starts_on || !input.ends_on || input.starts_on > input.ends_on)
    return rows;
  const balances = new Map(
    s.grants.map((g) => [g.id, g.remaining - g.reserved]),
  );
  const grants = s.grants
    .filter((g) => g.customer_id === input.customer_id)
    .sort(
      (a, b) =>
        (a.expires_on || "9999").localeCompare(b.expires_on || "9999") ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  const end = new Date(input.ends_on + "T12:00:00Z"),
    day = new Date(input.starts_on + "T12:00:00Z");
  while (day <= end) {
    const date = day.toISOString().slice(0, 10);
    if (
      input.weekdays.includes(day.getUTCDay()) &&
      !s.exceptions.some((e) => e.service_date === date && e.closed)
    ) {
      for (const slot_id of input.slot_ids) {
        if (
          s.deliveries.some(
            (d) =>
              d.customer_id === input.customer_id &&
              d.service_date === date &&
              d.slot_id === slot_id,
          )
        )
          continue;
        const grant = grants.find(
          (g) =>
            g.starts_on <= date &&
            (!g.expires_on || g.expires_on >= date) &&
            (balances.get(g.id) || 0) > 0,
        );
        if (grant) balances.set(grant.id, balances.get(grant.id)! - 1);
        rows.push({ date, slot_id, grant_id: grant?.id || null });
      }
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return rows;
}
