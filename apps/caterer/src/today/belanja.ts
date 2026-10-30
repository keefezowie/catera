import { shortDate, type WeekRecap } from "@catera/domain";

/** The days a Belanja recap reads: today and the six after it, Jakarta calendar days. */
export const BELANJA_DAYS = 7;

/** The category a dish sits under; a dish whose package names none goes under "Lainnya". */
export const OTHER_CATEGORY = "Lainnya";

/** The dishes grouped by category, in the recap's order (category, then biggest count first). */
export function dishSections(week: WeekRecap) {
  const sections: { category: string; dishes: WeekRecap["byDish"] }[] = [];
  for (const dish of week.byDish) {
    const last = sections[sections.length - 1];
    if (last && last.category === dish.category) last.dishes.push(dish);
    else sections.push({ category: dish.category, dishes: [dish] });
  }
  return sections;
}

/** "Sen 5 Okt sampai Min 11 Okt". The shared and printed text always uses the Indonesian form. */
export const weekRange = (week: WeekRecap, locale: "id" | "en") =>
  `${shortDate(week.from, locale)} ${locale === "id" ? "sampai" : "to"} ${shortDate(week.to, locale)}`;

/**
 * The WhatsApp-ready recap. Indonesian whatever the app language, like the cooking list's shared text: the kitchen
 * sends it to a supplier or a helper in Indonesian.
 */
export function belanjaLines(week: WeekRecap, caterer: string) {
  const range = weekRange(week, "id");
  const lines = [caterer, `*Belanja 7 hari* (${range}, ${week.total} porsi)`];
  for (const section of dishSections(week)) {
    lines.push("", `*${section.category || OTHER_CATEGORY}*`, ...section.dishes.map((d) => `${d.count}× ${d.name}`));
  }
  if (week.unfilled > 0) lines.push("", `Menu belum diisi · ${week.unfilled} porsi`);
  return lines.join("\n");
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The printed page: the same Indonesian text as the shared one, as a heading and a list per category. */
export function belanjaHtml(week: WeekRecap, caterer: string) {
  const sections = dishSections(week)
    .map(
      (s) =>
        `<h3>${escape(s.category || OTHER_CATEGORY)}</h3><ul>${s.dishes
          .map((d) => `<li>${d.count} × ${escape(d.name)}</li>`)
          .join("")}</ul>`,
    )
    .join("");
  const unfilled = week.unfilled > 0 ? `<p><b>Menu belum diisi · ${week.unfilled} porsi</b></p>` : "";
  return `<h2>${escape(caterer)} · Belanja 7 hari</h2><p>${weekRange(week, "id")} · ${week.total} porsi</p>${sections}${unfilled}`;
}
