import { test, expect } from "@playwright/test";
for (const state of [
  "pending",
  "failed",
  "expired",
  "payment_exception",
  "paid",
  "refunded",
  "partially_refunded",
])
  test(`payment displays server state ${state}`, async ({ page, baseURL }) => {
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
    await page.request.post("/api/v1/auth/demo", {
      data: { role: "customer" },
    });
    const data = (await (await page.request.get("/api/v1/customer")).json())
      .data;
    const sub = data.subscriptions[0];
    await page.route(`**/api/v1/checkouts/${sub.checkout_id}`, (route) =>
      route.fulfill({
        json: {
          data: {
            id: sub.checkout_id,
            state,
            quote: sub.snapshot,
            expires_at: new Date(Date.now() + 600000).toISOString(),
            subscription_id: [
              "paid",
              "refunded",
              "partially_refunded",
            ].includes(state)
              ? sub.id
              : null,
            payment_url: "https://example.invalid/payment",
          },
        },
      }),
    );
    await page.goto("/payment/" + sub.checkout_id);
    const titles: Record<string, string> = {
      pending: "Awaiting payment",
      failed: "Payment time expired",
      expired: "Payment time expired",
      payment_exception: "Payment received, booking under review",
      paid: "Payment successful",
      refunded: "Payment refunded",
      partially_refunded: "Payment partially refunded",
    };
    await expect(
      page.getByRole("heading", { name: titles[state], exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Simulate successful payment" }),
    ).toHaveCount(state === "pending" ? 1 : 0);
    if (state !== "paid")
      await expect(
        page.getByRole("heading", { name: "Payment successful" }),
      ).toHaveCount(0);
  });
