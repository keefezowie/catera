import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

async function openAs(
  page: Page,
  baseURL: string | undefined,
  role: "customer" | "owner" | "platform_admin",
  locale: "id" | "en",
  route: string,
) {
  expect(baseURL).toBeTruthy();
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
  await page.goto(route, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

// Resize computed text at the same viewport, including px-based type. Snapshot
// values first so inherited sizes do not compound while walking descendants.
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

async function expectTextInside(container: Locator) {
  const escaped = await container.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const escaped: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (
        !node.textContent?.trim() ||
        !parent ||
        !parent.checkVisibility({ checkVisibilityCSS: true }) ||
        parent.closest('[aria-hidden="true"], .sr-only')
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width < 1 || rect.height < 1) continue;
        if (
          rect.left < bounds.left - 1 ||
          rect.right > bounds.right + 1 ||
          rect.top < bounds.top - 1 ||
          rect.bottom > bounds.bottom + 1
        ) {
          escaped.push(node.textContent.trim());
          break;
        }
      }
    }
    return escaped;
  });
  expect(
    escaped,
    "Visible text must stay within its own control or heading",
  ).toEqual([]);
}

async function expectSeparate(first: Locator, second: Locator) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  const width =
    Math.min(a!.x + a!.width, b!.x + b!.width) - Math.max(a!.x, b!.x);
  const height =
    Math.min(a!.y + a!.height, b!.y + b!.height) - Math.max(a!.y, b!.y);
  expect(
    width <= 1 || height <= 1,
    `Control intersection is ${width} × ${height}px`,
  ).toBe(true);
}

for (const locale of ["id", "en"] as const) {
  test(`${locale}: home agenda heading and calendar action fit at 200% text on phone`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openAs(page, baseURL, "customer", locale, "/home");
    const heading = page.locator(".date-agenda > .section-heading");
    await expect(heading).toBeVisible();
    await doubleText(page);
    await expectTextInside(heading);
    await expectSeparate(
      heading.locator(":scope > div"),
      heading.locator(":scope > a"),
    );
    const contained = await heading.evaluate((element) => {
      const panel = element.closest(".date-agenda")!.getBoundingClientRect();
      return Array.from(element.children).every((child) => {
        const rect = child.getBoundingClientRect();
        return rect.left >= panel.left - 1 && rect.right <= panel.right + 1;
      });
    });
    expect(contained).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("home-agenda-text-200.png"),
      fullPage: true,
    });
  });

  test(`${locale}: Today stage labels and portion counts fit their buttons at 200% text on phone`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openAs(page, baseURL, "owner", locale, "/seller");
    const buttons = page.locator(".ops-stages button");
    await expect(buttons.first()).toBeVisible();
    await expect(buttons.first().locator("strong")).not.toContainText("…");
    await doubleText(page);
    const controls = await buttons.all();
    expect(controls.length).toBeGreaterThan(1);
    for (const button of controls) {
      await expectTextInside(button);
      await expectTextInside(button.locator("strong"));
    }
    for (let i = 0; i < controls.length; i++)
      for (let j = i + 1; j < controls.length; j++)
        await expectSeparate(controls[i], controls[j]);
    await page.screenshot({
      path: testInfo.outputPath("today-stages-text-200.png"),
      fullPage: true,
    });
  });

  for (const width of [320, 390]) {
    test(`${locale}: admin close target and first navigation link stay separate at ${width}px`, async ({
      page,
      baseURL,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, baseURL, "platform_admin", locale, "/admin");
      const trigger = page.locator('.ops-topbar button[aria-label="Menu"]');
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: locale === "id" ? "Navigasi admin" : "Admin navigation",
      });
      await expect(dialog).toBeVisible();
      const close = dialog.locator("button.close");
      const first = dialog.locator(".business-links a").first();
      await expectSeparate(close, first);
      await expectTextInside(first);
      // Include the top-right part of the first row that the absolute close
      // target covered previously; center-only click checks missed it.
      const ownsTopRight = await first.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.right - 8, rect.top + 3);
        return hit === element || (!!hit && element.contains(hit));
      });
      expect(ownsTopRight).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("admin-menu-separated.png"),
      });
      await close.click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }
}
