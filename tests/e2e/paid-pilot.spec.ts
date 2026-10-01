import { test, expect } from "@playwright/test";

// Beta restores prepaid migration while keeping standalone acquisition retired.
for (const locale of ["id", "en"])
  for (const width of [390, 1440])
    test(`customers expose prepaid migration without standalone creation ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      await page.goto("/seller/customers");
      await expect(page.locator(".pilot-customer-grid")).toBeVisible();
      const ownerTools = page.locator(".customer-owner-tools").filter({
        hasText:
          locale === "id"
            ? "Tindakan pemilik · impor prabayar"
            : "Owner actions · prepaid import",
      });
      await ownerTools.locator("summary").click();
      await expect(ownerTools).toHaveAttribute("open", "");
      await expect(
        page.getByRole("button", {
          name: /Tambah pelanggan|Add customer|Catat pembayaran eksternal|Record external renewal/,
          includeHidden: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Impor prabayar|Import prepaid/ }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
