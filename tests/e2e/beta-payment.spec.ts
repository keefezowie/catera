import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Checkout, PaymentView } from "@catera/domain";
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

const countdownCases: {
  name: string;
  state: string;
  title: [string, string];
  countdown: boolean;
  directStatus?: PaymentView["status"];
  expired?: boolean;
  paymentUrl?: boolean;
}[] = [
  {
    name: "awaiting direct payment",
    state: "pending",
    title: ["Menunggu pembayaran", "Awaiting payment"],
    countdown: true,
    directStatus: "awaiting_payment",
  },
  {
    name: "preparing payment",
    state: "pending",
    title: ["Menyiapkan pembayaran", "Preparing payment"],
    countdown: true,
    directStatus: "choose_method",
  },
  {
    name: "expired payment",
    state: "expired",
    title: ["Waktu pembayaran habis", "Payment time expired"],
    countdown: false,
  },
  {
    name: "checking payment",
    state: "pending",
    title: ["Memeriksa pembayaran", "Checking payment"],
    countdown: false,
    directStatus: "checking",
  },
  {
    name: "unresolved booking",
    state: "payment_exception",
    title: [
      "Pembayaran diterima, jadwal sedang ditinjau",
      "Payment received, booking under review",
    ],
    countdown: false,
    paymentUrl: true,
  },
  ...["hosted", "expired hosted", "direct"].map((variant) => ({
    name: `paid without booking ${variant}`,
    state: "paid",
    title: [
      "Pembayaran diterima, mengonfirmasi jadwal",
      "Payment received, confirming schedule",
    ] as [string, string],
    countdown: false,
    paymentUrl: variant !== "direct",
    expired: variant === "expired hosted",
    ...(variant === "direct"
      ? { directStatus: "awaiting_payment" as const }
      : {}),
  })),
];

for (const locale of ["id", "en"] as const)
  for (const sample of countdownCases)
    test(`payment countdown ${locale}: ${sample.name}`, async ({
      page,
      baseURL,
    }) => {
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        (
          await page.request.post("/api/v1/auth/demo", {
            data: { role: "customer" },
          })
        ).ok(),
      ).toBe(true);
      const customer = (
        await (await page.request.get("/api/v1/customer")).json()
      ).data;
      const subscription = customer.subscriptions[0];
      expect(subscription).toBeTruthy();
      const deadline = new Date(
        Date.now() + (sample.expired ? -60000 : 600000),
      ).toISOString();
      const checkout: Checkout = {
        id: subscription.checkout_id,
        state: sample.state,
        quote: subscription.snapshot,
        expires_at: deadline,
        subscription_id: null,
        payment_url: sample.paymentUrl
          ? "https://example.invalid/synthetic-payment"
          : null,
        ...(sample.directStatus
          ? {
              payment_mode: "direct" as const,
              payment: {
                mode: "direct" as const,
                availableMethods: ["VIRTUAL_ACCOUNT_BRI" as const],
                selectedMethod:
                  sample.directStatus === "choose_method"
                    ? null
                    : ("VIRTUAL_ACCOUNT_BRI" as const),
                status: sample.directStatus,
                expiresAt: deadline,
                instructions:
                  sample.directStatus === "choose_method"
                    ? null
                    : {
                        kind: "virtual_account" as const,
                        accountNumber: "000000000000000",
                        accountName: "Synthetic Catera",
                        bank: "BRI" as const,
                      },
              },
            }
          : {}),
      };
      await page.route(`**/api/v1/checkouts/${checkout.id}`, (route) =>
        route.fulfill({ json: { data: checkout } }),
      );
      const businessActions: string[] = [];
      await page.route("**/api/v1/commands", (route) => {
        businessActions.push(route.request().postDataJSON().action);
        return route.abort();
      });
      await page.goto(`/payment/${checkout.id}`);
      await expect(
        page.getByRole("heading", {
          name: t(...sample.title),
          exact: true,
        }),
      ).toBeVisible();

      const countdown = page.locator(".facts > div").filter({
        has: page.getByText(t("Batas pembayaran", "Time remaining"), {
          exact: true,
        }),
      });
      if (sample.countdown) {
        await expect(countdown).toBeVisible();
        await expect(countdown.locator("dd")).toHaveText(/^[1-9]\d*:\d{2}$/);
      } else {
        await expect(countdown).toHaveCount(0);
        await expect(
          page.getByText(t("Batas pembayaran", "Time remaining"), {
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(page.locator(".direct-payment")).toHaveCount(0);
        await expect(
          page.getByRole("link", {
            name: t("Buka pembayaran aman", "Open secure payment"),
          }),
        ).toHaveCount(0);
      }
      if (sample.state === "paid") {
        await expect(
          page.getByRole("heading", {
            name: t("Pembayaran berhasil", "Payment successful"),
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("status").filter({
            hasText: t(
              "Pembayaran telah diterima. Kami sedang mengonfirmasi jadwal pengantaran. Jangan melakukan pembayaran kedua.",
              "Payment was received. We are confirming the delivery schedule. Do not make another payment.",
            ),
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: t("Periksa status", "Check status"),
            exact: true,
          }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(businessActions).toEqual([]);
      const evidence =
        "output/playwright/familiar-settings/after/payment-status";
      await mkdir(evidence, { recursive: true });
      await page.screenshot({
        path: `${evidence}/${locale}-${sample.name.replaceAll(" ", "-")}.png`,
        fullPage: true,
      });
    });
