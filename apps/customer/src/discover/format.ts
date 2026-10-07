import type { Locale, Offer } from "@catera/domain";

/** The catalog may one day carry a distance; until it does, cards simply leave it out. */
export type CatalogOffer = Offer & { distanceKm?: number | null };

const DAYS = {
  id: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

/** "Sen–Jum" for a run of three or more days in week order, otherwise the names listed. */
export function dayRange(weekdays: number[], locale: Locale): string {
  const names = DAYS[locale === "en" ? "en" : "id"];
  const week = [1, 2, 3, 4, 5, 6, 0].filter((d) => weekdays.includes(d));
  if (week.length === 7) return locale === "en" ? "Every day" : "Setiap hari";
  const first = [1, 2, 3, 4, 5, 6, 0].indexOf(week[0]);
  const run = week.length >= 3 && week.every((d, i) => [1, 2, 3, 4, 5, 6, 0].indexOf(d) === first + i);
  return run ? `${names[week[0]]}–${names[week[week.length - 1]]}` : week.map((d) => names[d]).join(", ");
}

export function mealWord(meal: string, locale: Locale): string {
  if (meal === "lunch") return locale === "en" ? "lunch" : "siang";
  if (meal === "dinner") return locale === "en" ? "dinner" : "malam";
  return locale === "en" ? "lunch and dinner" : "siang dan malam";
}

function km(distance: number, locale: Locale): string {
  const text = String(Math.round(distance * 10) / 10);
  return locale === "en" ? text : text.replace(".", ",");
}

/** "{katering}, {jarak} km. {hari} {siang/malam}" with the distance only when it is known. */
export function cardLine(offer: CatalogOffer, locale: Locale): string {
  const distance = typeof offer.distanceKm === "number" ? `, ${km(offer.distanceKm, locale)} km` : "";
  return `${offer.caterer}${distance}. ${dayRange(offer.weekdays, locale)} ${mealWord(offer.meal, locale)}`;
}

export function ratingText(offer: Offer, locale: Locale, t: (id: string, en: string) => string): string {
  if (offer.rating == null || !offer.reviewCount) return t("Belum ada ulasan", "No reviews yet");
  const rating = offer.rating.toFixed(1);
  return t(
    `${locale === "en" ? rating : rating.replace(".", ",")} dari ${offer.reviewCount} ulasan`,
    `${rating} from ${offer.reviewCount} reviews`,
  );
}
