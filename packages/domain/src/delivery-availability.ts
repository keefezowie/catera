import type { Locale } from "./index";

export type DeliveryAvailability = {
  date: string;
  available: boolean;
  reason: string | null;
  remaining: number;
};

const reasonLabels: Record<string, [string, string]> = {
  FIXED_PACKAGE: ["Jadwal paket tetap", "Fixed package schedule"],
  CUTOFF: ["Batas perubahan sudah lewat", "Change cutoff has passed"],
  INVALID_DATE: ["Bukan hari operasional paket", "Not an operating day"],
  DUPLICATE_DATE: [
    "Sudah ada pengantaran paket ini",
    "This package already has a delivery",
  ],
  CAPACITY: ["Kapasitas tidak mencukupi", "Not enough capacity"],
  OVERLAP: ["Bertabrakan dengan paket aktif", "Overlaps an active package"],
};

export function availabilityReasonLabel(
  reason: string | null | undefined,
  locale: Locale = "id",
) {
  if (!reason) return locale === "en" ? "Available" : "Tersedia";
  return (
    reasonLabels[reason]?.[locale === "en" ? 1 : 0] ||
    (locale === "en" ? "Unavailable" : "Tidak tersedia")
  );
}

export function earliestAvailable(rows: DeliveryAvailability[]) {
  return rows.find((row) => row.available)?.date ?? null;
}

export function availabilityReasonCounts(rows: DeliveryAvailability[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    if (!row.available && row.reason)
      counts[row.reason] = (counts[row.reason] || 0) + 1;
    return counts;
  }, {});
}
