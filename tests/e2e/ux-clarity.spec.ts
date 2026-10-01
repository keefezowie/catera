import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  addDays,
  localDay,
  areaOptions,
  type CustomerActionItem,
  type Offer,
  type SellerCalendar,
  type SellerOperationsState,
} from "@catera/domain";

const catererId = "10000000-0000-4000-8000-000000000001";
type Locale = "id" | "en";
const copy = (locale: Locale, id: string, en: string) =>
  locale === "id" ? id : en;

async function login(
  page: Page,
  baseURL: string,
  locale: Locale,
  role = "customer",
) {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL).hostname);
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: locale, url: baseURL }]);
  expect(
    (await page.request.post("/api/v1/auth/demo", { data: { role } })).ok(),
  ).toBe(true);
}

function action(
  status: CustomerActionItem["status"],
  id: string = status,
): CustomerActionItem {
  return {
    id,
    status,
    kind:
      status === "selection_due"
        ? "menu_choice_due"
        : ["open", "responded", "escalated"].includes(status)
          ? "delivery_issue"
          : "payment_action",
    priority: 1,
    packageName: `Synthetic ${id}`,
    catererName: "Synthetic caterer",
    href: `/payment/${id}`,
    ...(status === "selection_due"
      ? { dueAt: localDay() + "T17:00:00+07:00", href: "/calendar" }
      : {}),
  };
}

async function choose(page: Page, control: Locator, name: string) {
  await control.focus();
  await control.press("Enter");
  const option = page.getByRole("option", { name, exact: true });
  await option.click();
  await expect(control).toBeFocused();
}

async function fits(page: Page, surface: Locator) {
  const overflow = await page.evaluate(() => {
    if (document.documentElement.scrollWidth <= innerWidth + 1) return [];
    return Array.from(document.querySelectorAll("main *"))
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .map(
        (el) =>
          `${el.tagName}.${el.className}: ${el.textContent?.trim().slice(0, 90)}`,
      )
      .slice(0, 12);
  });
  expect(overflow).toEqual([]);
  // Controls must have room for their text, and adjacent controls must not overlap.
  const failures = await surface
    .locator("a.button, button:visible")
    .evaluateAll((elements) => {
      const controls = elements
        .filter((el) => el.getClientRects().length)
        .map((el) => ({
          label: el.textContent?.trim(),
          rect: el.getBoundingClientRect(),
          clipped: el.scrollWidth > el.clientWidth + 2,
        }));
      return controls.flatMap((a, index) => [
        ...(a.clipped ? [`clipped: ${a.label}`] : []),
        ...controls
          .slice(index + 1)
          .filter(
            (b) =>
              Math.min(a.rect.right, b.rect.right) -
                Math.max(a.rect.left, b.rect.left) >
                1 &&
              Math.min(a.rect.bottom, b.rect.bottom) -
                Math.max(a.rect.top, b.rect.top) >
                1,
          )
          .map((b) => `overlap: ${a.label} / ${b.label}`),
      ]);
    });
  expect(failures).toEqual([]);
}

async function doubleText(surface: Locator) {
  await surface.evaluate((root) => {
    const sizes = Array.from(root.querySelectorAll<HTMLElement>("*")).map(
      (element) => ({
        element,
        font: parseFloat(getComputedStyle(element).fontSize),
        line: parseFloat(getComputedStyle(element).lineHeight),
      }),
    );
    for (const { element, font, line } of sizes) {
      element.style.setProperty("font-size", `${font * 2}px`, "important");
      if (Number.isFinite(line))
        element.style.setProperty("line-height", `${line * 2}px`, "important");
    }
  });
}

