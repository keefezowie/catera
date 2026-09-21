import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const payout = "e1000000-0000-4000-8000-000000000001";
const overview = {
  reportingVersion: 1,
  payoutReadiness: "synthetic",
  nextProcessingAt: null,
  available: "411800",
  expected: "1835400",
  held: "305900",
  paid: "200000",
  earned: "917700",
  reserved: "0",
  recovery: "0",
  nextPayoutAt: "2026-09-21T02:00:00Z",
  policy: {
    id: "demo",
    enabled: false,
    synthetic: true,
    minimumAmount: 1,
    maximumAmount: 2147483647,
  },
  entries: [],
  payouts: [],
};
async function setup(page: Page, baseURL: string, locale: string) {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: locale, url: baseURL }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.route("**/api/v1/seller-settlement/**", (r) =>
    r.fulfill({ json: { data: overview } }),
  );
  await page.route("**/api/v1/seller-settlement-report/**", (r) => {
    const n = Number(new URL(r.request().url()).searchParams.get("days")) || 30;
    const days = Array.from({ length: n }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      credits: i % 4 === 0 ? "122360" : i % 3 === 0 ? "61180" : "0",
      adjustments: i === n - 2 ? "-24000" : "0",
    }));
    return r.fulfill({
      json: {
        data: {
          from: days[0].date,
          to: days.at(-1)!.date,
          timezone: "Asia/Jakarta",
          credits: days.reduce((s, d) => s + BigInt(d.credits), 0n).toString(),
          adjustments: "-24000",
          days,
        },
      },
    });
  });
  await page.route("**/api/v1/seller-settlement-history/**", (r) => {
    const kind = new URL(r.request().url()).searchParams.get("kind");
    const item =
      kind === "holds"
        ? {
            id: payout,
            amount: "305900",
            created_at: "2026-09-15T08:00:00Z",
            package_name: "MOCK - Paket 3 Periode",
            allocation_hold: true,
            cases: [],
          }
        : kind === "entries"
          ? {
              id: payout,
              amount: "61180",
              kind: "earned",
              created_at: "2026-09-15T08:00:00Z",
              package_name: "MOCK - Paket 3 Periode",
            }
          : {
              id: payout,
              amount: "200000",
              status: "succeeded",
              synthetic: true,
              created_at: "2026-09-15T08:00:00Z",
            };
    return r.fulfill({ json: { data: { items: [item], nextCursor: null } } });
  });
  await page.route("**/api/v1/seller-settlement-payout/**", (r) =>
    r.fulfill({
      json: {
        data: {
          id: payout,
          amount: "200000",
          status: "succeeded",
          created_at: "2026-09-15T08:00:00Z",
          reference: payout,
          synthetic: true,
          failureCode: null,
          events: [
            { status: "pending", recordedAt: "2026-09-15T08:00:00Z" },
            { status: "succeeded", recordedAt: "2026-09-15T08:05:00Z" },
          ],
          items: [
            {
              id: payout,
              checkout_id: payout,
              amount: "200000",
              package_name: "MOCK - Paket 3 Periode",
              created_at: "2026-09-10T00:00:00Z",
            },
          ],
          nextCursor: null,
        },
      },
    }),
  );
}
for (const locale of ["id", "en"])
  for (const width of [360, 768, 1440])
    test(`settlement complete screen ${locale} ${width}`, async ({
      page,
      baseURL,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 1000 });
      await setup(page, baseURL!, locale);
      await page.goto("/seller/transactions");
      await expect(
        page.getByText(
          locale === "id" ? "Saldo tersedia" : "Available balance",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: locale === "id" ? "30 hari" : "30 days",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByText(/Next scheduled payout|Jadwal berikutnya/),
      ).toHaveCount(0);
      await expect(page.locator(".settlement-bars g[role=button]")).toHaveCount(
        30,
      );
      await page.screenshot({
        path: info.outputPath(`overview-${locale}-${width}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", {
          name: locale === "id" ? "7 hari" : "7 days",
          exact: true,
        })
        .click();
      await expect(page.locator(".settlement-bars g[role=button]")).toHaveCount(
        7,
      );
      const day = page.locator('.settlement-bars g[tabindex="0"]');
      await day.focus();
      await page.keyboard.press("Home");
      await expect(
        page.locator(".settlement-bars g[role=button]").first(),
      ).toHaveAttribute("tabindex", "0");
      await page
        .getByText(locale === "id" ? "Lihat data" : "View data", {
          exact: true,
        })
        .click();
      await expect(page.getByRole("table").first()).toBeVisible();
      await page
        .getByRole("button", {
          name: locale === "id" ? "Lihat dana ditahan" : "View held funds",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toContainText("305");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.locator(".settlement-row-button").first().click();
      await expect(page.getByRole("dialog")).toContainText(
        locale === "id" ? "Status yang tercatat" : "Recorded status history",
      );
      await expect(
        page.getByRole("dialog").locator(".settlement-timeline li"),
      ).toHaveCount(2);
      await page.keyboard.press("Escape");
      const tab = page.getByRole("tab", {
        name: locale === "id" ? "Pencairan" : "Payouts",
        exact: true,
      });
      await tab.focus();
      await page.keyboard.press("End");
      await expect(
        page.getByRole("heading", {
          name: locale === "id" ? "Penjualan" : "Sales",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const violations = (
        await new AxeBuilder({ page }).include(".settlement-screen").analyze()
      ).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      );
      expect(violations).toEqual([]);
      expect(errors).toEqual([]);
    });
test("report failure and retry do not hide balances or purchases", async ({
  page,
  baseURL,
}) => {
  await setup(page, baseURL!, "en");
  let failed = true;
  await page.route("**/api/v1/seller-settlement-report/**", async (r) => {
    if (failed)
      return r.fulfill({
        status: 503,
        json: { error: { code: "REQUEST_FAILED" } },
      });
    return r.fallback();
  });
  await page.goto("/seller/transactions");
  await expect(
    page.getByText("Available balance", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".settlement-bars").count()).toBe(0);
  failed = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".settlement-bars")).toBeVisible();
  await page.getByRole("tab", { name: "Sales", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sales" }),
  ).toBeVisible();
});
test("200 percent text and zero balances remain usable", async ({
  page,
  baseURL,
}, info) => {
  await setup(page, baseURL!, "en");
  await page.route("**/api/v1/seller-settlement/**", (r) =>
    r.fulfill({
      json: {
        data: {
          ...overview,
          held: "0",
          available: "0",
          expected: "0",
          paid: "0",
        },
      },
    }),
  );
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto("/seller/transactions");
  await page.addStyleTag({ content: "html {font-size:200% !important}" });
  await expect(
    page.getByText("Available balance", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("text-200.png"),
    fullPage: true,
  });
});
test("real reporting endpoint serves authenticated local ledger", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const me = await (await page.request.get("/api/v1/me")).json();
  const cid = me.data.actor.catererId;
  const r = await page.request.get(
    `/api/v1/seller-settlement-report/${cid}?days=7`,
  );
  expect(r.status()).toBe(200);
  expect((await r.json()).data.days).toHaveLength(7);
  const missing = await page.request.get(
    `/api/v1/seller-settlement-payout/${cid}?payoutId=${payout}`,
  );
  expect(missing.status()).toBe(404);
  const invalid = await page.request.get(
    `/api/v1/seller-settlement-report/${cid}?days=8`,
  );
  expect(invalid.status()).toBe(400);
});

test("late chart responses cannot replace the selected range", async ({
  page,
  baseURL,
}) => {
  await setup(page, baseURL!, "en");
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let entered!: () => void;
  const started = new Promise<void>((r) => (entered = r));
  await page.route("**/api/v1/seller-settlement-report/**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("days") === "30") {
      entered();
      await gate;
    }
    await route.fallback();
  });
  await page.goto("/seller/transactions");
  await started;
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await expect(page.locator(".settlement-bars g[role=button]")).toHaveCount(7);
  release();
  await expect(
    page.getByRole("button", { name: "7 days", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".settlement-bars g[role=button]")).toHaveCount(7);
});
test("admin switches caterers without retaining the prior balance", async ({
  page,
  baseURL,
}) => {
  await setup(page, baseURL!, "en");
  await page.request.post("/api/v1/auth/demo", {
    data: { role: "platform_admin" },
  });
  await page.goto("/admin/settlement");
  const picker = page.getByRole("combobox", { name: "Caterer", exact: true });
  await picker.click();
  await page.getByRole("option", { name: "Dapur Senja", exact: true }).click();
  await expect(page.locator(".settlement-amount")).toContainText("411");
  await page.route("**/api/v1/seller-settlement/**", (r) =>
    r.fulfill({ json: { data: { ...overview, available: "99000" } } }),
  );
  await picker.click();
  await page
    .getByRole("option", { name: "Hijau Kitchen", exact: true })
    .click();
  await expect(page.locator(".settlement-amount")).toContainText("99");
  await expect(page.locator(".settlement-amount")).not.toContainText("411");
  await expect(
    page.getByRole("tab", { name: "Sales", exact: true }),
  ).toHaveCount(0);
});
test("payout dialog is accessible and unknown history is not invented", async ({
  page,
  baseURL,
}) => {
  await setup(page, baseURL!, "en");
  await page.route("**/api/v1/seller-settlement-payout/**", (r) =>
    r.fulfill({
      json: {
        data: {
          id: payout,
          amount: "200000",
          status: "failed",
          created_at: "2026-09-15T08:00:00Z",
          reference: payout,
          synthetic: true,
          failureCode: null,
          events: [],
          items: [],
          nextCursor: null,
        },
      },
    }),
  );
  await page.goto("/seller/transactions");
  await page.locator(".settlement-row-button").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Status changes were not recorded",
  );
  await expect(page.getByRole("dialog")).toContainText("did not succeed");
  expect(
    (
      await new AxeBuilder({ page }).include("[role=dialog]").analyze()
    ).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator(".settlement-row-button").first()).toBeFocused();
});
