import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

test("marketplace section links preserve state and dropdowns work by keyboard and touch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("combobox", { name: "Area pengantaran" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page
    .getByRole("option", { name: "Jakarta Selatan", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Area pengantaran" }),
  ).toContainText("Jakarta Selatan");
  await page
    .locator(".desktop-nav")
    .getByRole("link", { name: "Cara berlangganan" })
    .click();
  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(page.locator("#how-it-works")).toBeInViewport();
  await expect(page.locator(".desktop-nav a[aria-current]")).toHaveText(
    "Cara berlangganan",
  );
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page
    .locator(".desktop-nav")
    .getByRole("link", { name: "Jelajah katering" })
    .click();
  await expect(page).toHaveURL(/\/#packages$/);
  await expect(page.locator(".desktop-nav a[aria-current]")).toHaveText(
    "Jelajah katering",
  );
  await expect(
    page.getByRole("combobox", { name: "Area pengantaran" }),
  ).toContainText("Jakarta Selatan");
  await page.evaluate(() => {
    (
      window as typeof window & { navigationSentinel?: boolean }
    ).navigationSentinel = true;
  });
  await page
    .locator(".desktop-nav")
    .getByRole("link", { name: "Cara berlangganan" })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { navigationSentinel?: boolean })
          .navigationSentinel,
    ),
  ).toBe(true);
  const language = page.getByRole("combobox", { name: "Bahasa", exact: true });
  await language.focus();
  await language.press("ArrowDown");
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("combobox", { name: "Language", exact: true }),
  ).toContainText("EN");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Area pengantaran" }).click();
  const list = page.getByRole("listbox");
  const bounds = await list.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  const audit = await new AxeBuilder({ page })
    .include('[role="listbox"]')
    .analyze();
  expect(
    audit.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  fs.mkdirSync("output/fixes-verification", { recursive: true });
  await page.screenshot({ path: "output/fixes-verification/area-phone.png" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("combobox", { name: "Area pengantaran" }),
  ).toBeFocused();
  await page.getByRole("combobox", { name: "Language", exact: true }).click();
  await page.screenshot({
    path: "output/fixes-verification/language-phone.png",
  });
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Slack bugs: hero leads filters and current navigation persists across routes", async ({
  page,
}) => {
  await page.goto("/#how-it-works");
  await expect(page.locator(".desktop-nav a[aria-current]")).toHaveText(
    "Cara berlangganan",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator(".desktop-nav a[aria-current]")).toHaveText(
    "Jelajah katering",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const hero = page.locator(".market-hero");
    const toolbar = page.locator(".market-toolbar");
    await expect(hero).toBeVisible();
    const h = (await hero.boundingBox())!;
    const t = (await toolbar.boundingBox())!;
    expect(t.y).toBeGreaterThanOrEqual(h.y + h.height);
    const language = page.getByRole("combobox", {
      name: "Bahasa",
      exact: true,
    });
    expect(await language.evaluate((el) => getComputedStyle(el).gap)).toBe(
      "4px",
    );
    expect((await language.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole("textbox", { name: "Cari katering" }).fill("Ayam");
    await expect(hero).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `output/slack-bugs/catalog-${width}.png`,
      fullPage: true,
    });
  }
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/home");
  await expect(page.locator(".mobile-bottom a[aria-current]")).toHaveText(
    "Beranda",
  );
  await page
    .locator(".mobile-bottom")
    .getByRole("link", { name: "Jadwal", exact: true })
    .click();
  await expect(page.locator(".mobile-bottom a[aria-current]")).toHaveText(
    "Jadwal",
  );
  await page.reload();
  await expect(page.locator(".mobile-bottom a[aria-current]")).toHaveText(
    "Jadwal",
  );
  await page.goBack();
  await expect(page.locator(".mobile-bottom a[aria-current]")).toHaveText(
    "Beranda",
  );
});

test("legacy discover address redirects to the English catalog anchor", async ({
  page,
}) => {
  await page.goto("/discover?source=test");
  await expect(page).toHaveURL(/\/\?source=test#packages$/);
  // Ignore Next's temporary streamed subtree outside the live content region.
  await expect(page.locator("#main #packages")).toBeVisible();
});

test("seller workspace exposes the locale switch and keeps the choice on reload", async ({
  page,
}) => {
  const auth = await page.request.post("/api/v1/auth/demo", {
    data: { role: "owner" },
  });
  expect(auth.ok()).toBe(true);

  await page.goto("/seller");
  const topbar = page.locator(".ops-topbar");
  const language = topbar.locator(".locale-switch");
  await expect(language).toBeVisible();
  await expect(
    page.locator("#main h1"),
  ).toBeVisible();
  await expect(page.locator("#main h1")).toHaveText("Hari ini");

  await language.click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(topbar.locator(".locale-switch")).toContainText("EN");
  await expect(
    page.locator("#main h1"),
  ).toBeVisible();
  await expect(page.locator("#main h1")).toHaveText("Today");
  await expect(page.locator(".ops-sidebar")).toContainText("Schedule");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".ops-topbar .locale-switch")).toContainText("EN");
  await expect(
    page.locator("#main h1"),
  ).toBeVisible();
  await expect(page.locator("#main h1")).toHaveText("Today");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/seller");
  await expect(page.locator(".ops-topbar .locale-switch")).toBeVisible();
  await expect(page.locator(".ops-topbar .locale-switch")).toContainText("EN");
  await expect(page.locator("#main h1")).toHaveText("Today");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  fs.mkdirSync("output/slack-bugs/0005", { recursive: true });
  await page.screenshot({
    path: "output/slack-bugs/0005/seller-phone.png",
    fullPage: true,
    animations: "disabled",
  });
});
