import { offerSchema } from "./index";
export const offerSteps = [
  "offer",
  "contents",
  "pricing",
  "schedule",
  "review",
] as const;
export type OfferStep = (typeof offerSteps)[number];
export type EditorIssue = { step: OfferStep; path: string; message: string };
const fieldStep: Record<string, OfferStep> = {
  name: "offer",
  description: "offer",
  meal: "offer",
  days: "schedule",
  packageType: "offer",
  nutrition: "contents",
  image: "contents",
  tags: "contents",
  menus: "contents",
  price: "pricing",
  tiers: "pricing",
  weekdays: "schedule",
  capacity: "schedule",
  windows: "schedule",
  flexible: "schedule",
  trialPrice: "pricing",
  trialMax: "pricing",
};
export function sharedCapacityValue(
  capacity: Record<string, number>,
  weekdays: number[],
): number {
  const values = weekdays.length
    ? weekdays.map((weekday) => capacity[String(weekday)] ?? 0)
    : Object.values(capacity);
  return values.reduce((maximum, value) => Math.max(maximum, value), 0);
}
export function withSharedCapacity(
  capacity: Record<string, number>,
  weekdays: number[],
  value: number,
): Record<string, number> {
  const next = { ...capacity };
  for (const weekday of weekdays) next[String(weekday)] = value;
  return next;
}
export function offerEditorIssues(
  value: Record<string, unknown>,
  draft = false,
): EditorIssue[] {
  const parsed = offerSchema.safeParse({
    ...value,
    status: draft ? "draft" : "published",
  });
  const issues: EditorIssue[] = parsed.success
    ? []
    : parsed.error.issues.map((i) => ({
        step: fieldStep[String(i.path[0])] || "offer",
        path: i.path.join("."),
        message: i.message,
      }));
  if (!draft && !value.packageType)
    issues.unshift({
      step: "offer",
      path: "packageType",
      message:
        "Pilih jenis paket terlebih dahulu / Choose a package type first",
    });
  // Validate prerequisites independently: a malformed later field must not suppress them.
  for (const [key, minimum] of [
    ["name", 3],
    ["description", 10],
  ] as const) {
    const text = typeof value[key] === "string" ? value[key].trim() : "";
    if (
      (!draft || text.length > 0) &&
      text.length < minimum &&
      !issues.some((i) => i.path === key)
    )
      issues.push({
        step: "offer",
        path: key,
        message: `Minimal ${minimum} karakter / At least ${minimum} characters`,
      });
  }
  if (
    !draft &&
    typeof value.image === "string" &&
    !value.image.trim() &&
    !issues.some((i) => i.path === "image")
  )
    issues.push({
      step: "contents",
      path: "image",
      message: "Unggah foto paket / Upload a package photo",
    });
  return issues.sort(
    (a, b) => offerSteps.indexOf(a.step) - offerSteps.indexOf(b.step),
  );
}
