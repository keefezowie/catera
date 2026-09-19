import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  addDays,
  currency,
  localDay,
  type Offer,
  type Quote,
} from "@catera/domain";
import { mkdir } from "node:fs/promises";

const evidence = "output/playwright/uiux/verified";
async function accessible(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

for (const width of [320, 390, 768, 1440])
  for (const locale of ["id", "en"] as const) {
    test(`discovery recovery and navigation preserve intent ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const catalog: Offer[] = (
        await (await page.request.get("/api/v1/catalog?limit=100")).json()
      ).data.items;
      await page.goto(
        "/?q=Ayam&type=nasi_box&meal=lunch&flexible=1&sort=price&campaign=ux#packages",
      );
      const search = page.getByRole("searchbox", {
        name: t("Cari katering", "Search caterers"),
      });
      await expect(search).toHaveValue("Ayam");
      await expect(page.locator(".applied-filters .filter-chip")).toHaveCount(
        4,
      );
      await expect(
        page.getByRole("button", {
          name: t("Makan siang", "Lunch"),
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      const cards = page.locator(".package-card");
      await expect(cards.first()).toBeVisible();
      const names = await cards.locator("h3").allTextContents();
      await cards
        .first()
        .getByRole("link", {
          name: t("Lihat paket", "View package"),
          exact: true,
        })
        .click();
      await expect(page.locator(".package-detail")).toBeVisible();
      const photo = (await page.locator(".detail-hero").boundingBox())!;
      expect(photo.height).toBeLessThanOrEqual(photo.width * 0.8 + 1);
      if (width <= 1000)
        await expect(page.locator(".package-booking-jump")).toBeVisible();
      await page.goBack();
      await expect(search).toHaveValue("Ayam");
      await expect(cards.locator("h3")).toHaveText(names);
      await page.reload();
      await expect(page.locator(".applied-filters .filter-chip")).toHaveCount(
        4,
      );
      await page
        .getByRole("button", {
          name: t("Hapus filter: Nasi box", "Remove filter: Rice box"),
          exact: true,
        })
        .click();
      await expect(page).not.toHaveURL(/[?&]type=/);
      await expect(search).toHaveValue("Ayam");
      await page.getByRole("button", { name: /^Filter/ }).click();
      await page
        .getByRole("combobox", {
          name: t("Jenis paket", "Package type"),
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: t("Nasi box", "Rice box"), exact: true })
        .click();
      await search.fill("No such meal xyz");
      await expect(cards).toHaveCount(0);
      await accessible(page);
      await page
        .getByRole("button", {
          name: t(
            "Hapus filter & lihat paket",
            "Clear filters & browse packages",
          ),
          exact: true,
        })
        .click();
      await expect(cards).toHaveCount(catalog.length);
      await expect(search).toBeFocused();
      await expect(page.locator(".applied-filters")).toHaveCount(0);
      await expect(
        page.getByRole("combobox", {
          name: t("Jenis paket", "Package type"),
          exact: true,
        }),
      ).toContainText(t("Semua jenis", "All types"));
      expect(new URL(page.url()).searchParams.get("sort")).toBe("price");
      expect(new URL(page.url()).searchParams.get("campaign")).toBe("ux");
      const first = cards.first();
      expect(
        (await first.locator(".card-price").boundingBox())!.y,
      ).toBeLessThan(
        (await first.locator(".package-preview").boundingBox())!.y,
      );
      await accessible(page);
      await mkdir(evidence, { recursive: true });
      await page.locator("#packages").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${evidence}/discovery-${locale}-${width}.png`,
      });
    });

    test(`checkout shows the destination and confirmed price ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      const login = await page.request.post("/api/v1/auth/demo", {
        data: { role: "customer" },
      });
      expect(login.ok()).toBe(true);
      const state = (await (await page.request.get("/api/v1/customer")).json())
        .data;
      await page.goto(
        `/checkout/20000000-0000-4000-8000-000000000001?startDate=${addDays(localDay(), 90)}`,
      );
      const summary = page.getByRole("complementary", {
        name: t("Ringkasan paket", "Package summary"),
      });
      await expect(summary).toContainText(t("Subtotal dasar", "Base subtotal"));
      if (width < 700)
        expect((await summary.boundingBox())!.y).toBeLessThan(
          (await page.locator(".checkout-fields").boundingBox())!.y,
        );
      await accessible(page);
      const quoteResponse = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/v1/quote") && r.request().method() === "POST",
      );
      await page
        .getByRole("button", {
          name: t("Tinjau jadwal & harga", "Review schedule & price"),
          exact: true,
        })
        .click();
      const response = await quoteResponse;
      expect(response.ok(), await response.text()).toBe(true);
      const quote: Quote = (await response.json()).data;
      await expect(
        page.getByRole("heading", {
          name: t("Jadwal makananmu", "Your meal schedule"),
          exact: true,
        }),
      ).toBeFocused();
      await expect(page.locator(".checkout-address")).toContainText(
        state.addresses[0].line,
      );
      await expect(summary.locator(".total-row")).toContainText(
        currency(quote.total, locale),
      );
      await expect(page.locator(".checkout-actions")).toContainText(
        currency(quote.total, locale),
      );
      await expect(
        page.locator('.checkout-steps [aria-current="step"]'),
      ).toHaveText("2. " + t("Tinjau paket", "Review package"));
      await page
        .getByRole("checkbox", {
          name: t(
            "Saya sudah memeriksa jadwal, alamat, dan aturan paket.",
            "I have reviewed the schedule, address, and package rules.",
          ),
        })
        .check();
      const pay = page.getByRole("button", {
        name: t("Lanjutkan ke pembayaran", "Continue to payment"),
        exact: true,
      });
      await pay.scrollIntoViewIfNeeded();
      if (width < 600) {
        const button = (await pay.boundingBox())!;
        const nav = (await page.locator(".mobile-bottom").boundingBox())!;
        expect(button.y + button.height).toBeLessThanOrEqual(nav.y + 1);
      }
      await accessible(page);
      await mkdir(evidence, { recursive: true });
      await page.screenshot({
        path: `${evidence}/checkout-${locale}-${width}.png`,
      });
      await page
        .getByRole("button", { name: t("Ubah", "Edit"), exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: t("Paket untuk siapa saja?", "How many are eating?"),
          exact: true,
        }),
      ).toBeFocused();
    });
  }

test("food images serve responsive derivatives", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const photo = page.locator(".featured-slide .hero-food img").first();
  await expect(photo).toHaveAttribute("srcset", /_next\/image/);
  await expect
    .poll(() =>
      photo.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const imageURL = await photo.evaluate(
    (el: HTMLImageElement) => el.currentSrc,
  );
  const optimized = await page.request.get(imageURL, {
    headers: { Accept: "image/webp" },
  });
  expect(optimized.ok()).toBe(true);
  expect((await optimized.body()).length).toBeLessThan(200000);
});

test("populated comparison supports keyboard scrolling and logical headings", async ({
  page,
}) => {
  const catalog: Offer[] = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items;
  const selected = catalog.filter((p) =>
    [
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000003",
    ].includes(p.id),
  );
  expect(selected).toHaveLength(2);
  await page.goto("/#packages");
  for (const offer of selected)
    await page
      .getByRole("button", { name: "Bandingkan: " + offer.name, exact: true })
      .click();
  await page.getByRole("link", { name: "Bandingkan", exact: true }).click();
  const comparison = page.getByRole("region", {
    name: "Perbandingan paket",
    exact: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(comparison.getByRole("heading", { level: 2 })).toHaveCount(2);
    await comparison.focus();
    await expect(comparison).toBeFocused();
    if (width <= 390) {
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => comparison.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0);
      const label = (await comparison.locator("tbody th").first().boundingBox())!;
      const region = (await comparison.boundingBox())!;
      expect(label.x).toBeGreaterThanOrEqual(region.x - 1);
      expect(label.x + label.width).toBeLessThanOrEqual(region.x + region.width);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21aa",
            "wcag22aa",
            "best-practice",
          ])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await comparison.evaluate((el) => { el.scrollLeft = 0; });
    await comparison.blur();
    await page.screenshot({ path: `${evidence}/comparison-id-${width}.png` });
  }
});
