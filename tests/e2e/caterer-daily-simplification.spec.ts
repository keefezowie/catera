import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  addDays,
  type SellerState,
  type SellerAttentionItem,
} from "@catera/domain";

const catererId = "10000000-0000-4000-8000-000000000001";
const day = "2026-10-08";
type Locale = "id" | "en";
const copy = (locale: Locale, id: string, en: string) =>
  locale === "id" ? id : en;

async function login(page: Page, baseURL: string, locale: Locale) {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL).hostname);
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: locale, url: baseURL }]);
  expect(
    (
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } })
    ).ok(),
  ).toBe(true);
  return (await (await page.request.get(`/api/v1/seller/${catererId}`)).json())
    .data as SellerState;
}

async function choose(page: Page, control: Locator, name: string) {
  await control.click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function operations(page: Page, state: SellerState) {
  const template = state.offers.find((offer) => offer.status === "published")!;
  const offers = [
    {
      ...template,
      id: "d1000000-0000-4000-8000-000000000001",
      name: "Synthetic lunch and dinner",
    },
    {
      ...template,
      id: "d1000000-0000-4000-8000-000000000002",
      name: "Synthetic other package",
    },
  ];
  const deliveries = [2, 5, 3].map((portions, i) => ({
    id: `d2000000-0000-4000-8000-00000000000${i + 1}`,
    subscription_id: `d3000000-0000-4000-8000-00000000000${i + 1}`,
    service_date: day,
    address: {
      label: "Rumah",
      line: `Synthetic address ${i + 1}`,
      area: "Kelapa Gading",
      city: "Jakarta",
      instructions: "Synthetic UI fixture",
    },
    status: "scheduled",
    version: 1,
    portions,
    trial: i === 2,
    offer: offers[i === 0 ? 0 : 1],
    customer: {
      id: `d4000000-0000-4000-8000-00000000000${i + 1}`,
      name: `Synthetic customer ${i + 1}`,
    },
    meals: (i === 2 ? ["dinner"] : ["lunch", "dinner"]).map((meal) => ({
      meal,
      status: "scheduled",
    })),
    cutoff_at: `${addDays(day, -1)}T11:00:00Z`,
    canChange: true,
  }));
  await page.route(`**/api/v1/seller/${catererId}*`, (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") || day;
    return route.fulfill({
      json: {
        data: {
          ...state,
          offers,
          deliveries: date === day ? deliveries : [],
          today: day,
          operationalDate: date,
          latestProduction: null,
        },
      },
    });
  });
  await page.route("**/api/v1/seller-calendar/**", (route) =>
    route.fulfill({
      json: {
        data: { days: [{ date: day, orders: 3, lunch: true, dinner: true }] },
      },
    }),
  );
  return { offers, deliveries };
}

for (const locale of ["id", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`daily controls preserve context and whole-day totals ${locale} ${width}`, async ({
      page,
      baseURL,
    }, info) => {
      const state = await login(page, baseURL!, locale);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const { offers } = await operations(page, state);
      await page.goto(`/seller?date=${day}&meal=dinner`);
      const filters = page.locator("#ops-extra-filters");
      const toggle = page.getByRole("button", {
        name: new RegExp(copy(locale, "^Filter pesanan", "^Order filters")),
      });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(filters).toBeHidden();
      await expect(
        page.getByRole("combobox", {
          name: copy(locale, "Status pesanan", "Order status"),
        }),
      ).toHaveCount(0);
      await toggle.focus();
      await toggle.press("Enter");
      await expect(filters).toBeVisible();
      await page
        .getByRole("searchbox", {
          name: copy(locale, "Cari pesanan", "Search orders"),
        })
        .fill("Synthetic customer 1");
      await expect(page.locator(".ops-active-filters")).toContainText(
        "Synthetic customer 1",
      );
      await toggle.click();
      await expect(filters).toBeHidden();
      await expect(page.locator(".ops-active-filters")).toBeVisible();
      await page
        .getByRole("button", {
          name: copy(locale, "Hapus filter", "Clear filters"),
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("date") === day &&
          url.searchParams.get("meal") === "dinner" &&
          !url.searchParams.has("search"),
      );
      await page.locator(".ops-stages button").first().click();
      await expect(page).toHaveURL(/stage=scheduled/);
      await expect(page.locator(".ops-active-filters")).toContainText(
        copy(locale, "Terjadwal", "Scheduled"),
      );
      await page.reload();
      await expect(filters).toBeVisible();
      await page.goto(
        `/seller/schedule?date=${day}&production=1&package=${offers[0].id}`,
      );
      await expect(page.locator(".ops-scope-summary")).toContainText(
        copy(locale, "1 pesanan · 4 porsi makan", "1 order · 4 meal portions"),
      );
      await expect(page.locator(".ops-production")).toContainText(
        copy(locale, "17 porsi makan", "17 meal portions"),
      );
      await choose(
        page,
        page.getByRole("combobox", {
          name: copy(locale, "Kelompokkan pesanan", "Group orders"),
        }),
        copy(locale, "Pelanggan", "Customer"),
      );
      await choose(
        page,
        page.getByRole("combobox", {
          name: copy(locale, "Filter pelanggan", "Customer filter"),
        }),
        "Synthetic customer 1",
      );
      const scheduleToggle = page.getByRole("button", {
        name: new RegExp(
          copy(locale, "^Filter & kelompokkan", "^Filter & group"),
        ),
      });
      await scheduleToggle.click();
      await expect(filters).toBeHidden();
      await expect(page.locator(".ops-active-filters")).toContainText(
        "Synthetic customer 1",
      );
      const reset = page.getByRole("button", {
        name: copy(locale, "Hapus filter tabel", "Clear table filters"),
        exact: true,
      });
      await expect(reset).toHaveCount(1);
      await reset.click();
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("date") === day &&
          url.searchParams.get("production") === "1" &&
          ["meal", "package", "search", "status", "group", "filter"].every(
            (key) => !url.searchParams.has(key),
          ),
      );
      await expect(page.locator(".ops-scope-summary")).toContainText(
        copy(
          locale,
          "3 pesanan · 17 porsi makan",
          "3 orders · 17 meal portions",
        ),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include("#main").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`schedule-${locale}-${width}.png`),
        fullPage: true,
      });
    });
  }

  test(`attention defaults to all dates and both meals and narrows independently ${locale}`, async ({
    page,
    baseURL,
  }) => {
    const state = await login(page, baseURL!, locale);
    await operations(page, state);
    const items: SellerAttentionItem[] = Array.from({ length: 21 }, (_, i) => ({
      id: `synthetic-${i}`,
      kind: "support",
      priority: i < 2 ? 1 : 2,
      at_time: `${day}T01:00:00Z`,
      context: "Synthetic attention fixture",
      href: "/seller/support",
      serviceDate: i === 0 ? addDays(day, -1) : i === 1 ? addDays(day, 1) : day,
      meal: i % 2 ? "dinner" : "lunch",
      packageName: `Synthetic issue ${i + 1}`,
    }));
    const requests: URL[] = [];
    let fail = false;
    await page.route("**/api/v1/seller-attention/**", (route) => {
      const url = new URL(route.request().url());
      requests.push(url);
      if (fail)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "UNAVAILABLE",
              message: "Synthetic request failure",
            },
          },
        });
      const scope = url.searchParams.get("scope");
      const date = url.searchParams.get("date");
      const meal = url.searchParams.get("meal");
      const filtered = items.filter(
        (item) =>
          (!meal || item.meal === meal) &&
          (scope === "all" ||
            (scope === "future"
              ? item.serviceDate! >= date!
              : item.serviceDate === date)),
      );
      const offset = url.searchParams.has("cursor") ? 20 : 0;
      return route.fulfill({
        json: {
          data: {
            timezone: "Asia/Jakarta",
            total: filtered.length,
            items: filtered.slice(offset, offset + 20),
            nextCursor:
              !offset && filtered.length > 20 ? "synthetic-next" : null,
          },
        },
      });
    });
    await page.goto(`/seller?date=${day}&meal=lunch`);
    const queue = page.locator(".seller-attention");
    await expect(queue.getByRole("heading")).toContainText("(21)");
    await expect(queue.locator(".attention-item")).toHaveCount(3);
    await expect(queue.locator(".attention-scope-summary")).toContainText(
      copy(
        locale,
        "Seluruh tanggal · siang + malam",
        "All dates · lunch + dinner",
      ),
    );
    expect(requests[0].searchParams.get("scope")).toBe("all");
    expect(requests[0].searchParams.has("meal")).toBe(false);
    expect(requests[0].searchParams.has("date")).toBe(false);
    await expect(queue).toContainText(addDays(day, -1));
    await expect(queue).toContainText(addDays(day, 1));
    await page
      .getByRole("tab", { name: new RegExp(copy(locale, "^Malam", "^Dinner")) })
      .click();
    await expect(queue.getByRole("heading")).toContainText("(21)");
    await queue
      .getByRole("button", {
        name: new RegExp(
          copy(locale, "^Lihat semua masalah", "^View all issues"),
        ),
      })
      .click();
    await expect(queue.locator(".attention-item")).toHaveCount(20);
    await queue
      .getByRole("button", {
        name: copy(locale, "Muat masalah berikutnya", "Load more issues"),
      })
      .click();
    await expect(queue.locator(".attention-item")).toHaveCount(21);
    await queue
      .getByRole("button", {
        name: copy(locale, "Filter masalah", "Filter issues"),
      })
      .click();
    await queue
      .getByRole("button", {
        name: copy(locale, "Tanggal tertentu", "Specific date"),
        exact: true,
      })
      .click();
    await choose(
      page,
      queue.getByRole("combobox", {
        name: copy(locale, "Waktu makan masalah", "Issue meal"),
      }),
      copy(locale, "Malam", "Dinner"),
    );
    await expect(queue.locator(".attention-scope-summary")).toContainText(day);
    await page
      .getByRole("button", {
        name: copy(locale, "Tanggal operasional", "Operational date"),
        exact: true,
      })
      .click();
    await page.locator(`[data-calendar-day="${addDays(day, 1)}"]`).click();
    await expect(page).toHaveURL(new RegExp(`date=${addDays(day, 1)}`));
    await expect(queue.locator(".attention-scope-summary")).toContainText(day);
    await expect(queue.locator(".attention-scope-summary")).not.toContainText(
      addDays(day, 1),
    );
    expect(requests.at(-1)!.searchParams.get("date")).toBe(day);
    fail = true;
    await queue
      .getByRole("button", {
        name: copy(locale, "Semua tanggal", "All dates"),
        exact: true,
      })
      .click();
    await expect(queue.getByRole("alert")).toBeVisible();
    await expect(queue.locator(".quiet-empty")).toHaveCount(0);
  });

  test(`empty menus lead to setup while invalid links recover ${locale}`, async ({
    page,
    baseURL,
  }) => {
    const state = await login(page, baseURL!, locale);
    await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
      route.fulfill({
        json: { data: { ...state, offers: [], contentRevisions: [] } },
      }),
    );
    await page.goto("/seller/menus");
    const workspace = page.locator(".menu-workspace");
    const create = workspace.getByRole("link", {
      name: copy(locale, "Buat paket pertama", "Create your first package"),
    });
    await expect(create).toHaveAttribute("href", "/seller/packages?new=1");
    await expect(workspace.locator(".menu-library")).toBeHidden();
    await workspace.locator(":scope > details > summary").click();
    await expect(workspace.locator(".menu-library")).toBeVisible();
    await create.click();
    await expect(page.locator(".package-dialog")).toBeVisible();
    await page.goto("/seller/menus?package=missing");
    await expect(workspace.getByRole("link")).toHaveCount(0);
    await expect(workspace).toContainText(
      copy(locale, "tidak tersedia", "not available"),
    );
    await workspace
      .getByRole("button", {
        name: copy(locale, "Pilih paket lain", "Choose another package"),
      })
      .click();
    await expect(create).toBeVisible();
  });

  test(`Payouts omit repeated tiles and Settings keep full payout state ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await login(page, baseURL!, locale);
    await page.goto("/seller/transactions?tab=payouts");
    const bank = page.locator("#payout");
    await expect(bank.getByRole("heading")).toBeVisible();
    await expect(bank.locator(".payout-state")).toHaveCount(0);
    await expect(page.locator(".settlement-summary")).toBeVisible();
    await expect(
      bank.getByRole("link", {
        name: /Atur pencairan|Kelola rekening|Set up payout|Manage bank account/,
      }),
    ).toBeVisible();
    await page.goto("/seller/settings#payout");
    await expect(bank.locator(".payout-state > p")).toHaveCount(3);
    await expect(bank.locator(".payout-state")).toBeVisible();
  });
}
