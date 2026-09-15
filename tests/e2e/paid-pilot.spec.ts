import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addDays, localDay } from "@catera/domain";
import { mkdir } from "node:fs/promises";
const cid = "10000000-0000-4000-8000-000000000001";
for (const locale of ["id", "en"])
  for (const width of [390, 1440])
    test(`paid pilot customer import ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      const t = (id: string, en: string) => (locale === "id" ? id : en),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      const options = await (
        await page.request.get("/api/v1/seller-import-options?id=" + cid)
      ).json();
      const source = options.data || options;
      const offer = source.packages.find((p: any) => p.meal === "both");
      const address = source.customers.flatMap((c: any) => c.addresses)[0];
      await page.goto("/seller/customers");
      await page
        .getByRole("button", {
          name: t("Impor prabayar", "Import prepaid"),
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByText(t("CSV / tempel dari Excel", "CSV / paste from Excel"), {
          exact: true,
        })
        .click();
      const name = "Synthetic " + locale + " " + width,
        phone = "+628888" + (locale === "en" ? "1" : "2") + width + "123";
      await dialog
        .getByLabel(t("Data tabel", "Table data"), { exact: true })
        .fill(
          "name\tphone\tline\tarea\tcity\tpackage\tportions\tstartDate\tremainingDays\texternalReference\n" +
            [
              name,
              phone,
              address.line,
              address.area,
              address.city,
              offer.id,
              1,
              addDays(localDay(), 80),
              3,
              "browser-" + locale + width,
            ].join("\t"),
        );
      await dialog
        .getByRole("button", {
          name: t("Periksa tabel", "Review table"),
          exact: true,
        })
        .click();
      await expect(dialog.getByText(name, { exact: true })).toBeVisible();
      await expect(
        dialog.getByText(
          t(
            "Pelanggan baru, akun belum diperlukan",
            "New customer; no account required",
          ),
          { exact: true },
        ),
      ).toBeVisible();
      await dialog
        .getByRole("button", {
          name: t("Konfirmasi impor", "Confirm import"),
          exact: true,
        })
        .click();
      await expect(dialog).not.toBeVisible();
      const card = page
        .locator("article.panel")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(card).toBeVisible();
      await expect(
        card.getByText(t("Dikelola katerer", "Seller managed"), {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        card.getByText(/3 (hari pengantaran tersisa|delivery days remaining)/),
      ).toBeVisible();
      await card
        .getByRole("button", {
          name: t("Undang pelanggan", "Invite customer"),
          exact: true,
        })
        .click();
      await expect(
        dialog.getByRole("link", { name: t("Buka WhatsApp", "Open WhatsApp") }),
      ).toHaveAttribute("href", /^https:\/\/wa.me\//);
      await expect(
        dialog.getByText(
          t(
            "Anda memilih kapan mengirim. Catera tidak dapat memastikan pesan WhatsApp terkirim atau dibaca.",
            "You choose when to send. Catera cannot confirm WhatsApp delivery or reading.",
          ),
          { exact: true },
        ),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include(".pilot-workspace").analyze())
          .violations,
      ).toEqual([]);
      await mkdir("output/playwright/paid-pilot", { recursive: true });
      await page.screenshot({
        path: `output/playwright/paid-pilot/customers-${locale}-${width}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
for (const locale of ["id", "en"])
  test(`renewal and pilot reporting ${locale}`, async ({ page, baseURL }) => {
    const t = (id: string, en: string) => (locale === "id" ? id : en);
    await page
      .context()
      .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
    await page.request.post("/api/v1/auth/demo", {
      data: { role: "customer" },
    });
    const response = await (await page.request.get("/api/v1/customer")).json();
    const data = response.data || response;
    await page.goto("/renew/" + data.subscriptions[0].id);
    await page
      .getByRole("button", {
        name: t(
          "Gunakan alamat & tinjau pembelian",
          "Use address & review purchase",
        ),
        exact: true,
      })
      .click();
    const link = page.getByRole("link", {
      name: t("Lanjutkan ke pembayaran", "Continue to checkout"),
      exact: true,
    });
    await expect(link).toHaveAttribute("href", /renewedFrom=/);
    await link.click();
    await expect(page).toHaveURL(/addressId=/);
    await expect(
      page
        .getByText(t("Porsi setiap hari", "Portions per day"), { exact: true })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: t("Tinjau jadwal & harga", "Review schedule & price"),
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: t("Jadwal makananmu", "Your meal schedule"),
        exact: true,
      }),
    ).toBeVisible();
    await page.request.post("/api/v1/auth/demo", {
      data: { role: "platform_admin" },
    });
    await page.goto("/admin/pilot");
    await expect(
      page.getByRole("heading", {
        name: t("Hasil pilot", "Pilot results"),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        t(
          "Konfigurasi sintetis. Bukan persetujuan untuk menerima pembayaran nyata.",
          "Synthetic configuration. This is not approval to accept real payments.",
        ),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(t("Belum diketahui", "Unknown"), { exact: true }).first(),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include(".pilot-workspace").analyze())
        .violations,
    ).toEqual([]);
  });
