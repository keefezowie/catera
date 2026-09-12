import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { addDays, localDay } from "@catera/domain";
import { pickDate } from "./date-picker";
const evidence = "output/usability-overhaul";
const cid = "10000000-0000-4000-8000-000000000001";
const login = (page: Page, role = "owner") =>
  page.request.post("/api/v1/auth/demo", { data: { role } });
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function fits(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const box = (await control.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.height).toBeGreaterThanOrEqual(44);
}
for (const width of [360, 390, 768, 1440])
  for (const locale of ["id", "en"]) {
    test(`wizard and operations fit ${width}px in ${locale}`, async ({
      page,
      baseURL,
    }) => {
      await mkdir(evidence, { recursive: true });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await login(page);
      await page.setViewportSize({ width, height: 900 });
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      await page.goto("/seller/packages");
      await page
        .getByRole("button", {
          name: t("Buat paket", "Create package"),
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      const next = dialog.getByRole("button", {
        name: t("Lanjutkan", "Continue"),
        exact: true,
      });
      await fits(page, next);
      await choose(
        page,
        t("Jenis paket", "Package type"),
        t("Nasi box", "Rice box"),
      );
      await page
        .getByLabel(t("Nama paket", "Package name"), { exact: true })
        .fill("Usability package");
      await page
        .getByLabel(t("Cerita paket", "Package story"), { exact: true })
        .fill("Synthetic package for layout verification.");
      await next.click();
      const optional = dialog
        .locator(".optional-section")
        .filter({ hasText: t("Gizi", "Nutrition") });
      await expect(
        dialog.locator(".package-nutrient-range input").first(),
      ).not.toBeVisible();
      await fits(page, next);
      await fits(
        page,
        dialog.getByRole("button", {
          name: t("Simpan draf", "Save draft"),
          exact: true,
        }),
      );
      await page.screenshot({
        path: `${evidence}/contents-${width}-${locale}.png`,
      });
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
          .violations,
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("heading", {
          name: t("Tutup tanpa menyimpan?", "Close without saving?"),
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: t("Lanjut mengedit", "Keep editing") })
        .click();
      await expect(
        page.getByRole("heading", {
          name: t("Paket baru", "New package"),
          exact: true,
        }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: t("Buang perubahan", "Discard changes") })
        .click();
      await page.goto("/seller?meal=lunch");
      const rows = page.locator(".ops-order-table tbody tr");
      await expect(rows.first()).toBeVisible();
      const detail = rows
        .first()
        .getByRole("button", {
          name: new RegExp("^" + t("Detail ", "Details ")),
        });
      await fits(page, detail);
      const quantity = rows.first().locator('[data-cell="portions"]');
      await expect(quantity).toBeVisible();
      if (width <= 800) {
        expect(
          await page
            .locator(".ops-orders-panel .table-wrap")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await expect(page.locator(".seller-bottom")).toBeVisible();
      }
      await detail.click();
      await expect(page.locator(".detail-panel")).toBeFocused();
      await page.screenshot({
        path: `${evidence}/order-${width}-${locale}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include("#main").analyze()).violations,
      ).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

test("draft resumes, optional fields reveal errors, and 200% zoom keeps footer reachable", async ({
  page,
}) => {
  await login(page);
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  const name = "Draf kemudahan " + Date.now();
  await page.getByLabel("Nama paket", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Simpan draf", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  const card = page
    .locator(".seller-packages article")
    .filter({ hasText: name });
  await card.getByRole("button", { name: "Kelola paket" }).click();
  await expect(page.getByLabel("Nama paket", { exact: true })).toHaveValue(
    name,
  );
  // 200% browser zoom on a 1440 x 1000 display exposes a 720 x 500 CSS viewport.
  await page.setViewportSize({ width: 720, height: 500 });
  const next = page
    .getByRole("dialog")
    .getByRole("button", { name: "Lanjutkan", exact: true });
  await fits(page, next);
  const box = (await next.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({ path: `${evidence}/wizard-200-percent.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("phone importer preserves edits, previews readable dates, and commits once", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const options = (
    await (
      await page.request.get("/api/v1/seller-import-options/" + cid)
    ).json()
  ).data;
  const customer = options.customers.find((c: any) => c.addresses.length);
  expect(customer).toBeTruthy();
  // A unique package prevents overlap with other independently running journey fixtures.
  const seller = (
    await (await page.request.get("/api/v1/seller/" + cid)).json()
  ).data;
  const offer = seller.offers.find(
    (p: any) =>
      p.status === "published" && p.areas.includes(customer.addresses[0].area),
  );
  const name = "Impor mudah " + Date.now();
  const created = await page.request.post("/api/v1/commands", {
    data: {
      action: "package.save",
      requestId: crypto.randomUUID(),
      payload: {
        catererId: cid,
        slug: "import-" + crypto.randomUUID(),
        offer: { ...offer, name, status: "published" },
      },
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  await page.goto("/seller/customers");
  await page.getByRole("button", { name: "Impor langganan prabayar" }).click();
  await choose(page, "Pelanggan", customer.name);
  await choose(page, "Paket", name);
  const address = customer.addresses[0];
  await choose(
    page,
    "Alamat pengantaran",
    `${address.label} · ${address.line}, ${address.area}`,
  );
  await pickDate(page, "Mulai pengantaran", addDays(localDay(), 50));
  await page.getByLabel("Nomor bukti pembayaran").fill("Receipt-" + Date.now());
  await page.getByLabel("Sisa hari yang sudah dibayar").fill("2");
  // A rejected preview must leave every entered value available for correction.
  await page.route("**/api/v1/commands", async (route) => {
    if (route.request().postDataJSON()?.action === "import.preview")
      await route.fulfill({ status: 409, json: { error: { code: "CAPACITY" } } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Periksa langganan" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Sisa hari yang sudah dibayar")).toHaveValue("2");
  await expect(page.locator(".form-error")).toBeFocused();
  await page.unroute("**/api/v1/commands");
  await page.getByRole("button", { name: "Periksa langganan" }).click();
  await expect(page.locator(".import-preview")).toContainText(customer.name);
  await expect(page.locator(".import-preview")).toContainText("2 hari");
  await expect(page.getByRole("dialog").locator("pre")).toHaveCount(0);
  await page.getByRole("button", { name: "Perbaiki data" }).click();
  await expect(page.getByLabel("Sisa hari yang sudah dibayar")).toHaveValue(
    "2",
  );
  await page.getByRole("button", { name: "Periksa langganan" }).click();
  await expect(page.locator(".import-preview")).toBeVisible();
  await page.screenshot({ path: `${evidence}/import-390.png`, fullPage: true });
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("checkbox").check();
  const commit = page.waitForResponse(
    (r) =>
      r.url().endsWith("/commands") &&
      r.request().postDataJSON()?.action === "import.commit",
  );
  await page.getByRole("button", { name: "Konfirmasi impor" }).click();
  const response = await commit;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("messages tabs, shopping-only comparison, and delivery details keep the next task clear", async ({
  page,
}) => {
  await login(page);
  await page.goto("/seller/support");
  const help = page.getByRole("tab", { name: /^Bantuan/ });
  await page.getByRole("tab", { name: /^Pesan/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(help).toBeFocused();
  await expect(help).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#inbox-messages")).toBeHidden();
  await login(page, "customer");
  await page.goto("/discover");
  await page
    .getByRole("button", { name: "Bandingkan: Rantang Nusantara", exact: true })
    .click();
  await expect(page.locator(".compare-floating")).toBeVisible();
  for (const path of [
    "/messages",
    "/account",
    "/checkout/20000000-0000-4000-8000-000000000001",
  ]) {
    await page.goto(path);
    await expect(page.locator(".compare-floating")).toHaveCount(0);
  }
  await page.goto("/discover");
  await expect(page.locator(".compare-floating")).toBeVisible();
  const state = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const delivery = state.deliveries[0];
  expect(delivery).toBeTruthy();
  await page.goto("/deliveries/" + delivery.id);
  await expect(
    page.getByRole("link", { name: "Lihat pengantaran", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".delivery-summary")).toContainText(
    delivery.address.line,
  );
  await expect(page.locator(".delivery-actions")).toBeVisible();
});

test("readiness follows correction, submission and an admin decision", async ({ page }) => {
  async function decision(status: string) {
    await login(page, "platform_admin");
    await page.goto("/admin/sellers");
    await page.getByRole("button", { name: "Semua katerer", exact: true }).click();
    await page.getByRole("button", { name: /Dapur Senja/ }).click();
    await choose(page, "Keputusan", status);
    await page.getByLabel("Alasan / koreksi yang diperlukan").fill("Synthetic usability verification review.");
    const response = page.waitForResponse((r) => r.url().endsWith("/commands") && r.request().postDataJSON()?.action === "admin.verify");
    await page.getByRole("button", { name: "Simpan keputusan verifikasi" }).click();
    const result = await response; expect(result.ok(), await result.text()).toBe(true);
  }
  try {
    await decision("Minta perbaikan");
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/seller/settings");
    await expect(page.locator(".seller-readiness")).toContainText("Synthetic usability verification review.");
    await page.getByRole("button", { name: "Ajukan verifikasi" }).click();
    await expect(page.locator(".seller-readiness")).toContainText("Profil sedang ditinjau Catera");
    await page.screenshot({ path: `${evidence}/readiness-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await decision("Setujui katerer");
    await login(page);
    await page.goto("/seller");
    await expect(page.locator(".seller-readiness")).toHaveCount(0);
  } finally {
    // Restore only this isolated synthetic caterer even if an assertion fails.
    await login(page, "platform_admin");
    const state = (await (await page.request.get("/api/v1/admin")).json()).data;
    const seller = state.caterers.find((c: any) => c.id === cid);
    if (seller.status !== "approved") await page.request.post("/api/v1/commands", { data: { action: "admin.verify", requestId: crypto.randomUUID(), payload: { id: cid, version: seller.version, status: "approved", reason: "Restore isolated synthetic test approval." } } });
  }
});
