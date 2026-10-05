import { expect, test } from "@playwright/test";

test("contextual help groups tasks and returns to the same production date and slot", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.getByRole("link", { name: "Produksi", exact: true }).click();
  const date = await page.getByLabel("Tanggal kirim").inputValue();
  await page
    .getByLabel("Waktu pengiriman", { exact: true })
    .selectOption({ label: "Makan malam" });
  await expect(page).toHaveURL(/slot=/);
  const slot = new URL(page.url()).searchParams.get("slot");
  await page.locator(".contextual-help").click();
  await expect(page.locator("main h1")).toHaveText("Panduan");
  await expect(page.locator(".help-topic-group")).toHaveCount(3);
  await expect(page.locator(".help-topic-group[open]")).toHaveCount(1);
  await expect(page.locator(".help-topic-group[open]>a")).toHaveCount(4);
  const returnLink = page.locator(".help-article a");
  await expect(returnLink).toHaveAttribute(
    "href",
    `/w/dapur-hijau/admin/production?date=${date}&slot=${slot}`,
  );
  await page
    .locator(".help-topic-group[open]")
    .getByRole("link", { name: "Terbitkan menu per tanggal", exact: true })
    .click();
  await expect(page).toHaveURL(/topic=offerings/);
  await expect(page.locator(".help-article h2")).toHaveText(
    "Terbitkan menu per tanggal",
  );
  await page
    .locator(".help-topic-group[open]")
    .getByRole("link", { name: "Siapkan produksi", exact: true })
    .click();
  await expect(page.locator(".help-article h2")).toHaveText("Siapkan produksi");
  await expect(returnLink).toHaveAttribute(
    "href",
    `/w/dapur-hijau/admin/production?date=${date}&slot=${slot}`,
  );
  await returnLink.click();
  await expect(page.locator("main h1")).toHaveText("Produksi");
  await expect(page.getByLabel("Tanggal kirim")).toHaveValue(date);
  await expect(
    page.getByLabel("Waktu pengiriman", { exact: true }),
  ).toHaveValue(slot!);
});
