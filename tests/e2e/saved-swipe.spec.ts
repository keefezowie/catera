import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
async function login(page: Page) {
  expect(
    (
      await page.request.post("/api/v1/auth/demo", {
        data: { role: "customer" },
      })
    ).ok(),
  ).toBe(true);
}
async function clearSaved(page: Page) {
  const state = (
    await (await page.request.get("/api/v1/saved-packages")).json()
  ).data;
  for (const packageId of state.packageIds)
    expect(
      (
        await page.request.post("/api/v1/commands", {
          data: {
            action: "savedPackage.set",
            payload: { packageId, saved: false },
            requestId: crypto.randomUUID(),
          },
        })
      ).ok(),
    ).toBe(true);
}
async function drag(page: Page, distance: number, duration: number) {
  await expect
    .poll(async () => {
      const photo = await page
        .locator('.discovery-slide[data-active="true"] .discovery-photo')
        .boundingBox();
      const window = await page.locator(".discovery-window").boundingBox();
      return Math.abs(photo!.y - window!.y);
    })
    .toBeLessThan(2);
  const box = await page
    .locator('.discovery-slide[data-active="true"] .discovery-photo')
    .boundingBox();
  const client = await page.context().newCDPSession(page);
  const x = box!.x + box!.width / 2,
    y = box!.y + box!.height / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(duration / 5);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - (distance * i) / 5 }],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}
