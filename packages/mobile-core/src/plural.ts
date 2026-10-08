/**
 * "1 day" / "3 days": the English count phrase. Indonesian has no plural, so callers keep their Indonesian string
 * as it is and use this only for the English side of `t(id, en)`.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
