import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role: "owner" },
  });
  expect(response.ok()).toBe(true);
}

test("operational date and meal period are separate responsive controls", async ({
  page,
  context,
}) => {
  await login(page);

  for (const locale of ["id", "en"] as const) {
    await context.addCookies([
      {
        name: "catera_locale",
        value: locale,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);

    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/seller");

      const date = page.getByRole("button", {
        name: locale === "id" ? "Tanggal operasional" : "Operational date",
      });
      const meal = page.getByRole("combobox", {
        name: locale === "id" ? "Waktu makan" : "Meal period",
      });
      const [dateBox, mealBox] = await Promise.all([
        date.boundingBox(),
        meal.boundingBox(),
      ]);
      expect(dateBox).not.toBeNull();
      expect(mealBox).not.toBeNull();
      expect(mealBox!.x - (dateBox!.x + dateBox!.width)).toBeGreaterThanOrEqual(
        12,
      );
      expect(Math.abs(dateBox!.height - mealBox!.height)).toBeLessThanOrEqual(
        1,
      );
      expect(dateBox!.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await date.focus();
      await date.press("Tab");
      await expect(meal).toBeFocused();

      await date.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await meal.click();
      await expect(
        page.getByRole("option", {
          name: locale === "id" ? "Makan siang" : "Lunch",
          exact: true,
        }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
});

test("cutoff editor stays in a 24-hour format", async ({ page }) => {
  await login(page);
  await page.goto("/seller/settings");

  const cutoff = page.getByRole("button", {
    name: "Cutoff sehari sebelumnya",
  });
  await expect(cutoff).toHaveText("17:00");
  await expect(page.locator('input[type="time"]')).toHaveCount(0);

  await cutoff.click();
  const picker = page.getByRole("dialog", { name: "Pilih waktu" });
  await expect(picker).toBeVisible();

  await picker.getByRole("combobox", { name: "Jam" }).click();
  await page.getByRole("option", { name: "22", exact: true }).click();
  await picker.getByRole("combobox", { name: "Menit" }).click();
  await page.getByRole("option", { name: "30", exact: true }).click();
  await picker.getByRole("button", { name: "Simpan" }).click();

  await expect(cutoff).toHaveText("22:30");
  await expect(page.locator('input[name="cutoff"]')).toHaveValue("22:30");
});
