import { normalizeCustomerPhone, shortDate, type Locale, type PilotImportRow } from "@catera/domain";

/** One customer as the assistant read it; the caterer can correct any field before saving. */
export type AssistantRow = {
  name: string;
  phone: string;
  addressLine: string;
  area: string;
  city: string;
  notes: string;
  packageId: string | null;
  startDate: string | null;
  remainingDays: number | null;
  portions: number;
  needsReview: boolean;
  reason: string;
};

/** Re-check a row after the caterer edits it, with the same rules the server applies. */
export function recheck(
  r: AssistantRow,
  packages: { id: string; days: number }[],
  earliest: string,
  t: (id: string, en: string) => string = (id) => id,
  locale: Locale = "id",
): AssistantRow {
  const reasons: string[] = [];
  if (!r.name.trim()) reasons.push(t("Nama belum ada", "Name missing"));
  if (!/^\+62\d{8,13}$/.test(tidyPhone(r.phone))) reasons.push(t("Nomor WhatsApp tidak lengkap", "WhatsApp number incomplete"));
  const pkg = packages.find((p) => p.id === r.packageId);
  if (!pkg) reasons.push(t("Paket belum dipilih", "Package not chosen"));
  if (r.addressLine.trim().length < 5 || !r.area.trim() || !r.city.trim()) reasons.push(t("Alamat belum lengkap", "Address incomplete"));
  if (!r.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.startDate)) reasons.push(t("Tanggal mulai belum ada", "Start date missing"));
  else if (r.startDate < earliest) {
    const day = shortDate(earliest, locale);
    reasons.push(t(`Tanggal antar berikutnya paling cepat ${day}`, `Next delivery can be ${day} at the earliest`));
  }
  if (!r.remainingDays || r.remainingDays < 1 || (pkg && r.remainingDays > pkg.days)) reasons.push(t("Sisa hari perlu dicek", "Check the days left"));
  return { ...r, needsReview: reasons.length > 0, reason: reasons.join(" · ") };
}

/** The +62 form of a typed number; a number that does not parse goes as typed and the server names it. */
function tidyPhone(value: string) {
  try {
    return normalizeCustomerPhone(value);
  } catch {
    return value;
  }
}

/** A clean assistant row as an import.preview row; the reference is generated per import day. */
export function toImportRow(r: AssistantRow, today: string, n: number): PilotImportRow {
  return {
    customer: {
      name: r.name.trim(),
      phone: tidyPhone(r.phone),
      address: { label: "Rumah", line: r.addressLine.trim(), area: r.area.trim(), city: r.city.trim(), instructions: r.notes.trim() },
    },
    packageId: r.packageId!,
    portions: r.portions,
    startDate: r.startDate!,
    remainingDays: r.remainingDays!,
    externalReference: `impor-${today}-${n}`,
  };
}
