import { expect, test } from "@playwright/test";

for (const locale of ["id", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`staff invitation actions remain separate and account history clears the form ${locale} ${width}`, async ({
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
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.setViewportSize({ width, height: 1000 });
      expect(
        (
          await page.request.post("/api/v1/auth/demo", {
            data: { role: "owner" },
          })
        ).ok(),
      ).toBe(true);
      await page.route("**/api/v1/account-requests", (route) =>
        route.fulfill({ json: { data: [] } }),
      );
      const code = "SYNTHETIC-INVITE-ONLY-0123456789-ABCDEFGHIJKLMN";
      await page.route("**/api/v1/commands", (route) => {
        expect(route.request().postDataJSON().action).toBe("staff.invite");
        return route.fulfill({ json: { data: { code } } });
      });
      await page.goto("/seller/settings");
      await page
        .getByRole("button", {
          name: locale === "id" ? "Buat undangan staf" : "Create staff invite",
          exact: true,
        })
        .click();
      const result = page
        .locator(".notice")
        .filter({ has: page.locator("code") });
      await expect(result.locator("code")).toHaveText(code);
      const copy = result.getByRole("button", {
        name: locale === "id" ? "Salin kode undangan" : "Copy invitation code",
        exact: true,
      });
      const onboarding = result.getByRole("link", {
        name: locale === "id" ? "Halaman mitra" : "Partner onboarding",
        exact: true,
      });
      const history = page
        .locator("#help")
        .getByText(
          locale === "id" ? "Belum ada permintaan." : "No requests yet.",
          { exact: true },
        );
      const submit = page.locator("#help").getByRole("button", {
        name: locale === "id" ? "Kirim permintaan" : "Send request",
        exact: true,
      });
      for (const zoom of width === 390 ? [1, 2] : [1]) {
        if (zoom === 2) {
          for (const root of [result, page.locator("#help")]) {
            await root.evaluate((element) => {
              const elements = [
                element,
                ...element.querySelectorAll("*"),
              ].filter(
                (child): child is HTMLElement => child instanceof HTMLElement,
              );
              const sizes = elements.map((child) =>
                parseFloat(getComputedStyle(child).fontSize),
              );
              elements.forEach((child, index) =>
                child.style.setProperty(
                  "font-size",
                  `${sizes[index] * 2}px`,
                  "important",
                ),
              );
            });
          }
        }
        // Smooth scrolling can move the page between separate boundingBox
        // calls. Compare every rectangle from the same layout frame.
        const { a, b, parent, historyBox, submitBox } = await page.evaluate(
          ({ copy, onboarding, result, history, submit }) => {
            if (!copy || !onboarding || !result || !history || !submit)
              throw new Error("Staff invite controls must remain mounted");
            const bounds = (element: Element) => {
              const { x, y, width, height } = element.getBoundingClientRect();
              return { x, y, width, height };
            };
            return {
              a: bounds(copy),
              b: bounds(onboarding),
              parent: bounds(result),
              historyBox: bounds(history),
              submitBox: bounds(submit),
            };
          },
          {
            copy: await copy.elementHandle(),
            onboarding: await onboarding.elementHandle(),
            result: await result.elementHandle(),
            history: await history.elementHandle(),
            submit: await submit.elementHandle(),
          },
        );
        expect(a.height).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(
          a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y,
        ).toBe(false);
        expect(
          b.y >= a.y + a.height ? b.y - a.y - a.height : b.x - a.x - a.width,
        ).toBeGreaterThanOrEqual(8);
        expect(b.x + b.width).toBeLessThanOrEqual(parent.x + parent.width);
        expect(
          historyBox.y - submitBox.y - submitBox.height,
        ).toBeGreaterThanOrEqual(20);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `output/playwright/ui-refinement-2026-09-30/census/staff-invite-refined-${locale}-${width}-${zoom}x.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      await copy.focus();
      await page.keyboard.press("Tab");
      await expect(onboarding).toBeFocused();
      await copy.click();
      await expect(page.locator(".toast")).toContainText(
        locale === "id" ? "Kode disalin" : "Code copied",
      );
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        code,
      );
      await page.evaluate(() => {
        navigator.clipboard.writeText = async () => {
          throw new Error("Synthetic clipboard rejection");
        };
      });
      await copy.click();
      await expect(page.locator(".toast")).toContainText(
        locale === "id"
          ? "Pilih dan salin kode di atas"
          : "Select and copy the code above",
      );
      await expect(result.locator("code")).toHaveText(code);
    });
  }
}
