import { test, expect } from "@playwright/test";
const cid = "10000000-0000-4000-8000-000000000001";
test("onboarding returns existing operators and preserves invalid application fields", async ({
  page,
  baseURL,
}) => {
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  for (const role of ["owner", "staff"]) {
    await page.request.post("/api/v1/auth/demo", { data: { role } });
    await page.goto("/seller/onboarding");
    await expect(
      page.getByRole("link", { name: "Return to your workspace", exact: true }),
    ).toHaveAttribute("href", "/seller");
    await expect(
      page.getByText("Set up your first package", { exact: true }),
    ).toHaveCount(0);
  }
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/seller/onboarding");
  await page
    .getByRole("textbox", { name: "Caterer name", exact: true })
    .fill("Synthetic application");
  await page
    .getByRole("textbox", { name: "Caterer page address", exact: true })
    .fill("synthetic-application");
  await page
    .getByRole("textbox", { name: "About your food", exact: true })
    .fill("Synthetic food for a validation check");
  await expect(
    page.getByText(baseURL! + "/caterers/synthetic-application", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create caterer profile", exact: true })
    .click();
  await expect(page.locator(".error-notice")).toContainText(
    "Choose at least one delivery area",
  );
  await expect(
    page.getByRole("textbox", { name: "Caterer name", exact: true }),
  ).toHaveValue("Synthetic application");
});
for (const locale of ["id", "en"])
  test(`bank review readiness and sign-out recovery ${locale}`, async ({
    page,
    baseURL,
  }) => {
    const t = (id: string, en: string) => (locale === "id" ? id : en);
    expect(
      (await (await page.request.get("/api/v1/me")).json()).data.demo,
    ).toBe(true);
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
    const original = (
      await (await page.request.get(`/api/v1/payout-setup/${cid}`)).json()
    ).data;
    const account = {
      id: crypto.randomUUID(),
      bank: "BRI",
      holder: "Synthetic Journey",
      maskedAccount: "••••0123",
      reason: "Synthetic correction",
      status: "approved",
    };
    for (const status of [
      "none",
      "submitted",
      "rejected",
      "approved",
      "ready",
    ]) {
      const active = ["approved", "ready"].includes(status) ? account : null;
      await page.route("**/api/v1/payout-setup/**", (route) =>
        route.fulfill({
          json: {
            data: {
              ...original,
              active,
              legacyDestination: null,
              latest:
                status === "none"
                  ? null
                  : {
                      ...account,
                      status: status === "ready" ? "approved" : status,
                    },
              providerReady: status === "ready",
              dispatchEnabled: status === "ready",
              settlement: {
                ...original.settlement,
                policy: {
                  ...original.settlement.policy,
                  enabled: status === "ready",
                  synthetic: false,
                },
                nextProcessingAt:
                  status === "ready" ? "2026-09-28T02:00:00Z" : null,
              },
            },
          },
        }),
      );
      await page.goto("/seller/settings");
      const bank = page.locator("#payout");
      if (status === "submitted") {
        await expect(bank).toContainText(
          t("Tunggu hasil tinjauan", "Wait for Catera's review"),
        );
        await expect(bank.getByRole("button")).toBeDisabled();
      }
      if (status === "rejected")
        await expect(bank).toContainText(
          t("Perbaiki data", "Correct the details"),
        );
      if (status === "approved")
        await expect(bank).toContainText(
          t("Menunggu aktivasi pencairan", "Awaiting payout activation"),
        );
      if (status !== "ready") {
        await expect(bank).toContainText(
          t("Belum ada tanggal transfer", "No transfer date"),
        );
        await expect(bank).not.toContainText("28/09");
      } else
        await expect(bank).toContainText(
          t("Jendela pemrosesan berikutnya", "Next processing window"),
        );
      await page.unrouteAll();
    }
    await page.route("**/api/v1/auth/logout", (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: "REQUEST_FAILED" } },
      }),
    );
    await page
      .getByRole("button", {
        name: t("Keluar dari sesi ini", "Sign out of this session"),
        exact: true,
      })
      .click();
    await expect(page.locator(".error-notice")).toContainText(
      t("Sesi masih aktif", "Your session remains open"),
    );
    await page.unrouteAll();
    await page
      .getByRole("button", { name: t("Coba lagi", "Try again"), exact: true })
      .click();
    await expect(page).toHaveURL(baseURL! + "/");
    expect(
      (await (await page.request.get("/api/v1/me")).json()).data.actor,
    ).toBeNull();
  });
