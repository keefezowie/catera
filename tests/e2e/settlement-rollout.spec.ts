import { test, expect } from "@playwright/test";
for (const locale of ["id", "en"])
  test(`transactions tolerate settlement not installed ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
    await page.route("**/api/v1/seller-settlement/**", (route) =>
      route.fulfill({
        json: { data: { unavailable: true, reason: "not_installed" } },
      }),
    );
    await page.goto("/seller/transactions");
    await expect(
      page.getByText(
        locale === "en"
          ? "Delivery earnings reporting is not available yet. Your purchase history and previous payouts remain available below."
          : "Laporan pendapatan per pengantaran belum tersedia. Riwayat pembelian dan pencairan sebelumnya tetap tersedia di bawah.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: locale === "en" ? "Purchase history" : "Riwayat pembelian",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("The requested data was not found.", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        locale === "en" ? "Available for payout" : "Tersedia untuk pencairan",
        { exact: true },
      ),
    ).toHaveCount(0);
    await page.screenshot({
      path: `output/settlement-rollout-${locale}.png`,
      fullPage: true,
    });
  });
test("genuine settlement failures still show a retryable error", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.route("**/api/v1/seller-settlement/**", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "REQUEST_FAILED" } } }),
  );
  await page.goto("/seller/transactions");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Delivery earnings reporting is not available yet/),
  ).toHaveCount(0);
});
test("old database does not expose unusable settlement controls", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", {
    data: { role: "platform_admin" },
  });
  await page.route("**/api/v1/settlement-controls", (route) =>
    route.fulfill({
      json: { data: { unavailable: true, reason: "not_installed" } },
    }),
  );
  await page.goto("/admin/settlement");
  await expect(
    page.getByText(
      "Settlement features have not been activated in this environment.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save controls", exact: true }),
  ).toHaveCount(0);
});
