import { test, expect, type Page } from "@playwright/test";

async function owner(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Masuk sebagai pemilik", exact: true })
    .click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await expect(page.locator("main h1")).toBeVisible();
  return page.getByLabel("Tanggal kirim").inputValue();
}

test("Today hands complete frozen work directly to an explicit readiness review", async ({
  page,
}) => {
  const date = await owner(page);
  await expect(page.locator(".daily-task > strong")).toHaveText(
    "Produksi lengkap, tinjau kesiapan",
  );
  const statuses = await page
    .locator(".delivery-table tbody .status")
    .allTextContents();
  const trigger = page.getByRole("button", {
    name: /^Tinjau [1-9]\d* kiriman untuk ditandai siap$/,
  });
  await trigger.click();
  const review = page.getByRole("dialog", {
    name: "Tinjau kiriman yang akan siap",
    exact: true,
  });
  await expect(review).toBeVisible();
  await expect(review.locator(".batch-review-list li")).toHaveCount(
    statuses.length,
  );
  await expect(review.locator(".batch-review-list li").first()).toContainText(
    "Revisi 1",
  );
  await expect(
    review.getByRole("button", { name: /^Konfirmasi [1-9]/ }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(review).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(
    await page.locator(".delivery-table tbody .status").allTextContents(),
  ).toEqual(statuses);
  await expect(page.getByLabel("Tanggal kirim")).toHaveValue(date);
  await expect(page.locator("#cycle-production-count")).toHaveText(
    "1 versi terbaru",
  );
  await expect(
    page.getByRole("link", { name: "Produksi", exact: true }),
  ).toHaveAccessibleDescription("1 versi terbaru");
});

test("Production reviews only the selected latest frozen date and slot, then cancels without writes", async ({
  page,
}) => {
  const date = await owner(page);
  await page.getByRole("link", { name: "Produksi", exact: true }).click();
  const slot = await page
    .locator(".production-view select")
    .first()
    .inputValue();
  const trigger = page.getByRole("button", {
    name: /^Tinjau [1-9]\d* kiriman untuk ditandai siap$/,
  });
  await expect(trigger).toBeVisible();
  const count = await page.locator(".production-view tbody tr").count();
  await trigger.click();
  const review = page.getByRole("dialog", {
    name: "Tinjau kiriman yang akan siap",
    exact: true,
  });
  await expect(review.locator(".batch-review-list li")).toHaveCount(count);
  await expect(review.locator(".batch-review-list .status-ready")).toHaveCount(
    count,
  );
  await expect(review.locator(".batch-review-list .batch-blocked")).toHaveCount(
    0,
  );
  await review.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Tanggal kirim")).toHaveValue(date);
  await expect(page.locator(".production-view select").first()).toHaveValue(
    slot,
  );
  await expect(page.locator(".production-next-step a")).toHaveAttribute(
    "href",
    /delivery\?date=.*&slot=/,
  );
});

test("Today keeps future missing meals as a prerequisite instead of offering readiness", async ({
  page,
}) => {
  const date = await owner(page);
  const future = new Date(date + "T12:00:00Z");
  future.setUTCDate(future.getUTCDate() + 2);
  await page
    .getByLabel("Tanggal kirim")
    .fill(future.toISOString().slice(0, 10));
  await expect(page.locator(".daily-task > strong")).toHaveText(
    "Lengkapi pilihan menu",
  );
  await expect(
    page.getByRole("button", { name: /kiriman untuk ditandai siap$/ }),
  ).toHaveCount(0);
  await expect(page.locator(".daily-task a")).toHaveAttribute(
    "href",
    /schedule\?date=.*filter=attention/,
  );
});

// Explicit read-model fixture: alter the Flight response, never production data.
test("Today names incomplete frozen production and withholds readiness", async ({
  page,
}) => {
  const date = await owner(page);
  let changed = false;
  await page.route("**/w/dapur-hijau/admin/today?**", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (
      route.request().headers()["rsc"] === "1" &&
      route
        .request()
        .url()
        .includes("date=" + date)
    ) {
      const patched = body.replace(/"incomplete":0/g, '"incomplete":1');
      changed = patched !== body;
      await route.fulfill({ response, body: patched });
    } else await route.fulfill({ response, body });
  });
  try {
    await page
      .locator(".date-controls")
      .getByRole("button", { name: "Sebelumnya", exact: true })
      .click();
    await expect(page.getByLabel("Tanggal kirim")).not.toHaveValue(date);
    await page
      .locator(".date-controls")
      .getByRole("button", { name: "Berikutnya", exact: true })
      .click();
    await expect(page.getByLabel("Tanggal kirim")).toHaveValue(date);
    await expect(page.locator(".daily-task > strong")).toHaveText(
      "Lengkapi versi produksi",
    );
    expect(changed).toBe(true);
    await expect(
      page.getByRole("button", { name: /kiriman untuk ditandai siap$/ }),
    ).toHaveCount(0);
    await expect(page.locator(".daily-task a")).toHaveAttribute(
      "href",
      /production\?date=/,
    );
  } finally {
    await page.unroute("**/w/dapur-hijau/admin/today?**");
  }
});
