import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

const evidenceDir = "output/slack-bugs/0036";

test.beforeAll(() => {
  fs.mkdirSync(evidenceDir, { recursive: true });
});

async function login(page: Page, role: "owner" | "platform_admin") {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

async function expectDemoSidebarAlignment(page: Page) {
  const ribbon = page.locator(".demo-ribbon");
  const sidebar = page.locator(".ops-sidebar");
  await expect(ribbon).toBeVisible();
  await expect(sidebar).toBeVisible();
  const [ribbonBox, sidebarBox] = await Promise.all([
    ribbon.boundingBox(),
    sidebar.boundingBox(),
  ]);
  expect(ribbonBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(
    Math.abs(sidebarBox!.y - (ribbonBox!.y + ribbonBox!.height)),
  ).toBeLessThanOrEqual(1);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test("ID 0036 removes the non-demo gap and keeps the polished sidebar accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  const longName =
    "Dapur Selaras Nusantara untuk Pengantaran Harian Jakarta Selatan";
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/seller-identity/**", (route) =>
    route.fulfill({ json: { data: { name: longName } } }),
  );
  await login(page, "owner");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/seller/menus");
  await expect(page.locator("#main h1")).toBeVisible();
  await expectDemoSidebarAlignment(page);

  const sidebar = page.locator(".ops-sidebar");
  const head = sidebar.locator(".ops-sidebar-head");
  const brand = head.getByRole("link", {
    name: "Catera — Good Food on Repeat",
  });
  const workspaceName = head.getByText(longName, { exact: true });
  await expect(head).toBeVisible();
  expect((await brand.boundingBox())!.width).toBe(160);
  await expect(workspaceName).toHaveText(longName);
  expect(
    await workspaceName.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    }),
  ).toEqual({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });

  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(brand).toBeFocused();
  expect(
    await brand.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");

  await page.locator(".demo-ribbon").evaluate((element) => {
    element.classList.remove("demo-ribbon");
    element.setAttribute("hidden", "");
  });
  await expect.poll(async () => (await sidebar.boundingBox())?.y).toBe(0);
  expect(
    await page.evaluate(() => {
      const shell = document.querySelector(".ops-sidebar");
      const target = document.elementFromPoint(4, 4);
      return Boolean(shell && target && shell.contains(target));
    }),
  ).toBe(true);
  await expectNoHorizontalOverflow(page);

  const audit = await new AxeBuilder({ page })
    .include(".ops-sidebar")
    .analyze();
  expect(
    audit.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact || ""),
    ),
  ).toEqual([]);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.screenshot({
    path: `${evidenceDir}/sidebar-desktop-no-banner.png`,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("the shared sidebar stays aligned across every caterer destination", async ({
  page,
}) => {
  await login(page, "owner");
  await page.setViewportSize({ width: 1024, height: 620 });
  await page.goto("/seller");
  await expectDemoSidebarAlignment(page);
  await page.locator(".demo-ribbon").evaluate((element) => {
    element.classList.remove("demo-ribbon");
    element.setAttribute("hidden", "");
  });
  await expect
    .poll(async () => (await page.locator(".ops-sidebar").boundingBox())?.y)
    .toBe(0);
  await page.reload();
  await expectDemoSidebarAlignment(page);

  const language = page.locator(".ops-topbar .locale-switch");
  await language.click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const destinations = [
    ["/seller", "Today"],
    ["/seller/schedule", "Schedule"],
    ["/seller/packages", "Packages"],
    ["/seller/menus", "Menus"],
    ["/seller/customers", "Customers"],
    ["/seller/support", "Messages & support"],
    ["/seller/transactions", "Transactions"],
    ["/seller/settings", "Settings"],
  ] as const;

  for (const [path, label] of destinations) {
    await page.goto(path);
    await expect(page.locator("#main")).toBeVisible();
    await expectDemoSidebarAlignment(page);
    const current = page.locator('.ops-sidebar a[aria-current="page"]');
    await expect(current).toHaveAttribute("href", path);
    await expect(current).toContainText(label);
  }

  for (const path of ["/seller/profile", "/seller/notifications"] as const) {
    await page.goto(path);
    await expect(page.locator("#main")).toBeVisible();
    await expectDemoSidebarAlignment(page);
  }

  const marketplace = page
    .locator(".ops-sidebar")
    .getByRole("link", { name: "View marketplace", exact: true });
  await marketplace.scrollIntoViewIfNeeded();
  await expect(marketplace).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto("/seller/menus");
  await expect(page.locator("#main h1")).toBeVisible();
  await expect(page.locator(".menu-month-grid")).toBeVisible();
  await page.screenshot({
    path: `${evidenceDir}/sidebar-compact-en.png`,
    animations: "disabled",
  });
});

test("seller phone and tablet navigation remain unchanged", async ({
  page,
}) => {
  await login(page, "owner");
  for (const viewport of [
    { width: 800, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/seller/menus");
    await expect(page.locator("#main h1")).toBeVisible();
    const sidebarBox = await page.locator(".ops-sidebar").boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(sidebarBox!.y).toBe(0);
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(0);
    await expect(page.locator(".seller-bottom")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const more = page.getByRole("button", { name: "Lainnya", exact: true });
    await more.click();
    await expect(
      page.getByRole("dialog").getByRole("heading", {
        name: "Kelola usaha",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();

    if (viewport.width === 390) {
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await page.screenshot({
        path: `${evidenceDir}/seller-phone.png`,
        animations: "disabled",
      });
    }
  }
});

test("the admin workspace inherits the corrected shared shell", async ({
  page,
}) => {
  await login(page, "platform_admin");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/sellers");
  await expect(page.locator("#main h1")).toBeVisible();
  await expectDemoSidebarAlignment(page);
  await expect(
    page.locator(".ops-sidebar-head").getByText("Catera Admin", {
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `${evidenceDir}/admin-desktop.png`,
    animations: "disabled",
  });
});
