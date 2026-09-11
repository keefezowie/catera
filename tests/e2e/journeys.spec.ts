import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localDay, addDays } from "@catera/domain";
import { pickDate } from "./date-picker";
async function login(page: Page, role = "customer") {
  const r = await page.request.post("/api/v1/auth/demo", { data: { role } });
  expect(r.ok()).toBe(true);
}
test("customer purchase, schedule change, support review and renewal", async ({
  page,
}) => {
  await login(page);
  const existing = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const last =
    existing.subscriptions
      .filter((s: { package_id: string }) => s.package_id.endsWith("003"))
      .map((s: { ends_on: string }) => s.ends_on)
      .sort()
      .at(-1) || localDay();
  const start = addDays(
    last > addDays(localDay(), 250) ? last : addDays(localDay(), 250),
    7,
  );
  const requestText = "Permintaan sintetis dari pengujian perjalanan " + start;
  await page.goto("/discover");
  await page
    .getByRole("button", { name: "Bandingkan: Rantang Nusantara", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Bandingkan: Plant-based Everyday",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Bandingkan", exact: true }).click();
  await expect(page.locator("table.comparison")).toBeVisible();
  await page.getByLabel("Porsi perbandingan").fill("2");
  await page.goto("/checkout/20000000-0000-4000-8000-000000000003?portions=2");
  await pickDate(page, "Mulai tanggal", start);
  await page.getByRole("button", { name: "Tinjau jadwal & harga" }).click();
  await expect(page.locator(".schedule-preview>div")).toHaveCount(10);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Lanjutkan ke pembayaran" }).click();
  await expect(page).toHaveURL(/\/payment\//);
  await page
    .getByRole("button", { name: "Simulasikan pembayaran berhasil" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Makanan baik sudah dijadwalkan." }),
  ).toBeVisible();
  const subs = (
    await (
      await page.request.get(
        "/api/v1/customer?from=" +
          addDays(start, -1) +
          "&to=" +
          addDays(start, 59),
      )
    ).json()
  ).data;
  const delivery = subs.deliveries.find(
    (d: { offer: { id: string }; canChange: boolean }) =>
      d.offer.id.endsWith("003") && d.canChange,
  );
  await page.goto("/deliveries/" + delivery.id);
  await page
    .getByRole("button", { name: "Ganti tanggal", exact: true })
    .click();
  const dates = (
    await (
      await page.request.get(
        "/api/v1/availability/" +
          delivery.id +
          "?from=" +
          addDays(delivery.service_date, 21) +
          "&to=" +
          addDays(delivery.service_date, 40),
      )
    ).json()
  ).data;
  const target = dates.find((d: { available: boolean }) => d.available).date;
  await pickDate(page, "Tanggal pengganti", target);
  await page.getByRole("button", { name: "Tinjau perubahan" }).click();
  await expect(page.getByText("Menjadi", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Konfirmasi tanggal pengganti" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Laporkan masalah" }).click();
  await page.getByRole("combobox", { name: "Jenis permintaan" }).click();
  await page.getByRole("option", { name: "Ajukan pembatalan", exact: true }).click();
  await page.getByLabel("Ceritakan kendalanya").fill(requestText);
  await page.getByRole("button", { name: "Kirim permintaan bantuan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".support-case").filter({ hasText: requestText }),
  ).toBeVisible();
  const check = (
    await (
      await page.request.get("/api/v1/customer?deliveryId=" + delivery.id)
    ).json()
  ).data;
  expect(check.deliveries[0].status).toBe("scheduled");
  await page.goto("/subscriptions/" + delivery.subscription_id);
  await expect(
    page.getByRole("link", { name: "Beli paket berikutnya" }),
  ).toBeVisible();
});
test("customer and operational routes render, retain context and pass critical accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/home");
  await expect(page.locator(".next-meal-card")).toBeVisible();
  await page.screenshot({
    path: "output/playwright/customer-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/customer-phone.png",
    fullPage: true,
  });
  await page.goto("/calendar");
  await expect(page.locator("#main .coverage-strip")).toBeVisible();
  await page.screenshot({
    path: "output/fixes-verification/calendar-phone.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Akunmu, keseharianmu." }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    audit.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  const customerState = (await (await page.request.get("/api/v1/customer")).json()).data;
  const serviceDate = customerState.deliveries.find(
    (delivery: { offer: { id: string }; status: string }) =>
      delivery.offer.id.endsWith("001") && delivery.status === "scheduled",
  )?.service_date;
  expect(serviceDate).toBeTruthy();
  await login(page, "owner");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/seller?date=" + serviceDate);
  await expect(
    page.getByRole("heading", { name: "Keluar dari dapur hari ini" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/seller-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /2 Produksi/ }).click();
  await expect(page).toHaveURL(/date=.*meal=all/);
  await page
    .getByRole("button", { name: "Simpan revisi & buat manifest" })
    .click();
  await expect(page.getByRole("link", { name: /Unduh CSV/ })).toBeVisible();
  const href = await page
    .getByRole("link", { name: /Unduh CSV/ })
    .getAttribute("href");
  const manifest = await page.request.get(href!);
  expect(manifest.ok()).toBe(true);
  expect(await manifest.text()).toContain("Ayam Panggang Harian");
  for (const route of [
    "packages",
    "menus",
    "capacity",
    "customers",
    "support",
    "transactions",
    "settings",
  ]) {
    await page.goto("/seller/" + route);
    await expect(page.locator(".error-notice")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/seller/delivery?date=" + serviceDate);
  await expect(
    page.getByRole("button", { name: "Detail Ayam Panggang Harian" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Detail Ayam Panggang Harian" }).click();
  await page.screenshot({
    path: "output/playwright/seller-phone.png",
    fullPage: true,
  });
  await login(page, "platform_admin");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Antrean verifikasi" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Semua katerer", exact: true })
    .click();
  await page.getByRole("button", { name: /Dapur Senja/ }).click();
  await page.screenshot({
    path: "output/playwright/admin-desktop.png",
    fullPage: true,
  });
  for (const route of [
    "transactions",
    "support",
    "payouts",
    "promotions",
    "reviews",
    "audit",
  ]) {
    await page.goto("/admin/" + route);
    await expect(page.locator(".error-notice")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test("API forbids customer admin access, cross-origin writes and unsigned payment events", async ({
  request,
}) => {
  await request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  expect((await request.get("/api/v1/admin")).status()).toBe(403);
  expect(
    (
      await request.post("/api/v1/commands", {
        headers: { Origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/webhooks/xendit", {
        data: { data: { status: "COMPLETED" } },
      })
    ).status(),
  ).toBe(401);
});