test.beforeEach(async ({ page, context, baseURL }) => {
  if (process.env.CATERA_CAPTURE_SAVED === "true") {
    await mkdir("output/saved-swipe/screenshots", { recursive: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
  await context.addCookies([
    { name: "catera_locale", value: "en", url: baseURL! },
  ]);
});
test("mobile defaults to a list; swipe gestures move one card; short swipes cancel", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("section#packages .package-grid").last()).toBeVisible();
  await expect(page.locator(".discovery-feed")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/?view=swipe");
  await expect(page.locator(".discovery-feed")).toBeVisible();
  const active = page.locator('.discovery-slide[data-active="true"]');
  const first = await active.getAttribute("data-package-id");
  await drag(page, 8, 300);
  await expect(active).toHaveAttribute("data-package-id", first!);
  await drag(page, 65, 600);
  const second = await active.getAttribute("data-package-id");
  expect(second).not.toBe(first);
  await drag(page, 180, 25);
  await expect(page.locator(".discovery-navigation")).toContainText("3 /");
  await page
    .getByRole("button", { name: "Previous package", exact: true })
    .click();
  await expect(active).toHaveAttribute("data-package-id", second!);
  await page.locator(".discovery-viewport").focus();
  await page.keyboard.press("ArrowUp");
  await expect(active).toHaveAttribute("data-package-id", first!);
  await expect(
    page.getByRole("button", { name: "Previous package", exact: true }),
  ).toBeDisabled();
  const count = await page.locator(".discovery-slide").count();
  for (let i = 1; i < count; i++) {
    await page
      .getByRole("button", { name: "Next package", exact: true })
      .click();
    await expect(page.locator(".discovery-navigation")).toContainText(
      i + 1 + " /",
    );
  }
  await expect(
    page.getByRole("button", { name: "Next package", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".discovery-navigation")).toContainText(
    "Last package",
  );
});
test("guest save returns through login to the same filtered card and saves once", async ({
  page,
}) => {
  await login(page);
  await clearSaved(page);
  await page.request.post("/api/v1/auth/logout", { data: {} });
  await page.goto("/?view=swipe&meal=lunch");
  await page.getByRole("button", { name: "Next package", exact: true }).click();
  const id = await page
    .locator('.discovery-slide[data-active="true"]')
    .getAttribute("data-package-id");
  await page
    .locator('.discovery-slide[data-active="true"] .save-package')
    .click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page
    .getByRole("button", { name: "Explore as customer", exact: true })
    .click();
  await expect(
    page.locator('.discovery-slide[data-active="true"]'),
  ).toHaveAttribute("data-package-id", id!);
  await expect(
    page.locator('.discovery-slide[data-active="true"] .save-package'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/meal=lunch/);
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/saved-packages")).json()).data
          .packageIds,
    )
    .toEqual([id]);
  await page.reload();
  await expect(
    page.locator('.discovery-slide[data-active="true"] .save-package'),
  ).toHaveAttribute("aria-pressed", "true");
});
test("save confirmation synchronizes feed, list, details and Saved; errors remain retryable", async ({
  page,
}) => {
  await login(page);
  await clearSaved(page);
  await page.goto("/?view=swipe");
  const active = page.locator('.discovery-slide[data-active="true"]');
  const name = await active.locator("h2").innerText();
  const save = active.locator(".save-package");
  await page.route("**/api/v1/commands", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "REQUEST_FAILED" } }),
    }),
  );
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await expect(save).toBeEnabled();
  await page.unroute("**/api/v1/commands");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await active.getByRole("link", { name: "View package", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove from Saved: " + name }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("link", { name: "Discover", exact: true })
    .first()
    .click();
  await expect(
    page.locator('.discovery-slide[data-active="true"] h2'),
  ).toHaveText(name);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".discovery-feed")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove from Saved: " + name }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name })).toBeVisible();
  if (process.env.CATERA_CAPTURE_SAVED === "true")
    await page.screenshot({
      path: "output/saved-swipe/screenshots/saved-mobile.png",
    });
  await page
    .getByRole("button", { name: "Remove from Saved: " + name })
    .click();
  await expect(
    page.getByRole("heading", { name: "No saved packages yet" }),
  ).toBeVisible();
  if (process.env.CATERA_CAPTURE_SAVED === "true")
    await page.screenshot({
      path: "output/saved-swipe/screenshots/saved-empty.png",
    });
});
test("feed filters trap focus, close with Escape, reset the card and recover from no results", async ({
  page,
}) => {
  await page.goto("/?view=swipe");
  await page.getByRole("button", { name: "Next package", exact: true }).click();
  const filters = page.locator('button[aria-controls="marketplace-filters"]');
  await filters.click();
  const dialog = page.getByRole("dialog", {
    name: "Package filters",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const maximum = dialog.getByRole("spinbutton", {
    name: "Maximum price / meal",
    exact: true,
  });
  await maximum.fill("50000");
  await page.keyboard.press("Tab");
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  if (process.env.CATERA_CAPTURE_SAVED === "true")
    await page.screenshot({
      path: "output/saved-swipe/screenshots/filters-mobile.png",
    });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(filters).toBeFocused();
  await expect(page.locator(".discovery-navigation")).toContainText("1 /");
  const search = page.getByRole("searchbox");
  await search.fill("No synthetic package matches this");
  await expect(
    page
      .getByRole("link", {
        name: "Clear filters & browse packages",
        exact: true,
      })
      .or(
        page.getByRole("button", {
          name: "Clear filters & browse packages",
          exact: true,
        }),
      ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".discovery-feed")).toBeVisible();
});
test("mode preference, explicit URL override, comparison return and coverage preserve context", async ({
  page,
}) => {
  await login(page);
  await page.goto("/?view=swipe");
  await page.getByRole("button", { name: "Next package", exact: true }).click();
  const active = page.locator('.discovery-slide[data-active="true"]');
  const id = await active.getAttribute("data-package-id");
  await active.getByRole("button", { name: /^Compare:/ }).click();
  await expect(page.locator(".compare-floating")).toBeVisible();
  const action = await active
    .getByRole("link", { name: "View package", exact: true })
    .boundingBox();
  const tray = await page.locator(".compare-floating").boundingBox();
  expect(action!.y + action!.height).toBeLessThanOrEqual(tray!.y);
  await page
    .locator(".compare-floating")
    .getByRole("link", { name: "Compare", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Back to packages", exact: true })
    .click();
  await expect(active).toHaveAttribute("data-package-id", id!);
  await page.locator(".compare-clear").click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.goto("/");
  await expect(page.locator(".discovery-feed")).toHaveCount(0);
  await page.goto("/?view=swipe");
  await expect(page.locator(".discovery-feed")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Delivery area", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Tangerang Selatan", exact: true })
    .click();
  await expect(
    page.locator('.discovery-slide[data-active="true"] .discovery-coverage'),
  ).toHaveText(/Outside delivery area|Delivers to Tangerang Selatan/);
});
test("lunch and dinner cards distinguish the cycle total from the per-meal price", async ({
  page,
}) => {
  await page.goto("/?view=swipe&meal=both");
  const active = page.locator('.discovery-slide[data-active="true"]');
  await expect(active.locator(".discovery-per-meal")).toHaveText(
    /Rp\s*32\.500 \/ meal/,
  );
  await expect(active.locator(".discovery-price > strong")).toHaveText(
    /Rp\s*650\.000/,
  );
  await expect(active.locator(".discovery-commitment")).toContainText(
    "10 delivery days",
  );
  await expect(active.locator(".discovery-commitment")).toContainText(
    "Lunch + dinner",
  );
  if (process.env.CATERA_CAPTURE_SAVED === "true")
    await page.screenshot({
      path: "output/saved-swipe/screenshots/both-mobile.png",
    });
});
test("list fallback at small heights and enlarged text; desktop remains a list; protected API", async ({
  page,
}) => {
  expect((await page.request.get("/api/v1/saved-packages")).status()).toBe(401);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?view=swipe");
  await expect(page.locator(".discovery-feed")).toHaveCount(0);
  await expect(page.locator(".discovery-fallback")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=swipe");
  await page.addStyleTag({
    content: ".discovery-essential * { font-size: 200% !important; }",
  });
  await expect(page.locator(".discovery-feed")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?view=swipe");
  await expect(
    page.locator("section#packages .package-grid").last(),
  ).toBeVisible();
  await expect(page.locator(".discovery-feed")).toHaveCount(0);
});
test("localized geometry, focus, broken images, reduced motion and accessibility", async ({
  page,
  context,
  baseURL,
}) => {
  await login(page);
  await mkdir("output/saved-swipe/screenshots", { recursive: true });
  for (const locale of ["id", "en"]) {
    await context.addCookies([
      { name: "catera_locale", value: locale, url: baseURL! },
    ]);
    for (const size of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/?view=swipe");
      if (size.width <= 560) {
        await expect(page.locator(".discovery-feed")).toBeVisible();
        const areaControl = page.locator(".delivery-selector .select-trigger");
        const areaBox = await areaControl.boundingBox();
        const chevron = await areaControl.locator("svg").boundingBox();
        const searchBox = await page.locator(".search-field").boundingBox();
        expect(areaBox!.x + areaBox!.width).toBeLessThanOrEqual(searchBox!.x);
        expect(chevron!.x + chevron!.width).toBeLessThanOrEqual(
          areaBox!.x + areaBox!.width,
        );
        expect(chevron!.width).toBeGreaterThan(0);
        const action = await page
          .locator(
            '.discovery-slide[data-active="true"] .discovery-actions > a',
          )
          .boundingBox();
        const nav = await page.locator(".mobile-bottom").boundingBox();
        expect(action!.y + action!.height).toBeLessThanOrEqual(nav!.y);
      }
      if (size.width > 560)
        await expect(page.locator(".featured-label")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (process.env.CATERA_CAPTURE_SAVED === "true") {
        await page.screenshot({
          path: `output/saved-swipe/screenshots/${locale}-${size.width}.png`,
          fullPage: size.width > 560,
        });
        if (size.width > 560)
          await page.screenshot({
            path: `output/saved-swipe/screenshots/${locale}-desktop-viewport.png`,
          });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", (route) =>
    route.request().resourceType() === "image" &&
    route.request().url().includes("food")
      ? route.abort()
      : route.continue(),
  );
  await page.goto("/?view=swipe");
  await expect(
    page.locator('.discovery-slide[data-active="true"] .package-photo-missing'),
  ).toBeVisible();
  await page.locator(".discovery-viewport").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".discovery-navigation")).toContainText("2 /");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
