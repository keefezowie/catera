/** delivery.status takes "issue" straight from these stages, in one transaction and with one push to the customer. */
export function canMarkIssue(mealStatus: string): boolean {
  return ["scheduled", "preparing", "out_for_delivery"].includes(mealStatus);
}

/** HH.MM in Asia/Jakarta for "Terakhir diperbarui". */
export function jakartaClock(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
