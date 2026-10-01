import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const evidence = "output/playwright/familiar-settings/after";
test.beforeAll(() => mkdir(evidence, { recursive: true }));
test.beforeEach(async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
});

async function containedText(controls: Locator) {
  const escaped = await controls.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const problems: string[] = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        for (const text of range.getClientRects()) {
          if (
            text.left < box.left - 1 ||
            text.right > box.right + 1 ||
            text.top < box.top - 1 ||
            text.bottom > box.bottom + 1
          )
            problems.push(element.textContent?.trim() || "Unnamed control");
        }
      }
      return problems;
    }),
  );
  expect(
    escaped,
    "Settings control labels remain inside their hit areas",
  ).toEqual([]);
}

async function separateRows(rows: Locator) {
  const overlaps = await rows.evaluateAll((elements) => {
    const boxes = elements.map((element) => element.getBoundingClientRect());
    return boxes.slice(1).flatMap((box, i) => {
      const prior = boxes[i];
      const width =
        Math.min(box.right, prior.right) - Math.max(box.left, prior.left);
      const height =
        Math.min(box.bottom, prior.bottom) - Math.max(box.top, prior.top);
      return width > 1 && height > 1 ? [`${width} × ${height}`] : [];
    });
  });
  expect(overlaps, "Settings rows have separate hit areas").toEqual([]);
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Settings must reflow within the viewport",
  ).toBe(true);
}

