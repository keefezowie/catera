import type { PolishArtName } from "@catera/mobile-ui";

/** The most the review's words can hold (the review sheet's field and `review.save`). */
export const REVIEW_MAX = 1000;

/**
 * The quick praise (polish ruling 1). Each chip is a phrase: tapping it writes the phrase into the review's words and
 * tapping it again takes it out, so praise travels in the review body and `review.save` needs no new field. `id` is the
 * Indonesian phrase, `en` the English one; a review written in either language counts.
 */
export const PRAISE: readonly { id: string; en: string; art: PolishArtName }[] = [
  { id: "Masih hangat", en: "Still warm", art: "compliment-hangat" },
  { id: "Porsi pas", en: "Right portion", art: "compliment-porsi-pas" },
  { id: "Rasa rumahan", en: "Tastes like home", art: "compliment-rumahan" },
  { id: "Tepat waktu", en: "On time", art: "spot-rantang-sampai" },
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The phrase as a whole clause: at the start or after punctuation or a space, and followed by the end, a line break or
 * punctuation, in any case. "porsi pas, nasinya hangat" holds "Porsi pas"; "Porsi pas sekali" does not.
 */
const clause = (phrase: string) => new RegExp(`(^|[\\s.,!?;])${escape(phrase.trim())}(?=$|[\\n.,!?;])\\.?`, "i");

/** Whether the words already carry the phrase, however it was written (case, with or without the full stop). */
export function hasPraise(body: string, phrase: string): boolean {
  return clause(phrase).test(body);
}

/** The praise (by its Indonesian phrase) a review's words carry, in either language, each once. */
export function praiseIn(body: string): string[] {
  return PRAISE.filter((p) => hasPraise(body, p.id) || hasPraise(body, p.en)).map((p) => p.id);
}

/**
 * The words with the phrase taken out when they hold it, or added at the end ("Phrase.") when they do not. Null when
 * adding it would pass `max` characters, so the caller can say so and keep the words as they are.
 */
export function withPraise(body: string, phrase: string, max = REVIEW_MAX): string | null {
  if (hasPraise(body, phrase))
    return body
      .replace(clause(phrase), "$1")
      .replace(/ {2,}/g, " ")
      .replace(/^[\s.,;]+/, "")
      .trim();
  const next = [body.trim(), `${phrase.trim()}.`].filter(Boolean).join(" ");
  return next.length > max ? null : next;
}
