import { test, expect, type Locator, type Page } from "@playwright/test";
import type { SellerOperationsState } from "@catera/domain";

type Locale = "id" | "en";
const sellerId = "10000000-0000-4000-8000-000000000001";
const widths = [320, 390, 768, 1024, 1181, 1280, 1440, 1920, 2560];

function translate(locale: Locale, id: string, en: string) {
  return locale === "id" ? id : en;
}

/** Check sibling hit areas, not document width: a child can overflow into a
 * neighboring field while the document still fits the viewport. Popovers are
 * deliberately checked separately, since overlaying the page is intentional. */
async function separateScopeControls(scope: Locator) {
  const problems = await scope.evaluate((root) => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        getComputedStyle(element).visibility !== "hidden"
      );
    };
    const controls = [...root.querySelectorAll("button, input")].filter(
      visible,
    );
    const rootBox = root.getBoundingClientRect();
    const label = (element: Element) =>
      element.getAttribute("aria-label") ||
      element.textContent?.trim() ||
      element.tagName;
    const errors: string[] = [];
    for (let i = 0; i < controls.length; i++) {
      const a = controls[i],
        box = a.getBoundingClientRect();
      if (
        box.left < rootBox.left - 1 ||
        box.right > rootBox.right + 1 ||
        box.top < rootBox.top - 1 ||
        box.bottom > rootBox.bottom + 1
      )
        errors.push(`${label(a)} escapes its filter panel`);
      for (const b of controls.slice(i + 1)) {
        if (a.contains(b) || b.contains(a)) continue;
        const other = b.getBoundingClientRect();
        const x =
          Math.min(box.right, other.right) - Math.max(box.left, other.left);
        const y =
          Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
        if (x > 1 && y > 1)
          errors.push(
            `${label(a)} overlaps ${label(b)} by ${x.toFixed(1)} × ${y.toFixed(1)}px`,
          );
      }
    }
    for (const tab of root.querySelectorAll('[role="tab"]')) {
      const box = tab.getBoundingClientRect();
      const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
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
            errors.push(`${label(tab)} has text outside its hit area`);
          for (
            let parent = walker.currentNode.parentElement;
            parent && tab.contains(parent);
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent);
            const clip = parent.getBoundingClientRect();
            if (
              (style.overflowX !== "visible" &&
                (text.left < clip.left - 1 || text.right > clip.right + 1)) ||
              (style.overflowY !== "visible" &&
                (text.top < clip.top - 1 || text.bottom > clip.bottom + 1))
            )
              errors.push(`${label(tab)} clips its label or portion count`);
          }
        }
      }
    }
    return errors;
  });
  expect(
    problems,
    "Every filter needs its own unobstructed hit area and readable meal text",
  ).toEqual([]);
}

async function reachable(control: Locator) {
  await expect(control).toBeVisible();
  // Center each control in the visible scroll surface before hit testing. This
  // avoids treating below-the-fold fields as hidden by a sticky header.
  await control.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  const blocked = await control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const failures: string[] = [];
    for (const [xPart, yPart] of [
      [0.12, 0.5],
      [0.5, 0.25],
      [0.5, 0.5],
      [0.5, 0.75],
      [0.88, 0.5],
    ]) {
      const x = box.left + box.width * xPart,
        y = box.top + box.height * yPart;
      const top = document.elementFromPoint(x, y);
      if (!top || !element.contains(top))
        failures.push(
          `${xPart},${yPart}: ${top?.tagName || "outside viewport"} ${top?.getAttribute("class") || ""}`,
        );
    }
    return failures;
  });
  expect(
    blocked,
    `Control interior must be reachable: ${await control.innerText()}`,
  ).toEqual([]);
}

