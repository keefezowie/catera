import { expect, type Page } from "@playwright/test";

/** Selects an ISO date through the same calendar controls a user operates. */
export async function pickDate(page: Page, label: string, date: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const calendar = page.locator('.date-picker-popover[data-open="true"]');
  await expect(calendar).toBeVisible();
  const targetMonth = date.slice(0, 7);

  for (let moves = 0; moves < 120; moves += 1) {
    const visibleMonth = await calendar.getAttribute("data-visible-month");
    if (visibleMonth === targetMonth) break;
    await calendar
      .locator(
        visibleMonth! < targetMonth
          ? "[data-date-picker-next]"
          : "[data-date-picker-previous]",
      )
      .click();
  }

  await expect(calendar).toHaveAttribute("data-visible-month", targetMonth);
  await calendar.locator(`[data-calendar-day="${date}"]`).click();
}
