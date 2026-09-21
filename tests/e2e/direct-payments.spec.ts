import { test, expect } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import type { Checkout, DirectPaymentMethod } from "@catera/domain";
const id = "99999999-1111-4111-8111-111111111111";
// UI contract fixtures only. Provider and transactional tests live in doku-direct.test.ts.
function qr(total: number) {
  const a = String(total),
    text = `000201010212530336054${String(a.length).padStart(2, "0")}${a}5802ID5906Catera6007Jakarta6304`;
  let crc = 0xffff;
  for (const byte of Buffer.from(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return text + crc.toString(16).toUpperCase().padStart(4, "0");
}
for (const locale of ["id", "en"])
  for (const width of [390, 1440])
    for (const method of [
      "VIRTUAL_ACCOUNT_BRI",
      "QRIS",
    ] as DirectPaymentMethod[]) {
      test(`${locale} ${width} ${method}: select, persist, pay without hosted checkout`, async ({
        page,
        baseURL,
      }) => {
        const t = (id: string, en: string) => (locale === "id" ? id : en);
        await page
          .context()
          .addCookies([
            { name: "catera_locale", value: locale, url: baseURL! },
          ]);
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.setViewportSize({ width, height: 900 });
        await page.request.post("/api/v1/auth/demo", {
          data: { role: "customer" },
        });
        const errors: string[] = [],
          external: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (/doku\.com/.test(request.url())) external.push(request.url());
        });
        const deadline = new Date(Date.now() + 10 * 60000).toISOString();
        let checkout = {
          id,
          state: "pending",
          provider: "doku",
          provider_environment: "sandbox",
          payment_mode: "direct",
          payment_url: null,
          subscription_id: null,
          expires_at: deadline,
          quote: {
            total: 162500,
            offer: { name: "Paket makan Catera" },
            portions: 1,
            dates: ["2026-10-01"],
            cycles: 1,
          },
          payment: {
            mode: "direct",
            availableMethods: ["VIRTUAL_ACCOUNT_BRI", "QRIS"],
            selectedMethod: null,
            status: "choose_method",
            expiresAt: deadline,
            instructions: null,
          },
        } as Checkout;
        let starts = 0;
        await page.route(`**/api/v1/checkouts/${id}`, (route) =>
          route.fulfill({ json: { data: checkout } }),
        );
        await page.route("**/api/v1/commands", async (route) => {
          const request = route.request().postDataJSON();
          if (request.action === "checkout.payment.start") {
            starts++;
            expect(request.payload.method).toBe(method);
            checkout = {
              ...checkout,
              payment: {
                ...checkout.payment!,
                selectedMethod: method,
                status: "awaiting_payment",
                instructions:
                  method === "QRIS"
                    ? { kind: "qris", qrContent: qr(162500) }
                    : {
                        kind: "virtual_account",
                        bank: "BRI",
                        accountName: "Catera",
                        accountNumber: "12345600000001",
                      },
              },
            };
            await route.fulfill({ json: { data: checkout } });
          } else if (request.action === "checkout.payment.refresh") {
            checkout = {
              ...checkout,
              state: "paid",
              subscription_id: "99999999-2222-4222-8222-222222222222",
            };
            await route.fulfill({ json: { data: checkout } });
          } else await route.continue();
        });
        await page.goto(`/payment/${id}`);
        const show = page.getByRole("button", {
          name: t(
            "Tampilkan instruksi pembayaran",
            "Show payment instructions",
          ),
        });
        await expect(show).toBeDisabled();
        await page
          .getByRole("radio", {
            name: new RegExp(
              method === "QRIS" ? "QRIS" : "BRI Virtual Account",
            ),
          })
          .focus();
        await page.keyboard.press("Space");
        await show.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("radio")).toHaveCount(0);
        if (method === "QRIS") {
          const image = page.getByRole("img", {
            name: t(
              "Kode QRIS untuk pembayaran pesanan ini",
              "QRIS code for this order",
            ),
          });
          await expect(image).toBeVisible();
          const downloadEvent = page.waitForEvent("download");
          await page
            .getByRole("link", { name: t("Unduh QRIS", "Download QRIS") })
            .click();
          const download = await downloadEvent;
          expect(download.suggestedFilename()).toBe(`catera-qris-${id}.png`);
          const png = PNG.sync.read(await readFile((await download.path())!));
          expect(
            jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
          ).toBe(qr(162500));
        } else {
          await expect(
            page.getByText("12345600000001", { exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: t("Salin", "Copy"), exact: true })
            .click();
          await expect(
            page.getByText(t("Nomor disalin.", "Number copied."), {
              exact: true,
            }),
          ).toBeVisible();
          expect(
            await page.evaluate(() => navigator.clipboard.readText()),
          ).toBe("12345600000001");
        }
        await page.reload();
        await expect(
          page.getByRole("heading", {
            name: method === "QRIS" ? "QRIS" : "BRI Virtual Account",
            exact: true,
          }),
        ).toBeVisible();
        expect(starts).toBe(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const audit = await new AxeBuilder({ page })
          .include(".direct-payment")
          .analyze();
        expect(audit.violations).toEqual([]);
        await mkdir("output/direct-payments", { recursive: true });
        await page.screenshot({
          path: `output/direct-payments/${locale}-${width}-${method}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", {
            name: t("Periksa status", "Check status"),
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("heading", {
            name: t(
              "Makanan baik sudah dijadwalkan.",
              "Good meals are on the calendar.",
            ),
          }),
        ).toBeVisible();
        expect(external).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
test("expired and uncertain payments never expose old instructions or hosted fallback", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  let expiry = new Date(Date.now() + 600000).toISOString();
  await page.route(`**/api/v1/checkouts/${id}`, (route) =>
    route.fulfill({
      json: {
        data: {
          id,
          state: "pending",
          expires_at: expiry,
          payment_mode: "direct",
          payment_url: "https://staging.doku.com/checkout/never-open",
          quote: { total: 10000, offer: { name: "Synthetic" }, portions: 1 },
          payment: {
            mode: "direct",
            selectedMethod: "QRIS",
            availableMethods: [],
            status: "checking",
            expiresAt: expiry,
            instructions: null,
          },
        },
      },
    }),
  );
  await page.goto(`/payment/${id}`);
  await expect(
    page.getByText(/Kami sedang memeriksa pembayaran/),
  ).toBeVisible();
  await expect(page.locator('a[href*="doku.com"]')).toHaveCount(0);
  expiry = new Date(Date.now() - 1000).toISOString();
  await page.reload();
  await expect(page.getByText(/Batas pembayaran telah lewat/)).toBeVisible();
  await expect(page.getByRole("img", { name: /QRIS/ })).toHaveCount(0);
});
test("visible-page polling pauses in background and refreshes immediately on return", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const expiry = new Date(Date.now() + 600000).toISOString();
  let reads = 0;
  await page.route(`**/api/v1/checkouts/${id}`, (route) => {
    reads++;
    return route.fulfill({
      json: {
        data: {
          id,
          state: "pending",
          expires_at: expiry,
          payment_mode: "direct",
          payment_url: null,
          quote: { total: 10000, offer: { name: "Synthetic" }, portions: 1 },
          payment: {
            mode: "direct",
            selectedMethod: "QRIS",
            availableMethods: [],
            status: "checking",
            expiresAt: expiry,
            instructions: null,
          },
        },
      },
    });
  });
  await page.clock.install();
  await page.goto(`/payment/${id}`);
  await expect(
    page.getByText(/Kami sedang memeriksa pembayaran/),
  ).toBeVisible();
  const initial = reads;
  await page.clock.runFor(5500);
  await expect.poll(() => reads).toBeGreaterThan(initial);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = reads;
  await page.clock.runFor(11000);
  expect(reads).toBe(hidden);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBeGreaterThan(hidden);
});
