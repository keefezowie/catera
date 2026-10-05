import { expect, test, type Page } from "@playwright/test";

async function openAs(
  page: Page,
  baseURL: string | undefined,
  role: "customer" | "owner",
  locale: "id" | "en",
  route: string,
) {
  expect(baseURL).toBeTruthy();
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
  const login = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(login.ok()).toBe(true);
  await page.goto(route);
  await page.evaluate(() => document.fonts.ready);
}

// Keep the CSS viewport unchanged: this exposes text growth that viewport-only
// breakpoints miss. Snapshot computed values before setting any inline styles.
async function doubleText(page: Page) {
  await page.evaluate(() => {
    const sizes = Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    ).map((element) => {
      const style = getComputedStyle(element);
      return {
        element,
        font: parseFloat(style.fontSize),
        line: parseFloat(style.lineHeight),
      };
    });
    for (const { element, font, line } of sizes) {
      element.style.setProperty("font-size", `${font * 2}px`, "important");
      if (Number.isFinite(line))
        element.style.setProperty("line-height", `${line * 2}px`, "important");
    }
  });
}

for (const locale of ["id", "en"] as const) {
  test(`${locale}: customer filter and search keep keyboard focus through delayed loading and failure`, async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "owner", locale, "/seller/customers");
    const workspace = page.locator(".seller-customers");
    await expect(workspace.locator(".customer-row").first()).toBeVisible();
    let hold: "followup" | "search" | "" = "followup";
    let requested = 0;
    let release = () => {};
    await page.route("**/api/v1/seller-customers/**", async (route) => {
      const query = new URL(route.request().url()).searchParams;
      const held = hold;
      if (
        !(held === "followup" && query.get("followup") === "true") &&
        !(held === "search" && query.get("search") === "Nadia")
      )
        return route.continue();
      requested += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      if (held === "followup")
        return route.fulfill({
          status: 503,
          json: { error: { code: "REQUEST_FAILED" } },
        });
      return route.continue();
    });
    try {
      const followup = workspace.getByRole("button", {
        name: locale === "id" ? "Perlu perpanjangan" : "Renewal follow-ups",
        exact: true,
      });
      const filterNode = await followup.elementHandle();
      await followup.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => requested).toBe(1);
      await expect(workspace.locator(".customer-row")).toHaveCount(0);
      await expect(workspace.locator(".customer-search")).toBeVisible();
      await expect(followup).toBeFocused();
      expect(await filterNode!.evaluate((node) => node.isConnected)).toBe(true);
      hold = "";
      release();
      await expect(workspace.getByRole("alert")).toBeVisible();
      await expect(followup).toBeFocused();
      await expect(workspace.locator(".customer-row")).toHaveCount(0);

      const all = workspace.getByRole("button", {
        name: locale === "id" ? "Semua pelanggan" : "All customers",
        exact: true,
      });
      await all.focus();
      await page.keyboard.press("Enter");
      await expect(workspace.locator(".customer-row").first()).toBeVisible();
      await expect(workspace.getByRole("alert")).toHaveCount(0);
      await expect(all).toBeFocused();

      const search = workspace.getByRole("searchbox");
      await search.fill("Nadia");
      const searchNode = await search.elementHandle();
      hold = "search";
      await search.press("Enter");
      await expect.poll(() => requested).toBe(2);
      await expect(workspace.locator(".customer-row")).toHaveCount(0);
      await expect(search).toBeFocused();
      expect(await searchNode!.evaluate((node) => node.isConnected)).toBe(true);
      hold = "";
      release();
      await expect(workspace.locator(".customer-row").first()).toBeVisible();
      await expect(search).toBeFocused();
      await expect(search).toHaveValue("Nadia");
    } finally {
      hold = "";
      release();
    }
  });

  for (const width of [1440, 390]) {
    test(`${locale}: calendar labels remain inside their dates with 200% text at ${width}px`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await openAs(page, baseURL, "customer", locale, "/calendar");
      await expect(page.locator(".coverage-summary")).toContainText(
        locale === "id" ? "hari dengan makan siang" : "days with lunch",
      );
      await expect(
        page.locator(".coverage-package-count").first(),
      ).toBeVisible();
      await doubleText(page);
      const escapedText = await page
        .locator(".coverage-state-text, .coverage-package-count")
        .evaluateAll((labels) =>
          labels.flatMap((label) => {
            const day = label.closest(".coverage-day")!;
            const bounds = day.getBoundingClientRect();
            const walker = document.createTreeWalker(
              label,
              NodeFilter.SHOW_TEXT,
            );
            const problems: string[] = [];
            let node: Node | null;
            while ((node = walker.nextNode())) {
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const rect of Array.from(range.getClientRects())) {
                if (
                  rect.left < bounds.left - 1 ||
                  rect.right > bounds.right + 1 ||
                  rect.top < bounds.top - 1 ||
                  rect.bottom > bounds.bottom + 1
                ) {
                  problems.push(
                    `${day.getAttribute("data-day")}: ${label.textContent}`,
                  );
                  break;
                }
              }
            }
            return problems;
          }),
        );
      expect(escapedText).toEqual([]);
    });
  }

  test(`${locale}: locked menu dates keep their date and lock inside the touch target at 320px`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 320, height: 1000 });
    await openAs(page, baseURL, "owner", locale, "/seller/menus");
    const lockedHeadings = page.locator(".menu-day-heading:has(svg)");
    await expect(lockedHeadings.first()).toBeVisible();
    const escaped = await lockedHeadings.evaluateAll((headings) =>
      headings.flatMap((heading) => {
        const button = heading.closest(".menu-day")!.getBoundingClientRect();
        return Array.from(heading.querySelectorAll("strong, svg"))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.left < button.left - 1 ||
              rect.right > button.right + 1 ||
              rect.top < button.top - 1 ||
              rect.bottom > button.bottom + 1
            );
          })
          .map((element) => `${heading.textContent}: ${element.tagName}`);
      }),
    );
    expect(escaped).toEqual([]);
  });

  test(`${locale}: next-meal photo does not add an empty intrinsic-ratio row on desktop`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openAs(page, baseURL, "customer", locale, "/home");
    const card = page.locator(".home-delivery-column > .next-meal-card");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link")).toBeVisible();
    await expect
      .poll(() =>
        card
          .locator("img")
          .evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    const size = await card.evaluate((element) => {
      const card = element.getBoundingClientRect();
      const photo = element
        .querySelector(".next-meal-photo")!
        .getBoundingClientRect();
      const image = element.querySelector("img")!.getBoundingClientRect();
      const action = element.querySelector("a")!.getBoundingClientRect();
      return {
        height: card.height,
        photoHeight: photo.height,
        imageHeight: image.height,
        actionBottom: action.bottom,
        cardBottom: card.bottom,
      };
    });
    // The seeded next meal is short. A 4:3 photo previously inflated this card
    // to 463px; leave room for localized text without accepting that regression.
    expect(size.height).toBeLessThan(350);
    expect(Math.abs(size.photoHeight - size.imageHeight)).toBeLessThanOrEqual(
      1,
    );
    expect(size.actionBottom).toBeLessThanOrEqual(size.cardBottom);
  });
}
