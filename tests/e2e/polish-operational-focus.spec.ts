import { test, expect } from "@playwright/test";
import { addDays, localDay } from "@catera/domain";

test("changing the operational date keeps keyboard context during loading and recovery", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const date = addDays(localDay(), 2),
    target = addDays(date, 1);
  await page.goto("/seller/schedule?date=" + date);
  const day = page.locator(`.coverage-day[data-day="${target}"]`);
  await expect(day).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/v1/seller/*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("date") !== target)
      return route.continue();
    if (!fail) return route.continue();
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: { code: "REQUEST_FAILED" } },
    });
  });
  await day.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp("date=" + target));
  try {
    await expect(day).toBeFocused({ timeout: 3000 });
    await expect(page.locator(".ops-orders-panel")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  } finally {
    release();
  }
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(day).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".ops-orders-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(day).toHaveAttribute("aria-pressed", "true");
});
