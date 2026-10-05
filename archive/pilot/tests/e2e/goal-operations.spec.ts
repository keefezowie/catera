import { test, expect, type Page } from "@playwright/test";

async function owner(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Masuk sebagai pemilik", exact: true })
    .click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
  const date = await page.getByLabel("Tanggal kirim").inputValue();
  await expect(page.locator(".date-controls time")).toHaveAttribute(
    "datetime",
    date,
  );
  await expect(page.locator(".date-controls time")).toHaveText(
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(date + "T12:00:00Z")),
  );
  await page.goto("/w/dapur-hijau/admin/delivery?date=" + date);
  await expect(page.locator(".delivery-table tbody tr")).not.toHaveCount(0);
  return date;
}

test("delivery drawer returns keyboard focus to its query-route opener without losing filters or selection", async ({
  page,
}) => {
  await owner(page);
  await page.getByLabel("Saring pekerjaan").selectOption("scheduled");
  await page
    .locator(".delivery-table tbody input[type=checkbox]")
    .first()
    .check();
  const opener = page.locator(".delivery-table tbody a.customer-link").first();
  const customer = await opener.innerText();
  await opener.click();
  const drawer = page.getByRole("dialog", {
    name: "Lihat detail",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(drawer.locator(".delivery-detail h2").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(opener).toHaveText(customer, { useInnerText: true });
  await expect(page.getByLabel("Saring pekerjaan")).toHaveValue("scheduled");
  await expect(
    page.locator(".delivery-table tbody input[type=checkbox]").first(),
  ).toBeChecked();
});

test("selection reviews eligible frozen deliveries without mutating them and restores the action focus", async ({
  page,
}) => {
  await owner(page);
  await expect(page.locator(".batch-actionbar")).toHaveCount(0);
  const statusesBefore = await page
    .locator(".delivery-table tbody .status")
    .allTextContents();
  await page.getByLabel("Pilih semua kiriman di halaman ini").check();
  const opener = page.getByRole("button", { name: /^Tinjau siap \([1-9]/ });
  await expect(opener).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /^Tinjau kirim/ }),
  ).toBeDisabled();
  await opener.click();
  const review = page.getByRole("dialog", {
    name: "Tinjau kiriman yang akan siap",
    exact: true,
  });
  await expect(review).toBeVisible();
  await expect(review.locator(".batch-review-list li")).not.toHaveCount(0);
  await expect(review.locator(".batch-review-list li").first()).toContainText(
    "Revisi",
  );
  await expect(
    review
      .locator(".batch-review-list li")
      .first()
      .locator(".status-scheduled"),
  ).toBeVisible();
  await expect(
    review.locator(".batch-review-list li").first().locator(".status-ready"),
  ).toBeVisible();
  await expect(
    review.getByRole("button", { name: /^Konfirmasi [1-9]/ }),
  ).toBeEnabled();
  await review.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(review).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(
    await page.locator(".delivery-table tbody .status").allTextContents(),
  ).toEqual(statusesBefore);
  await page
    .getByRole("button", { name: "Hapus pilihan", exact: true })
    .click();
  await expect(page.locator(".batch-actionbar")).toHaveCount(0);
});

test("unfrozen future deliveries show their readiness blockers and disable both batch actions", async ({
  page,
}) => {
  const date = await owner(page);
  const future = new Date(date + "T12:00:00Z");
  future.setUTCDate(future.getUTCDate() + 2);
  await page
    .getByLabel("Tanggal kirim")
    .fill(future.toISOString().slice(0, 10));
  await expect(page).toHaveURL(
    new RegExp("date=" + future.toISOString().slice(0, 10)),
  );
  await expect(page.locator(".operations-work-body")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".date-controls time")).toHaveAttribute(
    "datetime",
    future.toISOString().slice(0, 10),
  );
  await page.getByLabel("Pilih semua kiriman di halaman ini").check();
  await expect(
    page.getByRole("button", { name: "Tinjau siap (0)", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Tinjau kirim (0)", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".batch-row-blocker").first()).toBeVisible();
  await expect(page.locator(".batch-action-hint")).toContainText(
    "Tidak ada pilihan yang dapat diproses",
  );
});

// A bookmarked drawer has no clicked element reference to restore.
test("a directly opened delivery query returns focus to the matching row", async ({
  page,
}) => {
  await owner(page);
  const row = page.locator(".delivery-table tbody a.customer-link").first();
  const href = await row.getAttribute("href");
  const id = await row.getAttribute("data-delivery-opener");
  await page.goto(href!);
  await expect(
    page.getByRole("dialog", { name: "Lihat detail", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Lihat detail", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.locator(`[data-delivery-opener="${id}"].customer-link`),
  ).toBeFocused();
});