for (const locale of ["id", "en"] as const) {
  const t = (id: string, en: string) => copy(locale, id, en);
  for (const width of [320, 390, 1440]) {
    test(`Home separates ownership, counts and deadline groups ${locale} ${width}`, async ({
      page,
      baseURL,
    }, info) => {
      await login(page, baseURL!, locale);
      await page.setViewportSize({ width, height: 1000 });
      let items = [
        action("payment_exception"),
        action("choose_method"),
        action("awaiting_payment"),
        action("responded"),
        action("selection_due"),
        action("checking_payment"),
        action("open"),
        action("escalated"),
        {
          ...action("selection_due", "future"),
          dueAt: addDays(localDay(), 8) + "T17:00:00+07:00",
        },
      ];
      await page.route("**/api/v1/customer-actions?**", (route) =>
        route.fulfill({ json: { data: { items, total: items.length } } }),
      );
      await page.goto("/home");
      const urgent = page.getByRole("region", {
        name: t("Perlu tindakan Anda", "Action needed"),
        exact: true,
      });
      const updates = page.getByRole("region", {
        name: t("Status pembayaran & kendala", "Payment and issue updates"),
        exact: true,
      });
      const review = page.getByRole("region", {
        name: t("Pemesanan perlu ditinjau", "Booking needs review"),
        exact: true,
      });
      const later = page.locator(".customer-actions.later");
      await expect(
        urgent.getByLabel(t("Jumlah tindakan", "Action count")),
      ).toHaveText("4");
      await expect(
        updates.getByLabel(t("Jumlah pembaruan", "Update count")),
      ).toHaveText("3");
      await expect(
        review.getByLabel(
          t("Jumlah pemesanan ditinjau", "Booking review count"),
        ),
      ).toHaveText("1");
      await expect(updates.locator(".action-count")).toHaveCount(0);
      await expect(review.locator(".action-count")).toHaveCount(0);
      await expect(urgent.locator("article")).toHaveCount(3);
      const expand = urgent.getByRole("button", {
        name: t("Lihat semua 4 tindakan", "View all 4 actions"),
      });
      await expand.focus();
      await expand.press("Enter");
      await expect(
        urgent.getByRole("button", {
          name: t("Tampilkan tiga teratas", "Show top three"),
        }),
      ).toBeFocused();
      await expect(urgent.locator("article")).toHaveCount(4);
      await expect(urgent).toContainText("Synthetic selection_due");
      await expect(later).toContainText("Synthetic future");
      await expect(
        updates.getByRole("link", {
          name: t("Periksa status", "Check status"),
        }),
      ).toHaveAttribute("href", "/payment/checking_payment");
      await expect(
        urgent.getByRole("link", {
          name: t("Lihat tanggapan", "View response"),
        }),
      ).toHaveAttribute("href", "/payment/responded");
      await expect(updates).not.toContainText(
        t("Pembayaran diterima", "Payment received"),
      );
      expect(
        await page
          .locator(".home-page > section")
          .evaluateAll((nodes) => nodes.map((el) => el.className)),
      ).toEqual([
        "customer-actions review",
        "customer-actions urgent",
        "next-meal-card",
        "customer-actions updates",
        "date-agenda",
        "customer-actions later",
        "active-packages home-subscriptions",
      ]);
      expect(
        (await new AxeBuilder({ page }).include(".home-page").analyze())
          .violations,
      ).toEqual([]);
      await fits(page, page.locator(".home-page"));
      await page.screenshot({
        path: info.outputPath(`home-${locale}-${width}.png`),
        fullPage: true,
      });
      await doubleText(page.locator(".home-page"));
      await fits(page, page.locator(".home-page"));
      await page.screenshot({
        path: info.outputPath(`home-text-200-${locale}-${width}.png`),
        fullPage: true,
      });

      items = [action("checking_payment"), action("open"), action("escalated")];
      await page.reload();
      await expect(updates.locator("article")).toHaveCount(3);
      await expect(page.locator(".action-count")).toHaveCount(0);
      await expect(urgent).toHaveCount(0);
      await expect(review).toHaveCount(0);
      await expect(later).toHaveCount(0);
    });

    test(`Coverage remains distinct from price and survives navigation ${locale} ${width}`, async ({
      page,
      baseURL,
    }, info) => {
      await login(page, baseURL!, locale);
      await page.setViewportSize({ width, height: 1000 });
      const offers: Offer[] = (
        await (await page.request.get("/api/v1/catalog?limit=100")).json()
      ).data.items;
      const offer = offers.find(
        (p) =>
          p.trialPrice &&
          p.areas.length &&
          areaOptions.some((area) => !p.areas.includes(area)),
      )!;
      expect(offer).toBeTruthy();
      const supported = offer.areas[0];
      const unsupported = areaOptions.find(
        (area) => !offer.areas.includes(area),
      )!;
      await page.goto("/#packages");
      const card = page.locator(".package-card").filter({
        has: page.getByRole("heading", { name: offer.name, exact: true }),
      });
      const area = page.getByRole("combobox", {
        name: t("Area pengantaran", "Delivery area"),
      });
      const booking = page.locator("#package-booking");
      const checkout = booking.getByRole("link", {
        name: t("Pilih paket ini", "Choose this package"),
        exact: true,
      });
      const trial = booking.getByRole("link", {
        name: new RegExp(t("Coba 1 hari", "Try 1 day")),
      });

      for (const coverage of [
        "unknown",
        "eligible",
        "outside",
        "cleared",
      ] as const) {
        if (coverage !== "unknown")
          await choose(
            page,
            area,
            coverage === "eligible"
              ? supported
              : coverage === "outside"
                ? unsupported
                : t("Pilih area Anda", "Choose your area"),
          );
        const message =
          coverage === "eligible"
            ? t(`Mengantar ke ${supported}.`, `Delivers to ${supported}.`)
            : coverage === "outside"
              ? t("Di luar area pengantaran.", "Outside delivery area.")
              : t(
                  "Pilih area untuk memeriksa jangkauan.",
                  "Choose an area to check delivery coverage.",
                );
        await expect(card.locator(".delivery-included")).toHaveText(
          t("Pengantaran termasuk", "Delivery included"),
        );
        await expect(card.locator(".delivery-coverage")).toHaveText(message);
        if (coverage === "outside") await expect(card).toHaveClass(/outside/);
        else await expect(card).not.toHaveClass(/outside/);
        await fits(page, card);
        await card
          .getByRole("link", {
            name: t("Lihat paket", "View package"),
            exact: true,
          })
          .click();
        await expect(booking).toBeVisible();
        await expect(booking.locator(".delivery-coverage")).toHaveText(
          coverage === "unknown" || coverage === "cleared"
            ? t(
                "Jangkauan pengantaran akan diperiksa setelah Anda memilih alamat saat checkout.",
                "Delivery coverage will be checked after you choose an address at checkout.",
              )
            : message,
        );
        if (coverage === "outside") {
          await expect(
            booking.getByRole("link", {
              name: t("Di luar area pengantaran", "Outside delivery area"),
              exact: true,
            }),
          ).toHaveAttribute("aria-disabled", "true");
          await expect(booking.locator('a[href^="/checkout/"]')).toHaveCount(0);
        } else {
          await expect(checkout).toHaveAttribute("aria-disabled", "false");
          await checkout.focus();
          await checkout.press("Enter");
          await expect(page).toHaveURL(
            new RegExp(`/checkout/${offer.id}\\?portions=1`),
          );
          await page.goBack();
          await trial.click();
          await expect(page).toHaveURL(
            new RegExp(`/checkout/${offer.id}\\?trial=1&portions=1`),
          );
          await page.goBack();
        }
        await fits(page, booking);
        await page.screenshot({
          path: info.outputPath(`coverage-${coverage}-${locale}-${width}.png`),
          fullPage: true,
        });
        if (coverage === "cleared") {
          await doubleText(page.locator(".package-detail"));
          await fits(page, booking);
        }
        await page.goBack();
        await page.reload();
        await expect(card.locator(".delivery-coverage")).toHaveText(message);
      }
      await doubleText(card);
      await fits(page, card);
    });

    test(`Seller shows all-package workload beside a zero filtered total ${locale} ${width}`, async ({
      page,
      baseURL,
    }, info) => {
      await login(page, baseURL!, locale, "owner");
      await page.setViewportSize({ width, height: 1000 });
      let state: SellerOperationsState = (
        await (await page.request.get(`/api/v1/seller/${catererId}`)).json()
      ).data;
      // A long-running demo may cross midnight after its fixture was seeded.
      // Select a populated day before copying a complete delivery into the mock.
      if (state.deliveries.length === 0) {
        const range = new URLSearchParams({
          from: addDays(state.today, -31),
          to: addDays(state.today, 31),
          meal: "all",
        });
        const calendar: SellerCalendar = (
          await (
            await page.request.get(`/api/v1/seller-calendar/${catererId}?${range}`)
          ).json()
        ).data;
        const populatedDay = calendar.days.find((entry) => entry.orders > 0)?.date;
        expect(
          populatedDay,
          "Synthetic seller fixture needs a populated day",
        ).toBeTruthy();
        state = (
          await (
            await page.request.get(`/api/v1/seller/${catererId}?date=${populatedDay}`)
          ).json()
        ).data;
      }
      expect(state.deliveries[0]?.customer).toBeTruthy();
      expect(state.deliveries[0]?.address).toBeTruthy();
      const day = state.operationalDate;
      const deliveries = [2, 5, 3].map((portions, i) => ({
        ...state.deliveries[0],
        id: `e2000000-0000-4000-8000-00000000000${i}`,
        portions,
        service_date: day,
        status: "scheduled",
        offer: state.offers[i === 0 ? 0 : 1],
        meals: (i === 2 ? ["dinner"] : ["lunch", "dinner"]).map((meal) => ({
          meal,
          status: "scheduled",
        })),
      }));
      await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
        route.fulfill({
          json: {
            data: {
              ...state,
              deliveries,
              operationalDate: day,
              latestProduction: null,
            },
          },
        }),
      );
      await page.goto(`/seller?date=${day}&meal=lunch&search=ZeroMatchingRows`);
      const workload = page.locator(".ops-workload");
      await expect(workload.getByRole("heading")).toHaveText(
        t(
          "Total siang · semua paket: 7 porsi",
          "Lunch total · all packages: 7 portions",
        ),
      );
      await expect(workload.locator(".ops-visible-summary")).toHaveText(
        t(
          "Sesuai filter: 0 baris terlihat · 0 pesanan · 0 porsi",
          "Matching filters: 0 visible rows · 0 orders · 0 portions",
        ),
      );
      await expect(
        workload.locator(".ops-stages button").first(),
      ).toContainText(t("7 porsi", "7 portions"));
      await fits(page, workload);
      await page.screenshot({
        path: info.outputPath(`seller-filtered-${locale}-${width}.png`),
        fullPage: true,
      });
      const dinner = page.getByRole("tab", {
        name: new RegExp(t("^Malam", "^Dinner")),
      });
      await dinner.focus();
      await dinner.press("Enter");
      await expect(workload.getByRole("heading")).toHaveText(
        t(
          "Total malam · semua paket: 10 porsi",
          "Dinner total · all packages: 10 portions",
        ),
      );
      await expect(workload.locator(".ops-visible-summary")).toContainText(
        t("0 porsi", "0 portions"),
      );
      await doubleText(workload);
      await fits(page, workload);
      await page.screenshot({
        path: info.outputPath(`seller-text-200-${locale}-${width}.png`),
        fullPage: true,
      });
      await page.goto(
        `/seller/schedule?date=${day}&production=1&package=${state.offers[0].id}`,
      );
      await expect(page.locator(".ops-scope-summary")).toContainText(
        t("1 pesanan · 4 porsi makan", "1 order · 4 meal portions"),
      );
      await expect(page.locator(".ops-scope-summary")).toContainText(
        t("Sesuai filter tabel", "Matching table filters"),
      );
      await expect(page.locator(".ops-production")).toContainText(
        t("17 porsi makan", "17 meal portions"),
      );
    });
  }

  test(`Feed loading, retry and truncation are reported once ${locale}`, async ({
    page,
    baseURL,
  }, info) => {
    await login(page, baseURL!, locale);
    await page.setViewportSize({ width: 320, height: 1000 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let fail = true;
    let items = Array.from({ length: 20 }, (_, i) =>
      action("checking_payment", `pending-${i}`),
    );
    await page.route("**/api/v1/customer-actions?**", async (route) => {
      await gate;
      if (fail)
        return route.fulfill({
          status: 503,
          json: { error: { code: "REQUEST_FAILED" } },
        });
      return route.fulfill({
        json: { data: { total: items.length ? 25 : 0, items } },
      });
    });
    await page.goto("/home");
    const notice = page.locator(".customer-action-feed-notice");
    await expect(notice.getByRole("status")).toHaveText(
      t("Memuat kabar terbaru…", "Loading updates…"),
    );
    release();
    await expect(notice.getByRole("alert")).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath(`feed-failure-${locale}.png`),
      fullPage: true,
    });
    fail = false;
    await notice.getByRole("button").focus();
    await notice.getByRole("button").press("Enter");
    await expect(notice.getByRole("status")).toHaveText(
      t("Menampilkan 20 dari 25 pembaruan.", "Showing 20 of 25 updates."),
    );
    await expect(page.locator(".action-count")).toHaveCount(0);
    const updates = page.locator(".customer-actions.updates");
    await expect(updates.locator("article")).toHaveCount(3);
    await updates
      .getByRole("button", {
        name: t("Lihat semua 20 pembaruan", "View all 20 updates"),
      })
      .click();
    await expect(updates.locator("article")).toHaveCount(20);
    await updates
      .getByRole("button", {
        name: t("Tampilkan tiga teratas", "Show top three"),
      })
      .click();
    await expect(updates.locator("article")).toHaveCount(3);
    await expect(page.locator(".home-page")).not.toContainText(
      /all clear|semua beres/i,
    );
    items = [];
    await page.reload();
    await expect(page.locator(".date-agenda")).toBeVisible();
    await expect(updates).toHaveCount(0);
    await expect(notice).toHaveCount(0);
  });

  test(`Seller card and detail previews stay static ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await login(page, baseURL!, locale, "owner");
    await page.setViewportSize({ width: 390, height: 1000 });
    const state = (
      await (await page.request.get(`/api/v1/seller/${catererId}`)).json()
    ).data;
    const draft = {
      ...state.offers.find((offer: Offer) => offer.status === "published"),
      status: "draft",
    };
    await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
      route.fulfill({ json: { data: { ...state, offers: [draft] } } }),
    );
    await page.goto(`/seller/packages?edit=${draft.id}`);
    const dialog = page.locator(".package-dialog");
    await dialog
      .getByRole("combobox", {
        name: t("Langkah paket", "Package steps"),
        exact: true,
      })
      .click();
    await page
      .getByRole("option", { name: t("5. Periksa", "5. Review"), exact: true })
      .click();
    await dialog
      .getByText(t("Pratinjau pelanggan", "Customer preview"), { exact: true })
      .click();
    const preview = dialog.locator(".listing-preview");
    await expect(preview.locator(".delivery-coverage")).toContainText(
      t("Pilih area", "Choose an area"),
    );
    for (const link of await preview.locator("a").all()) {
      await expect(link).toHaveAttribute("aria-disabled", "true");
      await expect(link).toHaveAttribute("tabindex", "-1");
    }
    await expect(preview.getByRole("combobox")).toHaveCount(0);
    await dialog
      .getByRole("button", {
        name: t("Detail paket", "Package details"),
        exact: true,
      })
      .click();
    await expect(preview.locator(".package-detail")).toHaveAttribute(
      "inert",
      "",
    );
    await expect(preview.locator(".delivery-coverage")).toContainText(
      t("memilih alamat saat checkout", "choose an address at checkout"),
    );
  });
}

test("Server rejects unsupported checkout addresses for regular and trial purchases", async ({
  page,
  baseURL,
}) => {
  await login(page, baseURL!, "en");
  const offers: Offer[] = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items;
  const offer = offers.find((p) => p.trialPrice)!;
  const area = areaOptions.find((value) => !offer.areas.includes(value))!;
  expect(area).toBeTruthy();
  const saved = await page.request.post("/api/v1/commands", {
    data: {
      action: "address.save",
      requestId: crypto.randomUUID(),
      payload: {
        label: "Synthetic coverage test",
        line: "Synthetic outside-area address",
        area,
        city: "Jakarta",
        instructions: "Local test only",
      },
    },
  });
  expect(saved.ok()).toBe(true);
  const addressId = (await saved.json()).data.id;
  for (const trial of [false, true]) {
    const result = await page.request.post("/api/v1/commands", {
      data: {
        action: "checkout.create",
        requestId: crypto.randomUUID(),
        payload: {
          packageId: offer.id,
          addressId,
          startDate: addDays(localDay(), 20),
          portions: 1,
          trial,
          acceptedTerms: true,
        },
      },
    });
    expect(result.ok()).toBe(false);
    expect((await result.json()).error.code).toBe("COVERAGE");
  }
});
