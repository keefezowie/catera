import { test, expect, type Locator, type Page } from "@playwright/test";

async function enlargeText(page: Page) {
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll<HTMLElement>("body *")].map(
      (element) => {
        const style = getComputedStyle(element);
        return {
          element,
          font: parseFloat(style.fontSize),
          line: parseFloat(style.lineHeight),
        };
      },
    );
    for (const { element, font, line } of sizes) {
      element.style.setProperty("font-size", `${font * 2}px`, "important");
      if (Number.isFinite(line))
        element.style.setProperty("line-height", `${line * 2}px`, "important");
    }
  });
}

async function containedText(controls: Locator) {
  const escaped = await controls.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      const problems: string[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
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
            problems.push(
              `${element.textContent?.trim()} escapes its own control`,
            );
        }
      }
      return problems;
    }),
  );
  expect(
    escaped,
    "Full navigation labels must remain inside their own hit area",
  ).toEqual([]);
}

async function endContentIsReachable(
  page: Page,
  content: Locator,
  bars: Locator,
) {
  // Always test the document end: a fixed bar can obscure a control there even
  // though the same control would be reachable in the middle of a long page.
  await expect
    .poll(async () => {
      await page.evaluate(() =>
        scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        }),
      );
      const box = await content.boundingBox();
      const top = await bars.evaluateAll((elements) =>
        Math.min(
          ...elements.map((element) => element.getBoundingClientRect().top),
        ),
      );
      return Boolean(box && box.y + box.height <= top - 4);
    })
    .toBe(true);
  const blocked = await content.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return !top || !element.contains(top);
  });
  expect(
    blocked,
    "The final content must remain reachable above fixed bottom bars",
  ).toBe(false);
}

for (const locale of ["id", "en"] as const) {
  test.describe(locale, () => {
    test.beforeEach(async ({ page, context, baseURL }) => {
      expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
      expect(
        (await (await page.request.get("/api/v1/me")).json()).data.demo,
      ).toBe(true);
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
    });

    for (const role of ["owner", "customer"] as const) {
      for (const width of [320, 390]) {
        test(`${role} navigation keeps full labels and end content reachable at 200% text ${width}px`, async ({
          page,
        }, testInfo) => {
          await page.setViewportSize({ width, height: 900 });
          expect(
            (
              await page.request.post("/api/v1/auth/demo", { data: { role } })
            ).ok(),
          ).toBe(true);
          await page.goto(role === "owner" ? "/seller/schedule" : "/home");
          const nav = page.locator(
            role === "owner" ? ".seller-bottom" : ".mobile-bottom",
          );
          await expect(nav).toBeVisible();
          const controls = nav.locator("a, button");
          const names =
            role === "owner"
              ? locale === "id"
                ? ["Hari ini", "Jadwal", "Paket", "Menu", "Lainnya"]
                : ["Today", "Schedule", "Packages", "Menus", "More"]
              : locale === "id"
                ? ["Beranda", "Jelajah", "Jadwal", "Pesan", "Akun"]
                : ["Home", "Discover", "Calendar", "Messages", "Account"];
          await expect(controls).toHaveText(names);
          const activeHref = role === "owner" ? "/seller/schedule" : "/home";
          await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
            "href",
            activeHref,
          );
          await enlargeText(page);
          await page.screenshot({
            path: testInfo.outputPath("navigation-enlarged.png"),
          });
          await containedText(controls);
          for (let index = 0; index < names.length; index++) {
            await expect(controls.nth(index)).toHaveAccessibleName(
              names[index],
            );
            if (index === 0) await controls.first().focus();
            else await page.keyboard.press("Tab");
            await expect(controls.nth(index)).toBeFocused();
          }
          await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
            "href",
            activeHref,
          );
          const lastContent =
            role === "customer"
              ? page.locator(".site-footer a").last()
              : page.locator("main :is(a, button, input):visible").last();
          await endContentIsReachable(page, lastContent, nav);
          await page.screenshot({
            path: testInfo.outputPath("navigation-end-content.png"),
          });
        });
      }
    }

    for (const role of ["guest", "customer"] as const) {
      test(`${role} package footer clears the purchase bar before and after text resizing`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width: 320, height: 740 });
        if (role === "customer")
          expect(
            (
              await page.request.post("/api/v1/auth/demo", { data: { role } })
            ).ok(),
          ).toBe(true);
        await page.goto("/packages/ayam-panggang");
        await page.locator(".site-footer").scrollIntoViewIfNeeded();
        await page.evaluate(() =>
          scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "instant",
          }),
        );
        const summary = page.locator(".mobile-purchase-summary");
        await expect(summary).toBeVisible();
        const lastLink = page.locator(".site-footer a").last();
        const bars = page.locator(
          ".mobile-bottom:visible, .mobile-purchase-summary:visible",
        );
        await endContentIsReachable(page, lastLink, bars);
        await enlargeText(page);
        await page.evaluate(() =>
          scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "instant",
          }),
        );
        await expect(summary).toBeVisible();
        await endContentIsReachable(page, lastLink, bars);
        await containedText(summary.locator("strong, .button"));
        await page.screenshot({
          path: testInfo.outputPath("package-footer-enlarged.png"),
        });
        await page
          .getByRole("link", {
            name:
              locale === "id"
                ? "Lihat harga dan pilih porsi"
                : "See pricing and choose portions",
            exact: true,
          })
          .click();
        await expect(page.locator("#package-booking")).toBeInViewport();
        await expect(summary).toHaveCount(0);
        // Removing the conditional purchase bar must release its extra space.
        expect(
          await page.evaluate(() =>
            document.body.style.getPropertyValue("--mobile-purchase-clearance"),
          ),
        ).toBe("");
      });
    }
  });
}
