import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const active = (page: Page) => page.locator(".featured-slide:not([inert])");
const waitCycle = (page: Page) => page.waitForTimeout(6400);

test("pause button, keyboard access and carousel accessibility", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jeda tayangan" }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole("button", { name: "Putar otomatis" })).toBeVisible();
  const content = await active(page).textContent();
  await waitCycle(page);
  expect(await active(page).textContent()).toBe(content);
  await active(page).getByRole("link").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Katerer sebelumnya" })).toBeFocused();
  const results = await new AxeBuilder({ page }).include(".featured-hero").analyze();
  expect(results.violations).toEqual([]);
});

test("carousel autoplay, hover, manual controls, focus, visibility and links", async ({
  page,
}) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".featured-slide")).toHaveCount(3);
  await expect(active(page)).toContainText("Dapur Senja");
  await expect(active(page)).toContainText("Rumah Rasa", { timeout: 9000 });
  await page.locator(".featured-hero").hover();
  const hovered = await active(page).textContent();
  await waitCycle(page);
  expect(await active(page).textContent()).toBe(hovered);
  await page.mouse.move(0, 0);
  await expect(active(page)).not.toHaveText(hovered!, { timeout: 9000 });
  await page.getByRole("button", { name: "Tampilkan Dapur Senja" }).click();
  await page.mouse.move(0, 0);
  await waitCycle(page);
  await expect(active(page)).toContainText("Dapur Senja");
  await expect(
    page.getByRole("button", { name: "Putar otomatis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Katerer sebelumnya" }).click();
  await expect(active(page)).toContainText("Hijau Kitchen");
  await page.getByRole("button", { name: "Katerer berikutnya" }).click();
  await expect(active(page)).toContainText("Dapur Senja");
  await page.getByRole("textbox", { name: "Cari katering" }).fill("salmon");
  await expect(page.locator(".featured-slide")).toHaveCount(3);
  await expect(active(page)).toContainText("Dapur Senja");
  await page.getByRole("button", { name: "Putar otomatis" }).click();
  await page.mouse.move(0, 0);
  await expect(active(page)).toContainText("Rumah Rasa", { timeout: 9000 });
  await active(page).getByRole("link").focus();
  await expect(
    page.getByRole("button", { name: "Putar otomatis" }),
  ).toBeVisible();
  await waitCycle(page);
  await expect(active(page)).toContainText("Rumah Rasa");
  await page.getByRole("button", { name: "Putar otomatis" }).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitCycle(page);
  await expect(active(page)).toContainText("Rumah Rasa");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await waitCycle(page);
  await expect(active(page)).toContainText("Rumah Rasa");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(active(page)).toContainText("Hijau Kitchen", { timeout: 9000 });
  const href = await active(page).getByRole("link").getAttribute("href");
  await active(page).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(href! + "$"));
  expect(errors).toEqual([]);
});

test("desktop and mobile spacing, stable height, swipe, long names and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const header = await page.locator(".site-header").boundingBox();
    const hero = await page.locator(".featured-hero").boundingBox();
    expect(hero!.y - header!.y - header!.height).toBe(width === 390 ? 20 : 32);
    await page.screenshot({
      path: `output/featured-hero/${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Katerer berikutnya" }).click();
    expect((await page.locator(".featured-hero").boundingBox())!.height).toBe(
      hero!.height,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator(".featured-playback")).toHaveCount(0);
  const before = await active(page).textContent();
  await waitCycle(page);
  expect(await active(page).textContent()).toBe(before);
  await page.getByRole("button", { name: "Tampilkan Dapur Senja" }).click();
  const box = (await page.locator(".featured-viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 100, { steps: 12 });
  await page.mouse.up();
  await expect(active(page)).not.toContainText("Dapur Senja");
  await active(page)
    .locator("h1,h2")
    .evaluate(
      (el) =>
        (el.textContent =
          "Dapur Nusantara Sehat dan Lezat untuk Keluarga Indonesia"),
    );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const heading = (await active(page).locator("h1,h2").boundingBox())!;
  const link = (await active(page).getByRole("link").boundingBox())!;
  const controls = (await page.locator(".featured-controls").boundingBox())!;
  expect(link.y).toBeGreaterThan(heading.y + heading.height);
  expect(controls.y).toBeGreaterThanOrEqual(link.y + link.height);
});

test("area selection yields a static single caterer and an uncovered area retains the introduction", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("catera-area", "Bandung"),
  );
  await page.goto("/");
  await expect(page.locator(".featured-slide")).toHaveCount(1);
  await expect(active(page)).toContainText("Rumah Rasa");
  await expect(page.locator(".featured-controls")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Area pengantaran" }).click();
  await page
    .getByRole("option", { name: "Jakarta Selatan", exact: true })
    .click();
  await expect(page.locator(".featured-slide")).toHaveCount(2);
  await expect(page.locator(".featured-track")).not.toContainText("Rumah Rasa");
  await page.getByRole("combobox", { name: "Bahasa" }).click();
  await page.getByRole("option", { name: /English/ }).click();
  await expect(
    page.getByRole("region", { name: "Featured caterers" }),
  ).toBeVisible();
  await expect(
    active(page).getByRole("link", { name: "View package" }),
  ).toBeVisible();
  await page.addInitScript(() =>
    localStorage.setItem("catera-area", "Uncovered test area"),
  );
  await page.goto("/");
  await expect(page.locator(".featured-controls")).toHaveCount(0);
  await expect(page.locator(".featured-hero-wrapper h1")).toContainText(
    "Eat well.",
  );
});