for (const role of ["owner", "staff"] as const) {
  for (const locale of ["id", "en"] as const) {
    const t = (id: string, en: string) => (locale === "id" ? id : en);
    for (const width of [320, 390, 1440]) {
      test(`seller settings navigation, role gates and language ${role} ${locale} ${width}`, async ({
        page,
        context,
        baseURL,
      }) => {
        await context.addCookies([
          { name: "catera_locale", value: locale, url: baseURL! },
        ]);
        await page.setViewportSize({ width, height: 1000 });
        expect(
          (
            await page.request.post("/api/v1/auth/demo", { data: { role } })
          ).ok(),
        ).toBe(true);
        await page.goto("/seller/settings");
        const navigation = page.getByRole("navigation", {
          name: t("Bagian pengaturan", "Settings sections"),
          exact: true,
        });
        const settings = page.locator('div[class*="settingsLayout"]');
        await expect(navigation).toBeVisible();
        await expect(settings.locator("#account")).toContainText(
          role === "owner"
            ? t("Pemilik katerer", "Caterer owner")
            : t("Staf katerer", "Caterer staff"),
        );
        await expect(navigation.locator("a")).toHaveCount(
          role === "owner" ? 5 : 3,
        );
        await expect(navigation.locator('a[href="#payout"]')).toHaveCount(
          role === "owner" ? 1 : 0,
        );
        await expect(settings.locator("#payout, #team")).toHaveCount(
          role === "owner" ? 2 : 0,
        );
        for (const link of await navigation.locator("a").all()) {
          const box = await link.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        await containedText(navigation.locator("a"));
        await separateRows(navigation.locator("a"));
        const accountLink = navigation.locator('a[href="#account"]');
        await page.keyboard.press("Tab");
        await accountLink.focus();
        await expect(accountLink).toBeFocused();
        expect(
          await accountLink.evaluate(
            (element) => getComputedStyle(element).outlineStyle !== "none",
          ),
        ).toBe(true);
        await accountLink.press("Enter");
        await expect(page).toHaveURL(/\/seller\/settings#account$/);
        await expect(accountLink).toHaveAttribute("aria-current", "location");

        const language = settings.locator("#account").getByRole("combobox", {
          name: t("Bahasa", "Language"),
          exact: true,
        });
        await expect(language).toContainText(
          locale === "id" ? "Bahasa Indonesia" : "English",
        );
        await language.focus();
        await language.press("Enter");
        await expect(
          page.getByRole("option", { name: "English", exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(language).toBeFocused();
        await language.click();
        await page
          .getByRole("option", {
            name: locale === "id" ? "English" : "Bahasa Indonesia",
            exact: true,
          })
          .click();
        const other = locale === "id" ? "en" : "id";
        await expect(page.locator("html")).toHaveAttribute("lang", other);
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", other);
        await settings.locator("#account").getByRole("combobox").click();
        await page
          .getByRole("option", {
            name: locale === "id" ? "Bahasa Indonesia" : "English",
            exact: true,
          })
          .click();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);

        if (role === "owner") {
          const payoutLink = navigation.locator('a[href="#payout"]');
          await payoutLink.click();
          await expect(page).toHaveURL(/\/seller\/settings#payout$/);
          await expect(payoutLink).toHaveAttribute("aria-current", "location");
          const payout = settings.locator("#payout");
          await expect(payout).toContainText(
            t("setelah diaktifkan", "once enabled"),
          );
          const manageBank = payout.getByRole("button").first();
          await manageBank.click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await expect(dialog).toContainText(
            t(
              "Pengajuan ini tidak mengaktifkan pencairan otomatis.",
              "Submitting does not enable automatic payouts.",
            ),
          );
          await noHorizontalOverflow(page);
          await page.keyboard.press("Escape");
          await expect(dialog).toHaveCount(0);
          await expect(manageBank).toBeFocused();
        }

        const helpLink = navigation.locator('a[href="#help"]');
        await helpLink.click();
        await expect(page).toHaveURL(/\/seller\/settings#help$/);
        await expect(helpLink).toHaveAttribute("aria-current", "location");
        const help = settings.locator("#help");
        const disclosure = help.locator("details");
        const summary = disclosure.locator("summary");
        await expect(summary).toContainText(t("keamanan", "security"));
        await expect(summary).toContainText(
          t("penghapusan akun", "account deletion"),
        );
        expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(
          44,
        );
        await summary.focus();
        await summary.press("Enter");
        await expect(disclosure).toHaveAttribute("open", "");
        const kind = help.getByRole("combobox", {
          name: t("Jenis permintaan", "Request type"),
          exact: true,
        });
        await expect(kind).toContainText(
          t("Bantuan akun & keamanan", "Account & security help"),
        );
        await kind.click();
        await page
          .getByRole("option", {
            name: t("Ajukan penghapusan akun", "Request account deletion"),
            exact: true,
          })
          .click();
        await expect(help).toContainText(
          t(
            "Mengirim permintaan tidak menghapus akun.",
            "Sending a request does not delete your account.",
          ),
        );
        await expect(
          help.getByRole("textbox", {
            name: t("Keterangan", "Details"),
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          help.getByRole("button", {
            name: t("Kirim permintaan", "Send request"),
            exact: true,
          }),
        ).toBeVisible();
        await containedText(help.locator("summary, button, [role=combobox]"));
        await noHorizontalOverflow(page);
        expect(
          (
            await new AxeBuilder({ page })
              .include('div[class*="settingsLayout"]')
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        // This suite opens request and payout forms but never submits commands.
        await summary.focus();
        await summary.press("Space");
        await expect(disclosure).not.toHaveAttribute("open", "");
        await accountLink.click();
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await noHorizontalOverflow(page);
        await containedText(
          settings.locator("#account [role=combobox], #business a"),
        );
        expect(
          await language.evaluate((element) => {
            const label = element.querySelector<HTMLElement>(
              ":scope > span:first-child",
            );
            return !!label && label.scrollWidth <= label.clientWidth + 1;
          }),
          "The complete language name remains visible without ellipsis",
        ).toBe(true);
        await page.screenshot({
          path: `${evidence}/settings-${role}-${locale}-${width}.png`,
          fullPage: true,
        });
      });
    }

    test(`seller settings profile link and verification handoff ${role} ${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.request.post("/api/v1/auth/demo", { data: { role } });
      await page.goto("/seller/settings");
      const profile = page.locator('#business a[href="/seller/profile"]');
      await expect(profile).toContainText(
        t(
          "Profil usaha & area pengantaran",
          "Business profile & delivery coverage",
        ),
      );
      await profile.click();
      await expect(page).toHaveURL(/\/seller\/profile$/);
      await expect(
        page.getByRole("heading", {
          name: t("Profil katerer", "Caterer profile"),
          exact: true,
        }),
      ).toBeVisible();
      await page.goto("/seller/settings#verification");
      await expect(page).toHaveURL(/\/seller\/profile#verification$/);
      if (role === "owner")
        await expect(page.locator("#verification")).toBeVisible();
      else {
        await expect(page.locator("#verification")).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: t("Ajukan verifikasi", "Request verification"),
            exact: true,
          }),
        ).toHaveCount(0);
      }
    });
  }
}
