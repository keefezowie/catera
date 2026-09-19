import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addDays, localDay } from "@catera/domain";
import { mkdir } from "node:fs/promises";
const cid = "10000000-0000-4000-8000-000000000001";
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
      const editor = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
        .locator(".duration-editor");
      await editor.locator("summary").click();
      await editor
        .getByRole("checkbox", { name: /3 (periode|cycles)/ })
        .check();
      await editor
        .getByRole("spinbutton", {
          name: t("Diskon durasi (%)", "Multi-cycle discount (%)"),
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
      await mkdir("output/usability-overhaul/multi-cycle", { recursive: true });
      await page.screenshot({
        path: `output/usability-overhaul/multi-cycle/checkout-${locale}-${width}.png`,
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
            "Saya sudah memeriksa jadwal, alamat, dan aturan paket.",
            "I have reviewed the schedule, address, and package rules.",
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
      await page
        .getByRole("link", {
          name: t("Lanjutkan ke pembayaran", "Continue to checkout"),
        })
        .click();
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
      .getByText("Paid out", { exact: true }),
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
    path: "output/usability-overhaul/multi-cycle/settlement-admin.png",
    fullPage: true,
  });
});
