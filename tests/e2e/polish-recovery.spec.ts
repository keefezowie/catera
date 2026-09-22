import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const evidence = "output/polish-v1";
const phase = process.env.CATERA_POLISH_CAPTURE || "after";
const cid = "10000000-0000-4000-8000-000000000001";
async function capture(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: `${evidence}/${phase}-${name}.png`,
    fullPage: true,
  });
}
async function login(page: Page, role = "customer") {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("starting a seller conversation locks its recipient during send and preserves failure input", async ({
  page,
}) => {
  await login(page, "owner");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("**/api/v1/message-customers/**", (route) =>
    route.fulfill({
      json: {
        data: {
          total: 2,
          items: [
            {
              id: "recipient-a",
              name: "Synthetic recipient A",
              user_id: "user-a",
            },
            {
              id: "recipient-b",
              name: "Synthetic recipient B",
              user_id: "user-b",
            },
          ],
        },
      },
    }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let sends = 0;
  await page.route("**/api/v1/commands", async (route) => {
    const command = route.request().postDataJSON();
    if (command.action !== "message.send") return route.continue();
    sends++;
    expect(command.payload.customerRecordId).toBe("recipient-a");
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: { code: "REQUEST_FAILED" } },
    });
  });
  await page.goto("/seller/support");
  await page
    .getByRole("button", { name: "Mulai percakapan", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Synthetic recipient A", exact: true })
    .click();
  await dialog
    .getByRole("textbox", { name: "Pesan", exact: true })
    .fill("Synthetic first message");
  await dialog
    .getByRole("button", { name: "Kirim pesan pertama", exact: true })
    .click();
  await expect(dialog.locator('form[aria-busy="true"]')).toBeVisible();
  await capture(page, "new-conversation-pending-390-id");
  try {
    await expect(
      dialog.getByRole("button", {
        name: "Synthetic recipient B",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("searchbox", { name: "Cari pelanggan" }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("textbox", { name: "Pesan", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Pesan", exact: true }),
  ).toHaveValue("Synthetic first message");
  await expect(
    dialog.getByRole("button", { name: "Synthetic recipient B", exact: true }),
  ).toBeEnabled();
  expect(sends).toBe(1);
  await fits(page);
});

for (const locale of ["id", "en"]) {
  for (const width of [390, 768, 1440]) {
    test(`catalog reset and back context ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      await page.goto("/#packages");
      const cards = page.locator("#main .package-card:visible");
      const type = page.getByRole("combobox", {
        name: t("Jenis paket", "Package type"),
        exact: true,
      });
      await page.getByRole("button", { name: /^Filter/ }).click();
      await type.click();
      // Wait for an interactive control before counting the hydrated catalog.
      await expect(page.getByRole("listbox")).toBeVisible();
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      await page
        .getByRole("option", { name: t("Nasi box", "Rice box"), exact: true })
        .click();
      const search = page.getByRole("searchbox", {
        name: t("Cari katering", "Search caterers"),
      });
      await search.fill("no matching synthetic package");
      await page
        .getByRole("button", {
          name: t("Hapus filter", "Reset filters"),
          exact: true,
        })
        .click();
      await capture(page, `catalog-reset-${width}-${locale}`);
      await expect(type).toHaveText(t("Semua jenis", "All types"));
      await expect(cards).toHaveCount(count);
      await search.fill("Rantang");
      await page
        .getByRole("button", {
          name: t("Siang + malam", "Lunch + dinner"),
          exact: true,
        })
        .click();
      await page
        .locator("#main .package-card:visible")
        .getByRole("link", {
          name: t("Lihat paket", "View package"),
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(/\/packages\//);
      await page.goBack();
      await expect(search).toHaveValue("Rantang");
      await expect(
        page.getByRole("button", {
          name: t("Siang + malam", "Lunch + dinner"),
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(cards).toHaveCount(1);
      await fits(page);
    });
  }

  for (const role of ["customer", "owner"]) {
    test(`conversation drafts, failure, retry and recipient isolation ${locale} ${role}`, async ({
      page,
      baseURL,
    }) => {
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({
        width: role === "customer" ? 390 : 1440,
        height: 900,
      });
      await login(page, role);
      const conversations = [
        {
          id: "polish-a",
          caterer_id: cid,
          customer_id: "synthetic-a",
          caterer: "Dapur Uji A",
          customer: "Pelanggan Uji A",
          messages: [] as any[],
        },
        {
          id: "polish-b",
          caterer_id: cid,
          customer_id: "synthetic-b",
          caterer: "Dapur Uji B",
          customer: "Pelanggan Uji B",
          messages: [] as any[],
        },
      ];
      await page.route("**/api/v1/conversations", (route) =>
        route.fulfill({ json: { data: conversations } }),
      );
      let attempts = 0;
      await page.route("**/api/v1/commands", async (route) => {
        const command = route.request().postDataJSON();
        if (command.action !== "message.send") return route.continue();
        attempts++;
        expect(command.payload.conversationId).toBe("polish-a");
        expect(command.payload.body).toBe("Draft for A only");
        if (attempts === 1)
          return route.fulfill({
            status: 503,
            json: { error: { code: "REQUEST_FAILED" } },
          });
        conversations[0].messages.push({
          id: "synthetic-message",
          sender_id: "synthetic-a",
          body: command.payload.body,
          created_at: "2026-09-19T00:00:00Z",
        });
        return route.fulfill({ json: { data: { id: "polish-a" } } });
      });
      await page.goto(role === "customer" ? "/messages" : "/seller/support");
      const body = page.locator(".composer textarea");
      await body.fill("Draft for A only");
      const recipient = (suffix: string) =>
        role === "customer" ? `Dapur Uji ${suffix}` : `Pelanggan Uji ${suffix}`;
      await page
        .locator(".conversation-preview")
        .filter({ hasText: recipient("B") })
        .click();
      await capture(page, `conversation-recipient-${locale}-${role}`);
      await expect(body).toHaveValue("");
      await body.fill("Draft for B only");
      await page
        .locator(".conversation-preview")
        .filter({ hasText: recipient("A") })
        .click();
      await expect(body).toHaveValue("Draft for A only");
      await page
        .locator(".composer")
        .getByRole("button", {
          name: locale === "id" ? "Kirim" : "Send",
          exact: true,
        })
        .click();
      await expect(page.locator(".composer").getByRole("alert")).toBeVisible();
      await expect(body).toHaveValue("Draft for A only");
      await capture(page, `conversation-error-${locale}-${role}`);
      await page
        .locator(".composer")
        .getByRole("button", {
          name: locale === "id" ? "Kirim" : "Send",
          exact: true,
        })
        .click();
      await expect(body).toHaveValue("");
      await expect(page.locator(".message-stream")).toContainText(
        "Draft for A only",
      );
      await page
        .locator(".conversation-preview")
        .filter({ hasText: recipient("B") })
        .click();
      await expect(body).toHaveValue("Draft for B only");
      expect(attempts).toBe(2);
      await fits(page);
      const audit = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(audit.violations).toEqual([]);
    });
  }

  test(`pending admin form protects submitted values ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await login(page, "platform_admin");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await page
      .getByRole("button", {
        name: locale === "id" ? "Semua katerer" : "All caterers",
        exact: true,
      })
      .click();
    await page.locator("button.queue-row").first().click();
    const dialog = page.locator(".detail-panel form");
    const code = dialog.getByLabel(
      locale === "id"
        ? "Alasan / koreksi yang diperlukan"
        : "Reason / required changes",
      { exact: true },
    );
    await code.fill("POLISH_TEST");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/commands", async (route) => {
      await gate;
      await route.fulfill({
        status: 409,
        json: { error: { code: "CONFLICT" } },
      });
    });
    await dialog
      .getByRole("button", {
        name:
          locale === "id"
            ? "Simpan keputusan verifikasi"
            : "Save verification decision",
        exact: true,
      })
      .click();
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await capture(page, `pending-form-390-${locale}`);
    try {
      await expect(code).toBeDisabled();
    } finally {
      release();
    }
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(code).toBeEnabled();
    await expect(code).toHaveValue("POLISH_TEST");
    await fits(page);
  });

  test(`admin decisions never inherit another record's input ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await login(page, "platform_admin");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin");
    await page
      .getByRole("button", {
        name: locale === "id" ? "Semua katerer" : "All caterers",
        exact: true,
      })
      .click();
    await page.locator("button.queue-row").nth(0).click();
    const reason = page.getByLabel(
      locale === "id"
        ? "Alasan / koreksi yang diperlukan"
        : "Reason / required changes",
      { exact: true },
    );
    await reason.fill("Synthetic reason for first caterer only");
    await page.locator("button.queue-row").nth(1).click();
    await capture(page, `admin-record-768-${locale}`);
    await expect.soft(reason).toHaveValue("", { timeout: 3000 });

    const response = await page.request.get("/api/v1/admin");
    const state = (await response.json()).data;
    const cases = [0, 1].map((index) => ({
      id: `synthetic-case-${index}`,
      subject: `Synthetic case ${index}`,
      description: "Synthetic support request",
      status: "open",
      created_at: "2026-09-19T00:00:00Z",
      amount: 0,
    }));
    await page.route("**/api/v1/admin", (route) =>
      route.fulfill({ json: { data: { ...state, cases } } }),
    );
    await page.goto("/admin/support");
    await page
      .locator("button.queue-row")
      .filter({ hasText: "Synthetic case 0" })
      .click();
    const amount = page.getByLabel(
      locale === "id" ? "Jumlah refund (Rp)" : "Refund amount (IDR)",
      { exact: true },
    );
    const decision = page.getByLabel(
      locale === "id" ? "Alasan keputusan" : "Decision reason",
      { exact: true },
    );
    const cancel = page.getByRole("checkbox", {
      name:
        locale === "id"
          ? "Batalkan sisa pengantaran dan lepaskan pemesanan"
          : "Cancel remaining deliveries and release the reservation",
    });
    await amount.fill("45000");
    await decision.fill("Synthetic decision for case zero only");
    await cancel.check();
    await page
      .locator("button.queue-row")
      .filter({ hasText: "Synthetic case 1" })
      .click();
    await capture(page, `support-record-768-${locale}`);
    await expect(amount).toHaveValue("0");
    await expect(decision).toHaveValue("");
    await expect(cancel).not.toBeChecked();
    await fits(page);
  });

  test(`failed admin refresh is visible and preserves decision input ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await login(page, "platform_admin");
    const state = (await (await page.request.get("/api/v1/admin")).json()).data;
    let fail = false;
    await page.route("**/api/v1/admin", (route) =>
      fail
        ? route.fulfill({
            status: 503,
            json: { error: { code: "REQUEST_FAILED" } },
          })
        : route.fulfill({ json: { data: state } }),
    );
    await page.route("**/api/v1/commands", (route) => {
      fail = true;
      return route.fulfill({ json: { data: { saved: true } } });
    });
    await page.goto("/admin");
    await page
      .getByRole("button", {
        name: locale === "id" ? "Semua katerer" : "All caterers",
        exact: true,
      })
      .click();
    await page.locator("button.queue-row").first().click();
    const reason = page.getByLabel(
      locale === "id"
        ? "Alasan / koreksi yang diperlukan"
        : "Reason / required changes",
      { exact: true },
    );
    await reason.fill("Synthetic verification reason");
    const refresh = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/admin") && response.status() === 503,
    );
    await page
      .getByRole("button", {
        name:
          locale === "id"
            ? "Simpan keputusan verifikasi"
            : "Save verification decision",
        exact: true,
      })
      .click();
    await refresh;
    await capture(page, `admin-refresh-${locale}`);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await expect(reason).toHaveValue("Synthetic verification reason");
    fail = false;
    await page
      .getByRole("button", {
        name: locale === "id" ? "Coba lagi" : "Try again",
        exact: true,
      })
      .click();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await expect(reason).toHaveValue("Synthetic verification reason");
  });

  test(`reviews distinguish loading and errors from an empty history ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width: 390, height: 844 });
    let fail = true;
    let release!: () => void;
    const pendingRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/reviews/**", async (route) => {
      if (fail) {
        await pendingRead;
        return route.fulfill({
          status: 503,
          json: { error: { code: "REQUEST_FAILED" } },
        });
      }
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto("/packages/20000000-0000-4000-8000-000000000003");
    const section = page.locator(".detail-section").filter({
      has: page.getByRole("heading", {
        name:
          locale === "id" ? "Cerita dari pelanggan" : "Customer experiences",
        exact: true,
      }),
    });
    await section.scrollIntoViewIfNeeded();
    try {
      await expect(section.getByRole("status")).toHaveText(
        locale === "id" ? "Memuat ulasan…" : "Loading reviews…",
      );
      await expect(section).not.toContainText(
        locale === "id" ? "Belum ada ulasan." : "No reviews yet.",
      );
    } finally {
      release();
    }
    await expect(section.getByRole("alert")).toBeVisible();
    await capture(page, `reviews-error-390-${locale}`);
    await expect(section).not.toContainText(
      locale === "id" ? "Belum ada ulasan." : "No reviews yet.",
    );
    fail = false;
    await section
      .getByRole("button", {
        name: locale === "id" ? "Coba lagi" : "Try again",
        exact: true,
      })
      .click();
    await expect(section).toContainText(
      locale === "id" ? "Belum ada ulasan." : "No reviews yet.",
    );
  });

  test(`changed customer filters never show the previous result as current ${locale}`, async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await login(page, "owner");
    await page.setViewportSize({ width: 768, height: 1024 });
    let fail = true;
    await page.route("**/api/v1/seller-customers/**", async (route) => {
      if (!new URL(route.request().url()).searchParams.has("followup"))
        return route.continue();
      if (fail)
        return route.fulfill({
          status: 503,
          json: { error: { code: "REQUEST_FAILED" } },
        });
      return route.continue();
    });
    await page.goto("/seller/customers");
    await expect(
      page.locator(".pilot-customer-grid article").first(),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: locale === "id" ? "Perlu perpanjangan" : "Renewal follow-ups",
        exact: true,
      })
      .click();
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await capture(page, `customer-filter-error-768-${locale}`);
    await expect(page.locator(".pilot-customer-grid article")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: locale === "id" ? "Semua pelanggan" : "All customers",
        exact: true,
      }),
    ).toBeVisible();
    fail = false;
    await page
      .locator("main")
      .getByRole("button", {
        name: locale === "id" ? "Coba lagi" : "Try again",
        exact: true,
      })
      .click();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await fits(page);
  });
}
