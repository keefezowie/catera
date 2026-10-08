/** "6 hari lagi" / "1 day to go" / "6 days to go": Indonesian has no plural, English does. */
export function remainingLabel(remaining: number, t: (id: string, en: string) => string): string {
  return t(`${remaining} hari lagi`, remaining === 1 ? "1 day to go" : `${remaining} days to go`);
}
