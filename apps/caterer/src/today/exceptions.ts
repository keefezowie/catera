/** delivery.status only moves forward one stage at a time; this walks a meal to "issue". */
export function issueSteps(mealStatus: string): string[] {
  const path = ["preparing", "out_for_delivery", "issue"];
  const from = { scheduled: 0, preparing: 1, out_for_delivery: 2 }[mealStatus];
  return from === undefined ? [] : path.slice(from);
}

/** HH.MM in Asia/Jakarta for "Terakhir diperbarui". */
export function jakartaClock(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
