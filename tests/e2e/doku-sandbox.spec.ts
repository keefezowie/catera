import { test, expect } from "@playwright/test";
for (const locale of ["id", "en"])
  for (const width of [390, 1440]) {
    test(`DOKU sandbox and refund states ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 950 });
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.request.post("/api/v1/auth/demo", {
        data: { role: "customer" },
      });
      const original = (
        await (await page.request.get("/api/v1/customer")).json()
      ).data;
      const sub = original.subscriptions[0];
      await page.route(`**/api/v1/checkouts/${sub.checkout_id}`, (r) =>
        r.fulfill({
          json: {
            data: {
              id: sub.checkout_id,
              state: "pending",
              quote: sub.snapshot,
              expires_at: new Date(Date.now() + 600000).toISOString(),
              subscription_id: null,
              payment_url: null,
              provider: "doku",
              provider_environment: "sandbox",
            },
          },
        }),
      );
      await page.goto("/payment/" + sub.checkout_id);
      await expect(
        page.getByRole("status").filter({ hasText: "DOKU Sandbox" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const caseId = crypto.randomUUID();
      await page.route("**/api/v1/customer", (r) =>
        r.fulfill({
          json: {
            data: {
              ...original,
              cases: [
                {
                  id: caseId,
                  subject: "Synthetic refund case",
                  description: "Synthetic sandbox evaluation",
                  status: "resolved",
                  created_at: new Date().toISOString(),
                  caterer_id: sub.snapshot.offer.catererId,
                  resolution: "Approved",
                  amount: 10000,
                },
              ],
              refunds: [
                {
                  id: crypto.randomUUID(),
                  case_id: caseId,
                  amount: 10000,
                  state: "needs_attention",
                  customer_action_url: null,
                },
              ],
            },
          },
        }),
      );
      await page.goto("/support");
      await expect(
        page.getByText(
          locale === "en"
            ? "Catera is reviewing your refund. Funds have not been returned yet."
            : "Pengembalian dana sedang ditangani Catera. Dana belum dikembalikan.",
          { exact: true },
        ),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }
test("DOKU webhooks reject unsigned input and gated payout contract", async ({
  request,
}) => {
  const payment = await request.post("/api/webhooks/doku/payment", {
    data: { order: { invoice_number: "synthetic" } },
  });
  expect(payment.status()).toBe(401);
  const payout = await request.post("/api/webhooks/doku/payout", {
    data: { partnerReferenceNo: "synthetic" },
  });
  expect(payout.status()).toBe(503);
});
