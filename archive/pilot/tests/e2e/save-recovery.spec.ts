import { test, expect } from "@playwright/test";

test("an unknown purchase response can only replay its original receipt", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page.getByRole("button", { name: "Tambah pelanggan" }).click();
  const dialog = page.getByRole("dialog");
  const name = "Pemulihan Pembelian " + Date.now();
  await dialog.getByLabel("Nama", { exact: true }).fill(name);
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Data Sintetis No. 91");
  await dialog.getByLabel("Kota", { exact: true }).fill("Jakarta");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name, exact: false }).click();
  await page.getByRole("button", { name: "Catat pembelian" }).click();
  await dialog
    .locator('select[name="package_id"]')
    .selectOption({ label: "Paket Seimbang · 26" });
  await dialog
    .locator('input[name="external_reference"]')
    .fill("Original browser recovery");
  await dialog.getByRole("button", { name: "Tinjau perubahan" }).click();

  const purchaseRequests: string[] = [];
  await page.route("**/w/dapur-hijau/**", async (route) => {
    const request = route.request();
    const body = request.postData() || "";
    if (
      request.method() !== "POST" ||
      !request.headers()["next-action"] ||
      !body.includes('"purchase"')
    ) {
      await route.continue();
      return;
    }
    purchaseRequests.push(body);
    if (purchaseRequests.length === 1) {
      // Execute the real server transaction, then lose only its client response.
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await response.body();
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await dialog.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Hasil penyimpanan belum dapat dipastikan",
  );
  await expect(
    dialog.getByRole("button", { name: "Konfirmasi", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Kembali", exact: true }).click();
  const retainedReference = dialog.locator('input[name="external_reference"]');
  await expect(retainedReference).toHaveValue("Original browser recovery");
  await expect(retainedReference).toBeDisabled();
  await expect(
    dialog.locator('select[name="package_id"] option:checked'),
  ).toHaveText("Paket Seimbang · 26");
  // A stale DOM value must never replace the retained attempted values on reopen.
  await retainedReference.evaluate((element: HTMLInputElement) => {
    element.value = "Changed after unknown save";
  });
  await expect(
    dialog.getByRole("button", { name: "Tinjau perubahan" }),
  ).toBeDisabled();
  expect(purchaseRequests).toHaveLength(1);

  // Dismissing and reopening retains both the original request and recovery UI.
  await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: "Catat pembelian" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Hasil penyimpanan belum dapat dipastikan",
  );
  await expect(dialog.locator('input[name="external_reference"]')).toHaveValue(
    "Original browser recovery",
  );
  await expect(
    dialog.locator('input[name="external_reference"]'),
  ).toBeDisabled();
  await dialog
    .getByRole("button", {
      name: "Coba kembali penyimpanan sebelumnya",
      exact: true,
    })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(purchaseRequests).toHaveLength(2);
  expect(purchaseRequests[1]).toBe(purchaseRequests[0]);
  await expect(page.locator(".purchase-list > *")).toHaveCount(1);
  await expect(
    page.locator(".quota-summary").getByText("26", { exact: true }),
  ).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".purchase-list > *")).toHaveCount(1);
  await expect(
    page.locator(".quota-summary").getByText("26", { exact: true }),
  ).toHaveCount(2);
});

test("an aborted account save visibly retains its attempted phone and address through Escape and reopen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk sebagai pemilik" }).click();
  await page.getByRole("link", { name: /Dapur Hijau/ }).click();
  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page.getByRole("button", { name: "Tambah pelanggan" }).click();
  const dialog = page.getByRole("dialog");
  const name = "Pemulihan Akun " + Date.now();
  await dialog.getByLabel("Nama", { exact: true }).fill(name);
  await dialog.locator('input[name="phone"]').fill("0800000099");
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Akun Sintetis No. 91");
  await dialog.getByLabel("Kota", { exact: true }).fill("Jakarta");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name, exact: false }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.locator('input[name="phone"]').fill("0800000088");
  await dialog
    .getByLabel("Jalan, nomor, dan area")
    .fill("Jl. Akun Sintetis No. 88");
  await dialog
    .locator('textarea[name="instructions"]')
    .fill("Titip di meja resepsionis sintetis");
  const requests: string[] = [];
  await page.route("**/w/dapur-hijau/**", async (route) => {
    const request = route.request();
    const body = request.postData() || "";
    if (
      request.method() !== "POST" ||
      !request.headers()["next-action"] ||
      !body.includes('"save_customer"')
    ) {
      await route.continue();
      return;
    }
    requests.push(body);
    // Keep persisted ...0099 intact on the first try to reproduce stale defaults.
    if (requests.length === 1) await route.abort("failed");
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Hasil penyimpanan belum dapat dipastikan",
  );
  await expect(dialog.locator('input[name="phone"]')).toHaveValue("0800000088");
  await expect(dialog.locator('input[name="phone"]')).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.locator('input[name="phone"]')).toHaveValue("0800000088");
  await expect(dialog.locator('input[name="phone"]')).toBeDisabled();
  await expect(dialog.getByLabel("Jalan, nomor, dan area")).toHaveValue(
    "Jl. Akun Sintetis No. 88",
  );
  await expect(dialog.locator('textarea[name="instructions"]')).toHaveValue(
    "Titip di meja resepsionis sintetis",
  );
  await expect(dialog).toContainText(
    "Nilai di kolom perubahan berasal dari percobaan penyimpanan sebelumnya",
  );
  await expect(
    dialog.getByText("Draf sebelumnya dipulihkan.", { exact: false }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Simpan", exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator(".form-context")).toContainText(
    "Data tersimpan yang tersedia saat ini",
  );
  await expect(dialog.locator(".form-context")).toContainText("0800000099");
  await expect(dialog.locator(".recovery-values-title")).toHaveText(
    "Perubahan yang akan dicoba kembali",
  );
  const values = dialog.getByRole("region", {
    name: "Perubahan yang akan dicoba kembali",
    exact: true,
  });
  await values.focus();
  await expect(values).toBeFocused();
  const initialScroll = await values.evaluate((element) => element.scrollTop);
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => values.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScroll);
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", {
      name: "Coba kembali penyimpanan sebelumnya",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Batal", exact: true }),
  ).toBeFocused();
  expect(requests).toHaveLength(1);
  await dialog
    .getByRole("button", {
      name: "Coba kembali penyimpanan sebelumnya",
      exact: true,
    })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.locator('input[name="phone"]')).toHaveValue("0800000088");
  await expect(dialog.locator('input[name="phone"]')).toBeEnabled();
});
