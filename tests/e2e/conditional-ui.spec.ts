import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

async function login(page: Page, role = "owner") {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}
for (const width of [320, 390, 768, 1440]) {
  for (const locale of ["id", "en"]) {
    test(`confirmation hierarchy and retained draft ${width} ${locale}`, async ({
      page,
      baseURL,
    }) => {
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await login(page);
      await page.setViewportSize({ width, height: 900 });
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      await page.goto("/seller/packages");
      const trigger = page.getByRole("button", {
        name: t("Buat paket", "Create package"),
        exact: true,
      });
      await trigger.click();
      const editor = page.locator(".package-dialog");
      const title = page.getByLabel(t("Nama paket", "Package name"), {
        exact: true,
      });
      await title.fill("Synthetic retained draft");
      const box = (await editor.boundingBox())!;
      expect(Math.round(box.width)).toBe(
        width < 560 ? width : Math.min(860, width - 32),
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        await title.focus();
        await page.keyboard.press("Escape");
        const confirm = page.locator(".dialog-confirmation");
        await expect(confirm).toBeVisible();
        await expect(editor).toHaveAttribute("inert", "");
        const bounds = (await confirm.boundingBox())!;
        expect(bounds.width).toBeLessThanOrEqual(440);
        expect(bounds.x).toBeGreaterThanOrEqual(16);
        const safe = confirm.getByRole("button", {
          name: t("Lanjut mengedit", "Keep editing"),
        });
        await expect(safe).toBeFocused();
        const layers = await page.evaluate(() => ({
          panels: [...document.querySelectorAll(".dialog")].map((el) =>
            Number(getComputedStyle(el).zIndex),
          ),
          backdrops: [...document.querySelectorAll(".dialog-overlay")].map(
            (el) => Number(getComputedStyle(el).zIndex),
          ),
        }));
        expect(layers.backdrops[1]).toBeGreaterThan(layers.panels[0]);
        expect(layers.panels[1]).toBeGreaterThan(layers.backdrops[1]);
        await page.mouse.click(4, 4);
        await expect(confirm).toBeVisible();
        await page.keyboard.press("Tab");
        expect(
          await confirm.evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true);
        await page.keyboard.press("Escape");
        await expect(confirm).toHaveCount(0);
        await expect(title).toHaveValue("Synthetic retained draft");
        await expect(title).toBeFocused();
      }
      await page.keyboard.press("Escape");
      await mkdir("output/playwright/conditional-ui", { recursive: true });
      await page.screenshot({
        path: `output/playwright/conditional-ui/confirmation-${width}-${locale}.png`,
      });
      expect(
        (
          await new AxeBuilder({ page })
            .include(".dialog-confirmation")
            .analyze()
        ).violations,
      ).toEqual([]);
      await page
        .getByRole("button", { name: t("Buang perubahan", "Discard changes") })
        .click();
      await expect(page.locator(".dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }
}

test("time dropdown closes before its picker and preserves cancellation", async ({
  page,
}) => {
  await login(page);
  await page.goto("/seller/profile");
  const trigger = page.getByRole("button", {
    name: "Batas perubahan sehari sebelumnya",
  });
  const original = await trigger.textContent();
  await trigger.click();
  const picker = page.getByRole("dialog", { name: "Pilih waktu" });
  const hour = picker.getByRole("combobox", { name: "Jam", exact: true });
  await hour.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(picker).toBeVisible();
  await expect(hour).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText(original!);
});

test("optional nutrition reveals invalid ranges and retains values across collapse", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Jenis paket", exact: true })
    .click();
  await page.getByRole("option", { name: "À la carte", exact: true }).click();
  await page
    .getByLabel("Nama paket", { exact: true })
    .fill("Synthetic optional fields");
  await page
    .getByLabel("Cerita paket", { exact: true })
    .fill("Synthetic optional-field validation.");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page
    .getByRole("button", { name: "Gunakan foto sintetis demo", exact: true })
    .click();
  const section = page
    .locator(".optional-section")
    .filter({ hasText: "Informasi gizi" });
  await section.locator("summary").click();
  const fields = section.locator("input");
  await fields.nth(0).fill("100");
  await fields.nth(1).fill("50");
  await section.locator("summary").click();
  await expect(section).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(section).toHaveAttribute("open", "");
  await expect(fields.nth(0)).toHaveValue("100");
  await expect(fields.nth(1)).toHaveValue("50");
  await expect(section.getByRole("alert")).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`filters, record disclosures and staff invite feedback fit ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const filter = page.getByRole("button", { name: /^Filter(?: \d+)?$/ });
    await filter.click();
    await expect(filter).toHaveAttribute("aria-expanded", "true");
    const region = page.getByRole("region", { name: "Filter paket" });
    const max = region.locator('input[type="number"]');
    await max.fill("50000");
    await filter.click();
    await filter.click();
    await expect(max).toHaveValue("50000");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await login(page, "customer");
    const customer = (await (await page.request.get("/api/v1/customer")).json())
      .data;
    const support = await page.request.post("/api/v1/commands", {
      data: {
        action: "support.create",
        requestId: crypto.randomUUID(),
        payload: {
          subscriptionId: customer.subscriptions[0].id,
          subject: "Pertanyaan lain",
          description: "Synthetic record disclosure verification.",
        },
      },
    });
    expect(support.ok(), await support.text()).toBe(true);
    await login(page);
    for (const path of ["customers", "transactions", "support"]) {
      await page.goto("/seller/" + path);
      const details = page.locator("details.record-details");
      if (path === "transactions") {
        await page.getByRole("tab", { name: "Pembelian", exact: true }).click();
      }
      if (path === "support") {
        await page.getByRole("tab", { name: /^Bantuan/ }).click();
        await page.locator(".master-detail button.queue-row").first().click();
      }
      if (path === "customers") {
        await page
          .getByRole("button", { name: "Lihat jadwal", exact: true })
          .first()
          .click();
        await expect(page.locator(".customer-delivery-calendar")).toBeVisible();
      } else {
        await details.first().locator("summary").click();
        await expect(details.first().locator("code")).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/seller/settings");
    await page.route("**/api/v1/commands", (route) =>
      route.fulfill({ json: { data: { code: "SYNTHETIC-INVITE-ONLY" } } }),
    );
    await page.getByRole("button", { name: "Buat undangan staf" }).click();
    await expect(page.locator(".notice code")).toHaveText(
      "SYNTHETIC-INVITE-ONLY",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test(`admin submission cannot dismiss while pending and retains failed input ${width}`, async ({
    page,
  }) => {
    await login(page, "platform_admin");
    await page.setViewportSize({ width, height: 900 });
    // Promotion creation was retired. Exercise the same pending/error contract
    // against the current bank-review dialog, using explicitly synthetic reads.
    const destination = {
      id: "synthetic-ui-bank-review",
      version: 1,
      caterer: "Synthetic caterer",
      bank: "Synthetic bank",
      holder: "Synthetic owner",
      maskedAccount: "••••0000",
      accountNumber: "0000000000",
      recipientType: "INDIVIDUAL",
      status: "submitted",
    };
    await page.route("**/api/v1/payout-destination-queue", (route) =>
      route.fulfill({ json: { data: [destination] } }),
    );
    await page.route("**/api/v1/payout-destination-detail/*", (route) =>
      route.fulfill({ json: { data: destination } }),
    );
    await page.goto("/admin/payouts");
    const trigger = page.getByRole("button", { name: "Tinjau rekening" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Verifikasi rekening" });
    await dialog
      .getByRole("combobox", { name: "Keputusan", exact: true })
      .click();
    await page.getByRole("option", { name: "Tolak", exact: true }).click();
    await dialog
      .getByLabel("Alasan keputusan", { exact: true })
      .fill("SYNTHETIC_UI retained reason");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    await page.route("**/api/v1/commands", async (route) => {
      if (route.request().postDataJSON().action !== "payoutDestination.review")
        return route.continue();
      calls++;
      await gate;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "CONFLICT" } }),
      });
    });
    await dialog
      .getByRole("button", { name: "Simpan keputusan", exact: true })
      .click();
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await expect(
      dialog.getByRole("button", { name: "Tutup", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();
    release();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(
      dialog.getByLabel("Alasan keputusan", { exact: true }),
    ).toHaveValue("SYNTHETIC_UI retained reason");
    expect(calls).toBe(1);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
    await expect(trigger).toBeFocused();
  });

  test(`nested photo preview retains editor position and handles unavailable media ${width}`, async ({
    page,
  }) => {
    await login(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/seller/packages");
    await page.getByRole("button", { name: "Buat paket", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Jenis paket", exact: true })
      .click();
    await page.getByRole("option", { name: "À la carte", exact: true }).click();
    await page
      .getByLabel("Nama paket", { exact: true })
      .fill("Synthetic photo");
    await page
      .getByLabel("Cerita paket", { exact: true })
      .fill("Synthetic preview verification.");
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    await page
      .getByRole("button", { name: "Gunakan foto sintetis demo", exact: true })
      .click();
    const trigger = page.getByRole("button", {
      name: "Lihat foto: Foto paket",
      exact: true,
    });
    await trigger.scrollIntoViewIfNeeded();
    const scroll = await page
      .locator(".editor-fields")
      .evaluate((el) => el.scrollTop);
    await trigger.click();
    const preview = page.locator(".photo-preview-dialog");
    await expect(preview).toBeVisible();
    await expect(page.locator(".package-dialog")).toHaveAttribute("inert", "");
    await expect(preview.locator("img")).toBeVisible();
    await page.screenshot({
      path: `output/playwright/conditional-ui/photo-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(
      await page.locator(".editor-fields").evaluate((el) => el.scrollTop),
    ).toBe(scroll);
    await page.route("**/assets/food/ayam-panggang.png", (route) =>
      route.abort(),
    );
    await trigger.click();
    await expect(preview.getByRole("alert")).toBeVisible();
    await page.unroute("**/assets/food/ayam-panggang.png");
    await preview.getByRole("button", { name: "Coba lagi" }).click();
    await expect(preview.locator("img")).toBeVisible();
  });
}

for (const viewport of [
  { width: 740, height: 360 },
  { width: 720, height: 500 },
]) {
  test(`short viewport keeps confirmation and picker usable ${viewport.height}`, async ({
    page,
  }) => {
    await login(page);
    await page.setViewportSize(viewport);
    await page.goto("/seller/profile");
    await page
      .getByRole("button", { name: "Batas perubahan sehari sebelumnya" })
      .click();
    const picker = page.getByRole("dialog", { name: "Pilih waktu" });
    await expect(picker).toBeVisible();
    const bounds = (await picker.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await picker.getByRole("combobox", { name: "Menit" }).click();
    const option = page.getByRole("option", { name: "59", exact: true });
    await option.click();
    await page.keyboard.press("Escape");
    await page.goto("/seller/packages");
    await page.getByRole("button", { name: "Buat paket", exact: true }).click();
    await page
      .getByLabel("Nama paket", { exact: true })
      .fill("Synthetic landscape");
    await page.keyboard.press("Escape");
    const confirmation = page.locator(".dialog-confirmation");
    const box = (await confirmation.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await confirmation.getByRole("button", { name: "Lanjut mengedit" }).click();
    await expect(page.locator(".package-dialog")).not.toHaveAttribute("inert");
  });
}

for (const width of [390, 1440]) {
  test(`customer address, delivery changes and support dialogs fit ${width}`, async ({
    page,
  }) => {
    await login(page, "customer");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/account");
    await page
      .getByRole("button", { name: "Tambah alamat", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Label alamat", { exact: true })
      .fill("Synthetic draft address");
    await dialog.getByRole("combobox", { name: "Area", exact: true }).click();
    await page
      .getByRole("option", { name: "Jakarta Selatan", exact: true })
      .click();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    const state = (await (await page.request.get("/api/v1/customer")).json())
      .data;
    const delivery = state.deliveries.find(
      (d: { canChange: boolean }) => d.canChange,
    );
    expect(delivery).toBeTruthy();
    await page.goto("/deliveries/" + delivery.id);
    for (const label of [
      "Ubah alamat",
      "Ganti tanggal",
      "Lewati & pilih pengganti",
    ]) {
      const trigger = page.getByRole("button", { name: label, exact: true });
      await trigger.click();
      dialog = page.locator(".dialog");
      await expect(dialog).toBeVisible();
      if (label !== "Ubah alamat") {
        const date = dialog.getByRole("button", {
          name: "Tanggal pengganti",
          exact: true,
        });
        await date.click();
        await expect(page.locator(".date-picker-popover")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeVisible();
        await expect(date).toBeFocused();
      }
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
    await page.goto("/support");
    await page
      .getByRole("button", { name: "Ajukan bantuan", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Ceritakan kendalanya")
      .fill("Synthetic support draft");
    await dialog.getByRole("combobox", { name: "Jenis permintaan" }).click();
    await page.getByRole("option", { name: "Lainnya", exact: true }).click();
    expect(
      (await new AxeBuilder({ page }).include(".dialog").analyze()).violations,
    ).toEqual([]);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    // Exercise the review-only branch without changing a delivery in storage.
    const reviewState = structuredClone(state);
    reviewState.deliveries[0].status = "delivered";
    await page.route("**/api/v1/customer?*", (route) =>
      route.fulfill({ json: { data: reviewState } }),
    );
    await page.goto(
      "/subscriptions/" + reviewState.deliveries[0].subscription_id,
    );
    await page.getByRole("button", { name: "Tulis ulasan" }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Ulasan", { exact: true })
      .fill("Synthetic review draft");
    await dialog
      .getByRole("combobox", { name: "Keseluruhan", exact: true })
      .click();
    await page.getByRole("option", { name: "4", exact: true }).click();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await page.unroute("**/api/v1/customer?*");
    await page.goto("/seller/onboarding");
    const disclosure = page
      .locator("details")
      .filter({ hasText: "Saya diundang sebagai staf" });
    await disclosure.locator("summary").click();
    await disclosure.getByLabel("Kode undangan").fill("SYNTHETIC_ONLY");
    await disclosure.locator("summary").click();
    await disclosure.locator("summary").click();
    await expect(disclosure.getByLabel("Kode undangan")).toHaveValue(
      "SYNTHETIC_ONLY",
    );
  });

  test(`financial disclosures retain failed drafts and fit ${width}`, async ({
    page,
  }) => {
    await login(page, "platform_admin");
    await page.setViewportSize({ width, height: 900 });
    // Synthetic UI fixtures: commands are intercepted, so this cannot move funds.
    const data = (await (await page.request.get("/api/v1/admin")).json()).data;
    data.refunds = [
      {
        id: "synthetic-refund",
        case_id: "synthetic-case",
        amount: 120000,
        state: "succeeded",
        reconciliation: null,
      },
    ];
    data.payouts = [
      {
        id: "synthetic-payout",
        caterer_id: data.caterers[0].id,
        catererName: "Synthetic caterer",
        amount: 120000,
        status: "processing",
      },
    ];
    await page.route("**/api/v1/admin", (route) =>
      route.fulfill({ json: { data } }),
    );
    await page.route("**/api/v1/commands", (route) =>
      route.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } }),
    );
    for (const [path, label] of [
      ["support", "Rekonsiliasi refund"],
      ["payouts", "Rekonsiliasi pencairan"],
    ]) {
      await page.goto("/admin/" + path);
      const section = page
        .locator("details")
        .filter({ has: page.locator("summary", { hasText: label }) });
      const trigger = section.locator("summary");
      await trigger.click();
      const inputs = section.locator('input:not([type="hidden"]), textarea');
      for (const input of await inputs.all()) {
        const numeric = (await input.getAttribute("type")) === "number";
        await input.fill(numeric ? "10" : "Synthetic reconciliation draft");
      }
      await trigger.click();
      await expect(section).not.toHaveAttribute("open");
      await trigger.click();
      await expect(inputs.last()).toHaveValue("Synthetic reconciliation draft");
      await section
        .getByRole("button", {
          name:
            path === "support"
              ? "Konfirmasi rekonsiliasi"
              : "Catat penyelesaian",
        })
        .click();
      await expect(section.getByRole("alert")).toBeVisible();
      await expect(inputs.last()).toHaveValue("Synthetic reconciliation draft");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/admin/audit");
    const details = page.locator("details").first();
    await details.locator("summary").click();
    await expect(details.locator("pre")).toBeVisible();
  });
}
