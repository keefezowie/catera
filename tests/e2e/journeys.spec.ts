import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function login(page: Page, role = "pemilik") {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai " + role }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(
    page.getByRole("heading", {
      name:
        role === "pelanggan" ? "Beranda, Nadia." : "Setiap kiriman, tertata.",
      exact: true,
    }),
  ).toBeVisible();
}
test("owner navigates all management screens and preserves date context", async ({
  page,
}) => {
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Setiap kiriman, tertata." }),
  ).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("link", { name: "Produksi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Versi produksi" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unduh CSV" }).click();
  for (const [nav, title] of [
    ["Pelanggan", "Pelanggan"],
    ["Paket", "Paket"],
    ["Menu", "Menu"],
    ["Pengaturan", "Pengaturan"],
  ]) {
    await page.getByRole("link", { name: nav, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true, level: 1 }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Simpan pengecualian" }).click();
  const dialog = page.getByRole("dialog"),
    date = new Date();
  date.setUTCDate(date.getUTCDate() + 13);
  const serviceDate = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() - 1);
  await dialog.getByLabel("Tanggal", { exact: true }).fill(serviceDate);
  await dialog
    .getByLabel(/^Batas perubahan khusus/)
    .fill(date.toISOString().slice(0, 10) + "T20:30");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".setting-row").filter({ hasText: /20[.:]30/ }),
  ).toHaveCount(1);
});
test("owner creates a customer, records quota and schedules deliveries", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page.getByRole("button", { name: "Tambah pelanggan" }).click();
  const dialog = page.getByRole("dialog"),
    name = "Uji Browser " + Date.now();
  await dialog.getByLabel("Nama", { exact: true }).fill(name);
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("test@demo.catera.test");
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Data Sintetis No. 50");
  await dialog.getByLabel("Kota", { exact: true }).fill("Jakarta");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name: name, exact: false }).click();
  await page.getByRole("button", { name: "Catat pembelian" }).click();
  await dialog
    .locator('select[name="package_id"]')
    .selectOption({ label: "Paket Seimbang · 26" });
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".quota-summary").getByText("26", { exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Buat jadwal" }).click();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  await dialog
    .getByLabel("Mulai berlaku")
    .fill(start.toISOString().slice(0, 10));
  await dialog
    .getByLabel("Sampai tanggal")
    .fill(end.toISOString().slice(0, 10));
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await expect(dialog.locator(".schedule-preview li")).not.toHaveCount(0);
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
});
test("subscriber phone layout, meal review and address isolation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "pelanggan");
  await expect(
    page.getByRole("heading", { name: "Kiriman berikutnya" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".bottom-nav")
    .getByRole("link", { name: "Jadwal", exact: true })
    .click();
  await page.locator(".agenda-list>a").last().click();
  await page.getByRole("button", { name: "Pilih menu", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator('select[name="menu_id"]')
    .selectOption({ label: "Tempe teriyaki" });
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await expect(dialog).toContainText("Tempe teriyaki");
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".meal-name")).toHaveText("Tempe teriyaki");
  await page.getByRole("button", { name: "Ubah alamat", exact: true }).click();
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Alamat Uji No. 88");
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Jl. Alamat Uji No. 88", { exact: false }),
  ).toBeVisible();
  await page
    .locator(".bottom-nav")
    .getByRole("link", { name: "Profil", exact: true })
    .click();
  await expect(
    page.getByText("Jl. Alamat Uji No. 88", { exact: false }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true, level: 1 }),
  ).toBeVisible();
});
test("admin phone and tablet fit, and drawer is keyboard accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await login(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".impeccable/review/tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/admin-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Lihat detail Nadia Putri", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("admin and subscriber share changes and delivery confirmation", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    subscriber = await browser.newContext();
  try {
    const admin = await owner.newPage(),
      phone = await subscriber.newPage();
    await login(admin);
    await login(phone, "pelanggan");
    await phone.goto("/w/dapur-hijau/schedule");
    await phone.locator(".agenda-list>a").last().click();
    await expect(phone).toHaveURL(/\/deliveries\/[a-f0-9-]+$/);
    const futureId = phone.url().split("/").pop();
    await phone
      .getByRole("button", { name: "Pilih menu", exact: true })
      .click();
    const review = phone.getByRole("dialog");
    await review
      .locator('select[name="menu_id"]')
      .selectOption({ label: "Tempe teriyaki" });
    await review.getByRole("button", { name: "Tinjau perubahan" }).click();
    await review
      .getByRole("button", { name: "Konfirmasi", exact: true })
      .click();
    await expect(review).not.toBeVisible();
    await admin.goto("/w/dapur-hijau/admin/deliveries/" + futureId);
    await expect(admin.locator(".meal-name")).toHaveText("Tempe teriyaki");
    const before = await admin.locator(".quota-summary").textContent();
    await admin.reload();
    await expect(admin.locator(".quota-summary")).toHaveText(before!);
    await admin.goto("/w/dapur-hijau/admin/today");
    await admin
      .getByRole("link", { name: "Lihat detail Nadia Putri", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toBeVisible();
    const deliveryId = new URL(admin.url()).searchParams.get("delivery");
    await admin.goto("/w/dapur-hijau/admin/deliveries/" + deliveryId);
    const initial = Number(
      await admin.locator(".quota-summary strong").first().textContent(),
    );
    for (const action of [
      "Tandai siap",
      "Mulai pengiriman",
      "Konfirmasi diterima",
    ]) {
      await admin.getByRole("button", { name: action, exact: true }).click();
      const dialog = admin.getByRole("dialog");
      await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
      await dialog
        .getByRole("button", { name: "Konfirmasi", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
    }
    await expect(admin.locator(".quota-summary strong").first()).toHaveText(
      String(initial - 1),
    );
    await phone.goto("/w/dapur-hijau/deliveries/" + deliveryId);
    await expect(phone.locator(".detail-title .status")).toHaveText("Terkirim");
    await expect(phone.locator(".quota-summary strong").first()).toHaveText(
      String(initial - 1),
    );
    await admin.goto("/w/dapur-hijau/admin/delivery");
    const exportUrl = await admin
      .locator(".manifest-links a")
      .first()
      .getAttribute("href");
    const manifest = await owner.request.get(exportUrl!);
    expect(manifest.status()).toBe(200);
    expect(await manifest.text()).toContain("Nadia Putri");
    expect((await subscriber.request.get(exportUrl!)).status()).toBe(403);
    const anonymous = await browser.newContext();
    try {
      expect((await anonymous.request.get(exportUrl!)).status()).toBe(401);
    } finally {
      await anonymous.close();
    }
  } finally {
    await owner.close();
    await subscriber.close();
  }
});

test("a stale subscriber form cannot overwrite an admin address correction", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    subscriber = await browser.newContext();
  try {
    const admin = await owner.newPage(),
      phone = await subscriber.newPage();
    await login(admin);
    await login(phone, "pelanggan");
    await phone.goto("/w/dapur-hijau/schedule");
    await phone.locator(".agenda-list>a").last().click();
    await expect(phone).toHaveURL(/\/deliveries\/[a-f0-9-]+$/);
    const id = phone.url().split("/").pop();
    await phone
      .getByRole("button", { name: "Ubah alamat", exact: true })
      .click();
    await phone
      .getByRole("dialog")
      .getByLabel("Jalan, nomor, dan area")
      .fill("Stale subscriber address 42");
    await admin.goto("/w/dapur-hijau/admin/deliveries/" + id);
    await admin
      .getByRole("button", { name: "Ubah alamat", exact: true })
      .click();
    const dialog = admin.getByRole("dialog");
    await dialog
      .getByLabel("Jalan, nomor, dan area")
      .fill("Current admin address 84");
    await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();
    await dialog
      .getByRole("button", { name: "Konfirmasi", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    // Trigger the same focus refresh used when returning to an open tab.
    await phone.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(phone.locator(".delivery-detail")).toContainText(
      "Current admin address 84",
    );
    const stale = phone.getByRole("dialog");
    await stale.getByRole("button", { name: "Tinjau perubahan" }).click();
    await stale
      .getByRole("button", { name: "Konfirmasi", exact: true })
      .click();
    await expect(stale.getByRole("alert")).toHaveText(
      "Data telah berubah. Muat ulang lalu tinjau perubahanmu.",
    );
  } finally {
    await owner.close();
    await subscriber.close();
  }
});
