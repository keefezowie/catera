import { test, expect } from "@playwright/test";

for (const locale of ["id", "en"]) for (const width of [390, 1440]) {
  test(`prepaid preview, recovery, confirmation and invitation ${locale} ${width}`, async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width, height: 950 });
    await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
    const stamp = Date.now().toString();
    const name = `Synthetic Beta ${locale} ${width} ${stamp}`;
    await page.goto("/seller/customers");
    await page.getByRole("button", { name: /Impor prabayar|Import prepaid/, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: /^(Nama|Name)$/ }).fill(name);
    await dialog.getByRole("textbox", { name: /Nomor WhatsApp|WhatsApp number/ }).fill("081" + stamp.slice(-9));
    await dialog.getByRole("textbox", { name: /^(Alamat pengantaran|Delivery address)$/ }).fill("Jl. Synthetic Beta No. 17");
    await dialog.getByRole("combobox", { name: /Area pengantaran|Delivery area/ }).click();
    await page.getByRole("option").nth(1).click();
    await dialog.getByRole("textbox", { name: /^(Kota|City)$/ }).fill("Jakarta");
    await dialog.getByRole("textbox", { name: /Referensi bukti pembayaran|Payment receipt reference/ }).fill("beta-" + stamp);
    await dialog.getByRole("button", { name: /Periksa jadwal|Review schedule/ }).click();
    await expect(dialog).toContainText(/Belum ada pengantaran dipesan|No deliveries reserved yet/);
    await expect(dialog).toContainText(name);
    await expect(dialog).toContainText("Jl. Synthetic Beta No. 17");
    await dialog.getByRole("button", { name: /Perbaiki data|Edit data/ }).click();
    await expect(dialog.getByRole("textbox", { name: /^(Nama|Name)$/ })).toHaveValue(name);
    await dialog.getByRole("button", { name: /Periksa jadwal|Review schedule/ }).click();
    await dialog.getByRole("checkbox").check();
    let attempts = 0;
    await page.route("**/api/v1/commands", async route => {
      if (route.request().postDataJSON().action === "import.commit" && attempts++ === 0) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "REQUEST_FAILED", message: "Synthetic temporary failure" } }) });
      } else await route.continue();
    });
    await dialog.getByRole("button", { name: /Konfirmasi impor|Confirm import/ }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog).toContainText(name);
    await dialog.getByRole("button", { name: /Konfirmasi impor|Confirm import/ }).click();
    await expect(dialog).toHaveCount(0);
    const card = page.locator(".pilot-customer-grid > article").filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/eksternal|external/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/beta-improvement/prepaid-${locale}-${width}.png`, fullPage: true });
    await card.getByRole("button", { name: /Undang|Invite/ }).click();
    await expect(page.getByRole("dialog")).toContainText(/Pesan siap dikirim|Message ready to send/);
    // Preparing an invitation must not send a real message.
    await expect(page.getByRole("dialog").getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa.me/);
  });
}
