import type { PilotImportRow } from "@catera/domain";

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
export function recheck(r: AssistantRow, packages: { id: string; days: number }[]): AssistantRow {
  const reasons: string[] = [];
  if (!r.name.trim()) reasons.push("Nama belum ada");
  if (!/^\+62\d{8,13}$/.test(r.phone)) reasons.push("Nomor WhatsApp tidak lengkap");
  const pkg = packages.find((p) => p.id === r.packageId);
  if (!pkg) reasons.push("Paket belum dipilih");
  if (r.addressLine.trim().length < 5 || !r.area.trim() || !r.city.trim()) reasons.push("Alamat belum lengkap");
  if (!r.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.startDate)) reasons.push("Tanggal mulai belum ada");
  if (!r.remainingDays || r.remainingDays < 1 || (pkg && r.remainingDays > pkg.days)) reasons.push("Sisa hari perlu dicek");
  return { ...r, needsReview: reasons.length > 0, reason: reasons.join(" · ") };
}

/** A clean assistant row as an import.preview row; the reference is generated per import day. */
export function toImportRow(r: AssistantRow, today: string, n: number): PilotImportRow {
  return {
    customer: {
      name: r.name.trim(),
      phone: r.phone,
      address: { label: "Rumah", line: r.addressLine.trim(), area: r.area.trim(), city: r.city.trim(), instructions: r.notes.trim() },
    },
    packageId: r.packageId!,
    portions: r.portions,
    startDate: r.startDate!,
    remainingDays: r.remainingDays!,
    externalReference: `impor-${today}-${n}`,
  };
}
