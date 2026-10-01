import { test, expect, type Page } from "@playwright/test";
import type { SellerState } from "@catera/domain";

type Locale = "id" | "en";
const catererId = "10000000-0000-4000-8000-000000000001";

async function step(
  page: Page,
  locale: Locale,
  width: number,
  number: number,
  keyboard = false,
) {
  const label =
    number === 3
      ? locale === "id"
        ? "Harga & lama paket"
        : "Price & package length"
      : locale === "id"
        ? "Pengantaran"
        : "Delivery";
  const editor = page.locator(".package-dialog");
  if (width < 600) {
    const trigger = editor.getByRole("combobox", {
      name: locale === "id" ? "Langkah paket" : "Package steps",
      exact: true,
    });
    if (keyboard) {
      await trigger.focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("option", { selected: true })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(
        page.getByRole("option", { name: `${number}. ${label}`, exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      return;
    }
    await trigger.click();
    await page
      .getByRole("option", { name: `${number}. ${label}`, exact: true })
      .click();
  } else {
    await editor
      .getByRole("button", { name: `${number}. ${label}`, exact: true })
      .click();
  }
}

for (const locale of ["id", "en"] as const)
  for (const width of [390, 1440])
    test(`package price errors retain guidance and localize bounds ${locale} ${width}`, async ({
      page,
      context,
      baseURL,
    }) => {
      expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
      expect(
        (await (await page.request.get("/api/v1/me")).json()).data.demo,
      ).toBe(true);
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width, height: 900 });
      expect(
        (
          await page.request.post("/api/v1/auth/demo", {
            data: { role: "owner" },
          })
        ).ok(),
      ).toBe(true);
      const state = (
        await (await page.request.get(`/api/v1/seller/${catererId}`)).json()
      ).data as SellerState;
      const original = state.offers.find(
        (offer) => offer.status === "published" && offer.meal === "both",
      )!;
      expect(original).toBeTruthy();
      const fixture = {
        ...original,
        id: "99999999-0000-4000-8000-000000000006",
        status: "draft",
        name: "Synthetic price presentation",
        price: 70000,
      };
      // Expose an editable draft without saving commercial data.
      await page.route(`**/api/v1/seller/${catererId}*`, (route) =>
        route.fulfill({ json: { data: { ...state, offers: [fixture] } } }),
      );
      const commands: string[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.url().endsWith("/api/v1/commands"))
          commands.push(request.postData() || "");
      });
      await page.goto(`/seller/packages?edit=${fixture.id}`);
      const editor = page.locator(".package-dialog");
      await expect(editor).toBeVisible();
      await step(page, locale, width, 3);
      const priceField = editor.locator('[data-editor-field="price"]');
      const price = priceField.locator("input");
      const minimum =
        locale === "id"
          ? "Masukkan harga minimal Rp 1.000."
          : "Enter a price of at least Rp 1.000.";
      for (const invalid of ["0", "999"]) {
        await price.fill(invalid);
        await step(page, locale, width, 4, invalid === "999");
        await expect(price).toBeFocused();
        await expect(price).toHaveAttribute("aria-invalid", "true");
        await expect(priceField.locator(".field-error")).toHaveText(minimum);
        await expect(editor.locator("[data-editor-errors] li")).toContainText(
          minimum,
        );
        await expect(priceField.locator(".field-description")).toContainText(
          locale === "id"
            ? "harga ini sudah mencakup kedua makanan"
            : "this price covers both meals",
        );
        const references = await price.evaluate((input) =>
          (input.getAttribute("aria-describedby") || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => ({
              id,
              className: document.getElementById(id)?.className,
            })),
        );
        expect(references).toHaveLength(2);
        expect(references.map((reference) => reference.className)).toEqual([
          "field-description",
          "field-error",
        ]);
        await expect(editor).not.toContainText("Too small:");
      }
      // Existing custom bilingual validation still describes an empty price.
      await price.fill("");
      await step(page, locale, width, 4);
      await expect(priceField.locator(".field-error")).toHaveText(
        locale === "id" ? "Isi harga per porsi" : "Enter the price per portion",
      );
      await price.fill("10000001");
      await step(page, locale, width, 4);
      await expect(price).toBeFocused();
      await expect(priceField.locator(".field-error")).toHaveText(
        locale === "id"
          ? "Masukkan harga maksimal Rp 10.000.000."
          : "Enter a price of at most Rp 10.000.000.",
      );
      await price.fill("70000");
      await step(page, locale, width, 4);
      await expect(
        editor.locator('[data-editor-field="capacity"] input'),
      ).toBeVisible();
      if (width < 600) {
        const trigger = editor.getByRole("combobox", {
          name: locale === "id" ? "Langkah paket" : "Package steps",
          exact: true,
        });
        await expect(trigger).toBeFocused();
        await trigger.press("Space");
        await expect(page.getByRole("listbox")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("listbox")).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
      expect(
        await editor.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      expect(commands).toEqual([]);
      expect(errors).toEqual([]);
    });
