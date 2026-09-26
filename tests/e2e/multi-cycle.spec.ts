import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addDays, localDay } from "@catera/domain";
import { mkdir } from "node:fs/promises";
const cid = "10000000-0000-4000-8000-000000000001";
for (const locale of ["id", "en"])
  for (const width of [390, 1440])
    test(`Slack checkout gates and two cycles ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const command = async (action: string, payload: unknown) => {
        const r = await page.request.post("/api/v1/commands", {
          data: { action, payload, requestId: crypto.randomUUID() },
        });
        const b = await r.json();
        expect(r.ok(), JSON.stringify(b)).toBe(true);
        return b.data;
      };
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      const seller = (
        await (await page.request.get("/api/v1/seller/" + cid)).json()
      ).data;
      const original = seller.offers.find((o: any) => o.status === "published");
      const created = await command("package.save", {
        catererId: cid,
        slug: `slack34-${locale}-${width}-${Date.now()}`,
        offer: {
          ...original,
          name: `Synthetic Slack 34 ${locale} ${width}`,
          days: 5,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          capacity: { 0: 100, 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 },
          durationPricing: {
            revision: 0,
            options: [
              { cycles: 1, discountPercent: 0 },
              { cycles: 2, discountPercent: 5 },
            ],
          },
        },
      });
      await page.request.post("/api/v1/auth/demo", {
        data: { role: "customer" },
      });
      const customer = (
        await (await page.request.get("/api/v1/customer")).json()
      ).data;
      const input = {
        packageId: created.id,
        addressId: customer.addresses[0].id,
        portions: 1,
        startDate: addDays(localDay(), 10),
        cycles: 2,
        trial: false,
      };
      const denied = await page.request.post("/api/v1/commands", {
        data: {
          action: "checkout.create",
          payload: input,
          requestId: crypto.randomUUID(),
        },
      });
      expect(denied.ok()).toBe(false);
      expect(JSON.stringify(await denied.json())).toContain("TERMS_REQUIRED");
      await page.clock.setFixedTime(new Date(`${localDay()}T23:59:00+07:00`));
      await page.goto(
        `/checkout/${created.id}?cycles=2&startDate=${input.startDate}`,
      );
      await page
        .getByRole("button", {
          name: t("Mulai tanggal", "Start date"),
          exact: true,
        })
        .click();
      await expect(
        page.locator(`[data-calendar-day="${localDay()}"]`),
      ).toBeDisabled();
      await expect(
        page.locator(`[data-calendar-day="${addDays(localDay(), 1)}"]`),
      ).toBeDisabled();
      await expect(
        page.locator(`[data-calendar-day="${addDays(localDay(), 2)}"]`),
      ).toBeEnabled();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {
          name: t("Tinjau jadwal & harga", "Review schedule & price"),
          exact: true,
        })
        .click();
      await expect(
        page.getByText(t("Pengantaran pertama", "First delivery"), {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(t("Pengantaran terakhir", "Last delivery"), {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".purchase-schedule details")).toHaveCount(2);
      const pay = page.getByRole("button", {
        name: t("Lanjutkan ke pembayaran", "Continue to payment"),
        exact: true,
      });
      await expect(pay).toBeDisabled();
      const consent = page.getByRole("checkbox", { name: /Syarat|Terms/ });
      await consent.check();
      await expect(pay).toBeEnabled();
      await consent.uncheck();
      await expect(pay).toBeDisabled();
      await consent.check();
      await page
        .getByRole("button", { name: t("Ubah", "Edit"), exact: true })
        .click();
      await page
        .getByRole("button", {
          name: t("Tinjau jadwal & harga", "Review schedule & price"),
          exact: true,
        })
        .click();
      await expect(consent).not.toBeChecked();
      await expect(pay).toBeDisabled();
      await page.screenshot({
        path: `output/slack-bugs/0028-0034/two-cycles-${locale}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await consent.check();
      await pay.click();
      await page.waitForURL(/\/payment\//);
      const checkout = (
        await (
          await page.request.get(
            "/api/v1/checkouts/" + page.url().split("/").at(-1),
          )
        ).json()
      ).data;
      expect(checkout.quote.cycles).toBe(2);
      expect(checkout.quote.dates).toHaveLength(10);
      expect(checkout.terms_accepted_at).toBeTruthy();
      await command("checkout.demo_pay", { id: checkout.id });
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      await page.route("**/api/v1/seller/" + cid + "**", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const paid = body.data.transactions.find(
          (r: any) => r.id === checkout.id,
        );
        expect(paid).toBeTruthy();
        body.data.transactions = [
          paid,
          ...["failed", "expired"].map((state, i) => ({
            ...paid,
            id: `attempt-${i}`,
            state,
            created_at: new Date(
              new Date(paid.created_at).getTime() - (2 - i) * 1000,
            ).toISOString(),
          })),
        ];
        await route.fulfill({ response, json: body });
      });
      await page.goto("/seller/transactions");
      await page
        .getByRole("tab", { name: t("Penjualan", "Sales"), exact: true })
        .click();
      await expect(page.locator(".settlement-purchases tbody tr")).toHaveCount(
        1,
      );
      await page
        .getByText(t("3 percobaan pembayaran", "3 payment attempts"), {
          exact: true,
        })
        .click();
      await expect(page.locator(".record-details li")).toHaveCount(3);
      await page.screenshot({
        path: `output/slack-bugs/0028-0034/sales-${locale}-${width}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
for (const locale of ["id", "en"])
  for (const width of [390, 1440])
    test(`multi-cycle purchase and early renewal ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      const command = async (action: string, payload: unknown) => {
        const response = await page.request.post("/api/v1/commands", {
          data: { action, payload, requestId: crypto.randomUUID() },
        });
        const body = await response.json();
        expect(response.ok(), JSON.stringify(body)).toBe(true);
        return body.data;
      };
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      const seller = (
        await (await page.request.get("/api/v1/seller/" + cid)).json()
      ).data;
      const original = seller.offers.find((o: any) => o.status === "published");
      const name = `Synthetic duration ${locale} ${width} ${Date.now()}`;
      const created = await command("package.save", {
        catererId: cid,
        slug: "cycles-" + locale + width + "-" + Date.now(),
        offer: {
          ...original,
          name,
          days: 20,
          durationPricing: {
            revision: 0,
            options: [{ cycles: 1, discountPercent: 0 }],
          },
        },
      });
      await page.goto("/seller/packages");
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
      await card
        .getByRole("button", {
          name: t("Durasi & diskon paket", "Duration options & savings"),
        })
        .click();
      const editor = page.getByRole("dialog").locator(".duration-editor");
      await editor
        .getByRole("checkbox", { name: /3 (periode|cycles)/ })
        .check();
      await editor
        .getByRole("spinbutton", {
          name: t("Diskon (%)", "Discount (%)"),
        })
        .last()
        .fill("5");
      await editor
        .getByRole("button", {
          name: t("Simpan pilihan durasi", "Save duration options"),
          exact: true,
        })
        .click();
      await expect
        .poll(async () => {
          const s = (
            await (await page.request.get("/api/v1/seller/" + cid)).json()
          ).data;
          return s.offers.find((o: any) => o.id === created.id)?.durationPricing
            .options.length;
        })
        .toBe(2);
      await page.request.post("/api/v1/auth/demo", {
        data: { role: "customer" },
      });
      await page.goto(
        "/checkout/" +
          created.id +
          "?cycles=3&portions=2&startDate=" +
          addDays(localDay(), 30),
      );
      await expect(
        page.getByRole("combobox", {
          name: t("Durasi paket", "Package duration"),
        }),
      ).toContainText("60");
      await expect(page.getByRole("textbox", { name: /promo/i })).toHaveCount(
        0,
      );
      await page
        .getByRole("button", {
          name: t("Tinjau jadwal & harga", "Review schedule & price"),
          exact: true,
        })
        .click();
      await expect(
        page.getByText(t("Dibayar penuh di awal", "Paid in full upfront"), {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".purchase-schedule details")).toHaveCount(3);
      await expect(
        page.locator(".purchase-schedule .schedule-preview > div"),
      ).toHaveCount(60);
      await expect(
        page.getByText(
          t("Diskon durasi paket", "Multi-cycle discount") + " (5%)",
          { exact: true },
        ),
      ).toBeVisible();
      await mkdir("output/slack-bugs/0028-0034", { recursive: true });
      await page.screenshot({
        path: `output/slack-bugs/0028-0034/checkout-${locale}-${width}.png`,
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        axe.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact || ""),
        ),
      ).toEqual([]);
      await page
        .getByRole("checkbox", {
          name: t(
            "Saya menyetujui Syarat & Ketentuan pembelian, termasuk jadwal, alamat, harga, dan aturan paket yang ditampilkan.",
            "I accept the purchase Terms & Conditions, including the displayed schedule, address, price, and package rules.",
          ),
        })
        .check();
      await page
        .getByRole("button", {
          name: t("Lanjutkan ke pembayaran", "Continue to payment"),
          exact: true,
        })
        .click();
      await page.waitForURL(/\/payment\//);
      const id = page.url().split("/").at(-1)!;
      const c = (
        await (await page.request.get("/api/v1/checkouts/" + id)).json()
      ).data;
      expect(c.quote.cycles).toBe(3);
      expect(c.quote.dates).toHaveLength(60);
      await page
        .getByRole("button", {
          name: t(
            "Simulasikan pembayaran berhasil",
            "Simulate successful payment",
          ),
          exact: true,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await (await page.request.get("/api/v1/checkouts/" + id)).json())
              .data.subscription_id,
        )
        .toBeTruthy();
      const paid = (
        await (await page.request.get("/api/v1/checkouts/" + id)).json()
      ).data;
      await page.goto("/renew/" + paid.subscription_id);
      await expect(
        page.getByRole("heading", {
          name: t("Siapkan paket berikutnya", "Prepare your next package"),
        }),
      ).toBeVisible();
      const renewal = (
        await (
          await page.request.get(
            "/api/v1/renewal-context/" + paid.subscription_id + "?cycles=3",
          )
        ).json()
      ).data;
      expect(renewal.startDate > c.quote.dates.at(-1)).toBe(true);
      expect(renewal.dates).toHaveLength(60);
      await page
        .getByRole("button", {
          name: t(
            "Gunakan alamat & tinjau pembelian",
            "Use address & review purchase",
          ),
        })
        .click();
      await expect(
        page.getByRole("link", { name: "Continue to checkout" }),
      ).toHaveCount(0);
      await page.waitForURL(/renewedFrom=/);
      expect(errors).toEqual([]);
    });
test("settlement owner read and admin rollout controls", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller/transactions");
  await expect(
    page.getByRole("heading", { name: "Earnings & payouts" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Earnings overview" })
      .getByText("Paid out · to bank", { exact: true }),
  ).toBeVisible();
  await page.request.post("/api/v1/auth/demo", {
    data: { role: "platform_admin" },
  });
  await page.goto("/admin/settlement");
  await expect(
    page.getByRole("heading", { name: "Rollout controls" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Automatic payout dispatch" }),
  ).not.toBeChecked();
  await page.getByRole("combobox", { name: "Caterer", exact: true }).click();
  await page.getByRole("option").filter({ hasText: "Dapur Senja" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Minimum payout (IDR)" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/slack-bugs/0028-0034/settlement-admin.png",
    fullPage: true,
  });
});
