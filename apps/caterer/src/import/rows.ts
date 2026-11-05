import { normalizeCustomerPhone, shortDate, type Locale, type PilotImportRow } from "@catera/domain";
import { plural } from "@catera/mobile-core";

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

export type RowField = "name" | "phone" | "packageId" | "addressLine" | "area" | "city" | "startDate" | "remainingDays";
type T = (id: string, en: string) => string;
type RowPackage = { id: string; days: number; name?: string };

/**
 * What stops a row from being saved, one entry per field in the form's order. `message` goes under the field; the list's
 * line names blank fields together by `missing` ("Belum ada: paket, kota") and states any other problem by its `line`.
 */
export type RowIssue = { field: RowField; message: string; missing?: string; line?: string };

/** The server's rules for a row (`v1.pilot_import_row`), said field by field. */
export function issuesOf(r: AssistantRow, packages: RowPackage[], earliest: string, t: T = (id) => id, locale: Locale = "id"): RowIssue[] {
  const issues: RowIssue[] = [];
  if (!r.name.trim()) issues.push({ field: "name", message: t("Isi nama pelanggan", "Enter the customer's name"), missing: t("nama", "name") });
  if (!r.phone.trim()) issues.push({ field: "phone", message: t("Isi nomor WhatsApp", "Enter the WhatsApp number"), missing: t("nomor WhatsApp", "WhatsApp number") });
  else if (!/^\+62\d{8,13}$/.test(tidyPhone(r.phone))) {
    const line = t("Nomor WhatsApp kurang lengkap", "WhatsApp number is incomplete");
    issues.push({ field: "phone", message: t("Nomor WhatsApp kurang lengkap. Contoh: 0812 3456 7890", "That number looks incomplete. Example: 0812 3456 7890"), line });
  }
  const pkg = packages.find((p) => p.id === r.packageId);
  if (!pkg) issues.push({ field: "packageId", message: t("Pilih satu paket", "Choose a package"), missing: t("paket", "package") });
  const line = r.addressLine.trim();
  if (!line) issues.push({ field: "addressLine", message: t("Isi alamat", "Enter the address"), missing: t("alamat", "address") });
  else if (line.length < 5) {
    const short = t("Alamat terlalu pendek", "The address is too short");
    issues.push({ field: "addressLine", message: short, line: short });
  }
  if (!r.area.trim()) issues.push({ field: "area", message: t("Isi area", "Enter the area"), missing: t("area", "area") });
  if (!r.city.trim()) issues.push({ field: "city", message: t("Isi kota", "Enter the city"), missing: t("kota", "city") });
  if (!r.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.startDate))
    issues.push({ field: "startDate", message: t("Pilih tanggal antar berikutnya", "Choose the next delivery date"), missing: t("tanggal antar", "delivery date") });
  else if (r.startDate < earliest) {
    const day = shortDate(earliest, locale);
    const early = t(`Antar berikutnya paling cepat ${day}`, `Next delivery can be ${day} at the earliest`);
    issues.push({ field: "startDate", message: early, line: early });
  }
  if (!r.remainingDays || r.remainingDays < 1) issues.push({ field: "remainingDays", message: t("Isi sisa hari", "Enter the days left"), missing: t("sisa hari", "days left") });
  else if (pkg && r.remainingDays > pkg.days) {
    const name = pkg.name ?? t("ini", "this");
    issues.push({
      field: "remainingDays",
      message: t(`Melebihi paket ${name} (${pkg.days} hari)`, `More than ${name} has (${plural(pkg.days, "day")})`),
      line: t(`Sisa hari ${r.remainingDays}, paketnya cuma ${pkg.days} hari`, `${plural(r.remainingDays, "day")} left, the package has only ${pkg.days}`),
    });
  }
  return issues;
}

/** The list's one line for a row's issues. */
export function issueLine(issues: RowIssue[], t: T = (id) => id): string {
  const missing = issues.flatMap((i) => i.missing ?? []);
  const lines = issues.flatMap((i) => i.line ?? []);
  return [...(missing.length ? [t(`Belum ada: ${missing.join(", ")}`, `Missing: ${missing.join(", ")}`)] : []), ...lines].join(" · ");
}

/** Re-check a row after the caterer edits it, with the same rules the server applies. */
export function recheck(r: AssistantRow, packages: RowPackage[], earliest: string, t: T = (id) => id, locale: Locale = "id"): AssistantRow {
  const issues = issuesOf(r, packages, earliest, t, locale);
  return { ...r, needsReview: issues.length > 0, reason: issueLine(issues, t) };
}

/**
 * A row off the assistant or a draft: its issues as of today (a saved date can have gone stale, a package can be gone).
 * A row with none keeps what it had, so the assistant's own doubt about a value it guessed stays until the caterer
 * checks it.
 */
export function settle(r: AssistantRow, packages: RowPackage[], earliest: string, t: T = (id) => id, locale: Locale = "id"): AssistantRow {
  const issues = issuesOf(r, packages, earliest, t, locale);
  return issues.length ? { ...r, needsReview: true, reason: issueLine(issues, t) } : r;
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
