import { test, expect } from "@playwright/test";
import type { SellerOperationsState } from "@catera/domain";

test("Whole-day CSV includes every meal when the visible table is filtered to zero", async ({
  page,
  baseURL,
}) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  expect(
    (
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } })
    ).ok(),
  ).toBe(true);
  const state: SellerOperationsState = (
    await (
      await page.request.get(
        "/api/v1/seller/10000000-0000-4000-8000-000000000001",
      )
    ).json()
  ).data;
  const entries = state.deliveries.filter(
    (delivery) => delivery.status !== "cancelled",
  );
  const meals = entries.flatMap((delivery) =>
    delivery.meals.map((meal) => ({
      name: delivery.offer.name,
      meal: meal.meal,
      portions: delivery.portions,
    })),
  );
  const portions = meals.reduce((sum, meal) => sum + meal.portions, 0);
  expect(portions).toBeGreaterThan(0);
  await page.goto(
    `/seller/schedule?date=${state.today}&production=1&search=ZeroMatchingRows`,
  );
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "0 orders · 0 meal portions",
  );
  await expect(page.locator(".ops-production")).toContainText(
    `${portions} meal portions`,
  );
  await expect(page.locator(".ops-production")).toContainText(
    "Whole day: all packages",
  );
  await page
    .getByRole("button", { name: "Save delivery list", exact: true })
    .click();
  const download = page.getByRole("link", { name: /^Download CSV · copy/ });
  await expect(download).toBeVisible();
  const response = await page.request.get(
    (await download.getAttribute("href"))!,
  );
  expect(response.ok()).toBe(true);
  const csv = await response.text();
  // The local synthetic fixture fields have no embedded newlines. All fields
  // are quoted by the manifest endpoint, including numeric portions.
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) =>
      [...line.matchAll(/"((?:[^\"]|"")*)"/g)].map((cell) =>
        cell[1].replaceAll('""', '"'),
      ),
    );
  expect(rows).toHaveLength(meals.length);
  expect(rows.reduce((sum, row) => sum + Number(row[5]), 0)).toBe(portions);
  for (const meal of meals) {
    expect(
      rows.some(
        (row) =>
          row[2] === meal.name &&
          row[3] === (meal.meal === "lunch" ? "Lunch" : "Dinner") &&
          Number(row[5]) === meal.portions,
      ),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.locator(".ops-scope-summary")).toContainText(
    "0 orders · 0 meal portions",
  );
  await expect(download).toBeVisible();
});
