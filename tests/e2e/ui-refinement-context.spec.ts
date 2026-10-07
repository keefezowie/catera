import { expect, test, type Locator, type Page } from "@playwright/test";
import { addDays, localDay } from "@catera/domain";
import { mkdir } from "node:fs/promises";

const evidence = "output/playwright/ui-refinement-2026-09-30/context";
const catererId = "10000000-0000-4000-8000-000000000001";
test.beforeAll(() => mkdir(evidence, { recursive: true }));

async function login(page: Page, role: string) {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

async function containedText(target: Locator) {
  const escaped = await target.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const problems: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (
          rect.width &&
          (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
        )
          problems.push(node.textContent);
      }
    }
    return problems;
  });
  expect(escaped).toEqual([]);
}

for (const locale of ["id", "en"] as const) {
  for (const width of [390, 768, 1440]) {
    const t = (id: string, en: string) => (locale === "id" ? id : en);
    test.describe(`${locale} ${width}`, () => {
      test.beforeEach(async ({ context, baseURL, page }) => {
        await context.addCookies([
          { name: "catera_locale", value: locale, url: baseURL! },
        ]);
        await page.setViewportSize({ width, height: 900 });
      });

      test(`${locale} ${width}: purchased deadlines retain keyboard access and distinct cutoff states`, async ({
        page,
      }) => {
        await login(page, "owner");
        // Find a persisted synthetic delivery date so a long sweep remains
        // valid when it crosses the caterer's midnight.
        const today = localDay();
        const calendarResponse = await page.request.get(
          `/api/v1/seller-calendar/${catererId}?from=${addDays(today, -10)}&to=${addDays(today, 10)}`,
        );
        expect(calendarResponse.ok()).toBe(true);
        const calendar = (await calendarResponse.json()).data;
        const day = calendar.days.find(
          (entry: { date: string; orders: number }) => entry.orders > 0,
        )?.date;
        expect(day).toBeTruthy();
        const response = await page.request.get(
          `/api/v1/seller/${catererId}?date=${day}`,
        );
        expect(response.ok()).toBe(true);
        const state = (await response.json()).data;
        expect(state.deliveries.length).toBeGreaterThan(0);
        const base = state.deliveries.find(
          (delivery: { status: string }) => delivery.status !== "cancelled",
        );
        expect(base).toBeTruthy();
        const deliveries = [
          { ...base, cutoff_at: `${addDays(today, -1)}T17:00:00+07:00` },
          {
            ...base,
            id: "eeeeeeee-1111-4111-8111-111111111111",
            cutoff_at: `${addDays(today, 1)}T17:00:00+07:00`,
          },
        ];
        await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
          route.fulfill({ json: { data: { ...state, deliveries } } }),
        );
        await page.goto(`/seller/schedule?date=${day}`);
        const deadlines = page.locator(".ops-deadlines");
        const summary = deadlines.locator(":scope > summary");
        await expect(summary).toContainText(
          t("2 batas berbeda", "2 different deadlines"),
        );
        await expect(summary).not.toContainText(day);
        expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(
          44,
        );
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(deadlines).toHaveAttribute("open", "");
        await expect(summary).toBeFocused();
        await expect(deadlines.locator(".ops-deadline-list")).toContainText(
          t("Sudah lewat", "Passed"),
        );
        await expect(deadlines.locator(".ops-deadline-list")).toContainText(
          t("Belum lewat", "Not yet passed"),
        );
        await expect(deadlines).toContainText("Asia/Jakarta");
        await expect(deadlines).toContainText(
          t("tidak mengunci", "do not lock"),
        );
        await containedText(deadlines);
        await page.screenshot({
          path: `${evidence}/deadlines-${locale}-${width}.png`,
          fullPage: true,
        });
        await page.keyboard.press("Space");
        await expect(deadlines).not.toHaveAttribute("open");
        await expect(summary).toBeFocused();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      });

      test(`${locale} ${width}: claim shows the package first, verifies the phone and keeps both results readable`, async ({
        page,
      }) => {
        await login(page, "customer");
        let result = "review";
        let verified = false;
        // Synthetic preview: the demo database holds no claim link for this token.
        await page.route("**/api/v1/claim-preview/**", (route) =>
          route.fulfill({
            json: {
              data: {
                catererName: "Dapur Contoh",
                packageName: "Makan Siang Rumahan",
                remainingDays: 9,
                nextDate: addDays(localDay(), 1),
                nextWindow: "11.00–13.00",
                addressLabel: "Kantor Sudirman",
                maskedPhone: "0812-•••-0001",
              },
            },
          }),
        );
        await page.route("**/api/v1/auth/phone-*", (route) => {
          if (route.request().url().endsWith("phone-verify")) verified = true;
          return route.fulfill({ json: { data: { sent: true } } });
        });
        await page.route("**/api/v1/commands", (route) => {
          if (route.request().postDataJSON().action !== "customer.claim")
            return route.continue();
          return verified
            ? route.fulfill({ json: { data: { status: result } } })
            : route.fulfill({
                status: 403,
                json: { error: { code: "PHONE_VERIFICATION_REQUIRED" } },
              });
        });
        await page.goto("/claim/synthetic-context-refinement");
        const claim = page.locator("section.claim");
        await expect(claim).toContainText(t("Dari Dapur Contoh", "From Dapur Contoh"));
        await expect(page.locator('section.claim input[type="tel"]')).toHaveCount(0);
        await containedText(claim);
        const next = t("Lanjut dengan 0812-•••-0001", "Continue with 0812-•••-0001");
        await page.getByRole("button", { name: next, exact: true }).click();
        await page
          .getByLabel(t("Nomor HP", "Phone number"), { exact: true })
          .fill("081234500001");
        await page
          .getByRole("button", { name: t("Kirim kode", "Send code"), exact: true })
          .click();
        await page.getByLabel(t("Kode", "Code"), { exact: true }).fill("123456");
        await containedText(claim);
        await page
          .getByRole("button", {
            name: t("Sambungkan langganan", "Connect subscription"),
            exact: true,
          })
          .click();
        const notice = page.locator("section.claim > .notice[role=status]");
        await expect(notice).toContainText(
          t("perlu memeriksa", "needs to check"),
        );
        await containedText(notice);
        await page.screenshot({
          path: `${evidence}/claim-review-${locale}-${width}.png`,
          fullPage: true,
        });
        result = "claimed";
        await page.reload();
        await page.getByRole("button", { name: next, exact: true }).click();
        await expect(page.locator("section.claim h1")).toContainText(
          t("Tersambung", "Connected"),
        );
        await expect(
          page.getByRole("link", {
            name: t(
              "Lihat jadwal di browser saja",
              "Just view the schedule in the browser",
            ),
            exact: true,
          }),
        ).toHaveAttribute("href", "/home");
        await containedText(claim);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      });

      test(`${locale} ${width}: renewal unavailable and replacement states keep a readable purchase context`, async ({
        page,
      }) => {
        await login(page, "customer");
        const customer = (
          await (await page.request.get("/api/v1/customer")).json()
        ).data;
        const id = customer.subscriptions[0].id;
        const original = (
          await (
            await page.request.get(`/api/v1/renewal-context/${id}?cycles=1`)
          ).json()
        ).data;
        let data = { ...original, available: false };
        await page.route("**/api/v1/renewal-context/**", (route) =>
          route.fulfill({ json: { data } }),
        );
        await page.goto(`/renew/${id}`);
        const panel = page.locator("section.panel");
        await expect(panel.getByRole("status")).toContainText(
          t("Belum ada jadwal lengkap", "No complete schedule"),
        );
        await expect(
          panel.getByRole("button", {
            name: t(
              "Gunakan alamat & tinjau pembelian",
              "Use address & review purchase",
            ),
            exact: true,
          }),
        ).toBeDisabled();
        await expect(panel.locator(".facts").first()).toContainText(
          original.address.area,
        );
        await expect(panel.locator(".facts").first()).not.toContainText(
          original.startDate,
        );
        await containedText(panel);
        await page.screenshot({
          path: `${evidence}/renew-unavailable-${locale}-${width}.png`,
          fullPage: true,
        });
        data = {
          ...original,
          available: false,
          replacementRequired: true,
          offers: [],
        };
        await page.reload();
        await expect(panel).toContainText(
          t("Paket lama tidak dijual", "Your previous package is unavailable"),
        );
        await expect(
          panel.getByRole("button", {
            name: t(
              "Gunakan alamat & tinjau pembelian",
              "Use address & review purchase",
            ),
            exact: true,
          }),
        ).toBeDisabled();
        await containedText(panel);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      });
    });
  }
}