async function readableSelected(tab: Locator) {
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await reachable(tab);
  await tab.hover();
  const contrast = await tab.evaluate((element) => {
    const luminance = (color: string) => {
      const values = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    let background = element;
    while (
      getComputedStyle(background).backgroundColor === "rgba(0, 0, 0, 0)" &&
      background.parentElement
    )
      background = background.parentElement;
    const bg = luminance(getComputedStyle(background).backgroundColor);
    return [element, ...element.querySelectorAll("small")].map((text) => {
      const fg = luminance(getComputedStyle(text).color);
      return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
    });
  });
  for (const ratio of contrast)
    expect(
      ratio,
      "Selected label and count need readable hover contrast",
    ).toBeGreaterThanOrEqual(4.5);
}

async function mealStates(page: Page, scope: Locator) {
  const tab = (meal: string) =>
    scope.locator(`[role="tab"][data-meal="${meal}"]`);
  for (const meal of ["all", "lunch", "dinner"]) {
    await tab(meal).click();
    await readableSelected(tab(meal));
    await separateScopeControls(scope);
  }
  await tab("dinner").press("Home");
  for (const meal of ["all", "lunch", "dinner"]) {
    await expect(tab(meal)).toBeFocused();
    await expect(tab(meal)).toHaveAttribute("tabindex", "0");
    await readableSelected(tab(meal));
    await expect(
      scope.locator('[role="tab"][aria-selected="true"]'),
    ).toHaveCount(1);
    await expect(tab(meal)).not.toHaveCSS("outline-style", "none");
    if (meal !== "dinner") await page.keyboard.press("ArrowRight");
  }
  await page.keyboard.press("ArrowRight");
  await expect(tab("all")).toBeFocused();
  await page.keyboard.press("End");
  await expect(tab("dinner")).toBeFocused();
  await separateScopeControls(scope);
}

async function popupRecovery(page: Page, scope: Locator, locale: Locale) {
  const t = (id: string, en: string) => translate(locale, id, en);
  const date = scope.getByRole("button", {
    name: t("Tanggal operasional", "Operational date"),
    exact: true,
  });
  const packageFilter = scope.getByRole("combobox", {
    name: t("Filter paket", "Package filter"),
    exact: true,
    // Radix makes the background inert while its modal listbox is open. Keep
    // the existing trigger addressable only to inspect its expanded state.
    includeHidden: true,
  });
  const status = scope.getByRole("combobox", {
    name: t("Status pesanan", "Order status"),
    exact: true,
    includeHidden: true,
  });
  const search = scope.getByRole("searchbox", {
    name: t("Cari pesanan", "Search orders"),
  });
  await search.fill("Synthetic retained filter");
  await expect(search).toHaveValue("Synthetic retained filter");
  const before = {
    url: page.url(),
    date: await date.getAttribute("data-value"),
    package: await packageFilter.textContent(),
    status: await status.textContent(),
  };
  for (const control of [date, packageFilter, status]) {
    await reachable(control);
    await control.click();
    await expect(control).toHaveAttribute("aria-expanded", "true");
    const popup =
      control === date
        ? page.locator(".date-picker-popover")
        : page.getByRole("listbox");
    await expect(popup).toBeVisible();
    // Test the popup's own interactive surface; it may intentionally cover the
    // underlying filter controls while it is open.
    const selectedChoice =
      control === date
        ? popup.getByRole("gridcell", { selected: true })
        : popup.locator('[role="option"][data-state="checked"]');
    const choice = (await selectedChoice.count())
      ? selectedChoice.first()
      : popup.getByRole("option").first();
    await reachable(choice);
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(control).toBeFocused();
    await expect(control).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(before.url);
    await expect(date).toHaveAttribute("data-value", before.date!);
    await expect(packageFilter).toHaveText(before.package!);
    await expect(status).toHaveText(before.status!);
    await expect(search).toHaveValue("Synthetic retained filter");
    await separateScopeControls(scope);
  }
  for (const control of await scope
    .locator("button:visible, input:visible")
    .all())
    await reachable(control);
}

async function syntheticStress(page: Page, locale: Locale) {
  const response = await page.request.get(`/api/v1/seller/${sellerId}`);
  expect(response.ok()).toBe(true);
  const { data } = (await response.json()) as { data: SellerOperationsState };
  const offer = data.offers[0],
    delivery = data.deliveries[0];
  expect(offer).toBeTruthy();
  expect(delivery).toBeTruthy();
  const name = translate(
    locale,
    "Paket Sintetis Keluarga Nusantara Ayam Panggang Sayuran Segar dan Lauk Berganti Setiap Hari",
    "Synthetic Family Package with Roasted Chicken Fresh Vegetables and Different Side Dishes Every Day",
  );
  const stressed: SellerOperationsState = {
    ...data,
    offers: data.offers.map((entry) =>
      entry.id === offer.id ? { ...entry, name } : entry,
    ),
    deliveries: (["lunch", "dinner"] as const).map((meal, index) => ({
      ...delivery,
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      offer: { ...delivery.offer, id: offer.id, name },
      status: "scheduled",
      service_date: data.operationalDate,
      portions: index ? 6789 : 12345,
      meals: [{ meal, status: "scheduled" }],
    })),
  };
  await page.route(`**/api/v1/seller/${sellerId}*`, (route) =>
    route.fulfill({ json: { data: stressed } }),
  );
  return { packageId: offer.id, name };
}

for (const locale of ["id", "en"] as const) {
  test.describe(locale, () => {
    test.beforeEach(async ({ page, context, baseURL }) => {
      expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
      const me = await page.request.get("/api/v1/me");
      expect((await me.json()).data.demo, "Synthetic demo is required").toBe(
        true,
      );
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      expect(
        (
          await page.request.post("/api/v1/auth/demo", {
            data: { role: "owner" },
          })
        ).ok(),
      ).toBe(true);
    });

    for (const width of widths) {
      test(`schedule controls keep separate hit areas at ${width}px`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/seller/schedule?meal=dinner");
        const scope = page.getByRole("region", {
          name: translate(locale, "Cakupan pesanan", "Order scope"),
          includeHidden: true,
        });
        await expect(scope).toBeVisible();
        await expect(scope.locator('[data-meal="lunch"] small')).toContainText(
          /\d/,
        );
        await scope.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath("schedule-initial.png"),
        });
        await separateScopeControls(scope);
        await mealStates(page, scope);
        await popupRecovery(page, scope, locale);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await scope.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath("schedule-verified.png"),
        });
      });
    }

    for (const width of [320, 1181, 1920]) {
      test(`long package and counts remain usable with 200% text at ${width}px`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        const stress = await syntheticStress(page, locale);
        await page.goto(
          `/seller/schedule?meal=dinner&package=${stress.packageId}&status=all`,
        );
        const scope = page.getByRole("region", {
          name: translate(locale, "Cakupan pesanan", "Order scope"),
          includeHidden: true,
        });
        await expect(scope).toBeVisible();
        // Explicit text resizing also covers px-based typography; changing only
        // the root rem size would leave those labels unchanged.
        await scope.evaluate((root) => {
          const elements = [root, ...root.querySelectorAll("*")].filter(
            (element): element is HTMLElement => element instanceof HTMLElement,
          );
          const sizes = elements.map((element) =>
            parseFloat(getComputedStyle(element).fontSize),
          );
          elements.forEach((element, index) =>
            element.style.setProperty(
              "font-size",
              `${sizes[index] * 2}px`,
              "important",
            ),
          );
        });
        await expect(scope.locator('[data-meal="lunch"] small')).toContainText(
          "12345",
        );
        await expect(scope.locator('[data-meal="dinner"] small')).toContainText(
          "6789",
        );
        await expect(
          scope.getByRole("combobox", {
            name: translate(locale, "Filter paket", "Package filter"),
          }),
        ).toContainText(stress.name);
        await scope.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath("schedule-enlarged-initial.png"),
        });
        await separateScopeControls(scope);
        await mealStates(page, scope);
        await popupRecovery(page, scope, locale);
        await scope.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath("schedule-enlarged-verified.png"),
        });
      });
    }
  });
}
