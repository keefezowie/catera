import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function login(page: Page, role: string) {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

test("seller accounts default to seller and can switch workspaces", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "owner");
  const initialWorkspaceCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "catera_workspace",
  );
  expect(initialWorkspaceCookie).toMatchObject({
    value: "caterer",
    httpOnly: true,
    sameSite: "Lax",
  });

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page).toHaveURL(/\/seller$/);
    await expect(page.locator(".ops-layout")).toBeVisible();
    await expect(page.locator(".customer-layout")).toHaveCount(0);

    const trigger = page.getByRole("button", {
      name: "Buka menu akun",
      exact: true,
    });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Menu akun", exact: true });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitemradio", { name: /Katerer/ }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      menu.getByRole("menuitemradio", { name: /Pelanggan/ }),
    ).toHaveAttribute("aria-checked", "false");
    await page.screenshot({
      path: `output/playwright/workspace-menu-${viewport.width}.png`,
    });

    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.press("ArrowDown");
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitemradio", { name: /Katerer/ }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();

    await trigger.click();
    await menu.getByRole("menuitemradio", { name: /Pelanggan/ }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".customer-layout")).toBeVisible();
    await expect(page.locator(".ops-layout")).toHaveCount(0);
    await expect(
      (await page.context().cookies()).find(
        (cookie) => cookie.name === "catera_workspace",
      ),
    ).toMatchObject({ value: "customer", httpOnly: true });

    const me = await page.request.get("/api/v1/me");
    expect(me.ok()).toBe(true);
    expect((await me.json()).data.actor.role).toBe("owner");

    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".customer-layout")).toBeVisible();
    const customerMenu = page.getByRole("button", {
      name: "Buka menu akun",
      exact: true,
    });
    await customerMenu.click();
    await expect(
      page.getByRole("menuitemradio", { name: /Pelanggan/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .include('[role="menu"]')
      .analyze();
    expect(
      audit.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
    await page.keyboard.press("Escape");

    for (const route of [
      "/seller",
      "/seller/packages",
      "/seller/settings",
      "/seller/capacity",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL("/");
      await expect(page.locator(".ops-layout")).toHaveCount(0);
      expect(
        (await page.context().cookies()).find(
          (cookie) => cookie.name === "catera_workspace",
        )?.value,
      ).toBe("customer");
    }
    await page.goto("/");
    await page.getByRole("button", { name: "Buka menu akun" }).click();
    await page.getByRole("menuitemradio", { name: /Katerer/ }).click();
    await expect(page).toHaveURL(/\/seller$/);
    await expect(page.locator(".ops-layout")).toBeVisible();
  }

  await page.request.post("/api/v1/auth/logout", { data: {} });
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "catera_workspace",
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("customer accounts cannot select the caterer workspace", async ({
  page,
  baseURL,
}) => {
  await login(page, "customer");
  await page.goto("/");
  await expect(page.locator(".customer-layout")).toBeVisible();
  const trigger = page.getByRole("button", {
    name: "Buka menu akun",
    exact: true,
  });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Menu akun", exact: true });
  await expect(menu.getByRole("menuitemradio")).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "Akun" })).toBeVisible();
  const response = await page.request.post("/api/v1/auth/workspace", {
    data: { workspace: "caterer" },
  });
  expect(response.status()).toBe(403);
  await page.context().addCookies([
    {
      name: "catera_workspace",
      value: "caterer",
      url: baseURL!,
      httpOnly: true,
    },
  ]);
  await page.goto("/seller");
  // A streamed Next not-found response may have HTTP 200; assert denied UI.
  await expect(
    page.getByRole("heading", { name: "Halaman tidak ditemukan." }),
  ).toBeVisible();
  await expect(page.locator(".ops-layout")).toHaveCount(0);
});

for (const locale of ["id", "en"] as const) {
  test(`seller entry switches customer mode before opening operations ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await login(page, "owner");
    await context.addCookies([
      { name: "catera_locale", value: locale, url: baseURL! },
    ]);
    await page.request.post("/api/v1/auth/workspace", {
      data: { workspace: "customer" },
    });
    await page.goto("/");
    const entry = page.getByRole("button", {
      name: locale === "id" ? "Untuk katerer" : "For caterers",
      exact: true,
    });
    let releaseFailure!: () => void;
    const failedResponse = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    const switchEndpoint = "**/api/v1/auth/workspace";
    await page.route(switchEndpoint, async (route) => {
      await failedResponse;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "UNAVAILABLE" }),
      });
    });
    await entry.click();
    await expect(entry).toBeDisabled();
    await expect(entry).toHaveAttribute("aria-busy", "true");
    releaseFailure();
    await expect(entry).toBeEnabled();
    await expect(
      page.getByText(
        locale === "id"
          ? "Ruang kerja belum berhasil diganti. Coba lagi."
          : "The workspace could not be changed. Try again.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".ops-layout")).toHaveCount(0);
    expect(
      (await context.cookies()).find(
        (cookie) => cookie.name === "catera_workspace",
      )?.value,
    ).toBe("customer");
    await page.unroute(switchEndpoint);
    await entry.click();
    await expect(page).toHaveURL(/\/seller$/);
    await page
      .getByRole("button", {
        name: locale === "id" ? "Buka menu akun" : "Open account menu",
      })
      .click();
    await expect(
      page.getByRole("menuitemradio", {
        name: locale === "id" ? /Katerer/ : /Caterer/,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await page.screenshot({
      path: `output/playwright/workspace-route-20261001/caterer-entry-${locale}.png`,
    });
    await page.request.post("/api/v1/auth/workspace", {
      data: { workspace: "customer" },
    });
    await page.goto("/seller/onboarding");
    await page
      .getByRole("button", {
        name:
          locale === "id"
            ? /Kembali ke ruang katerer/
            : /Return to your workspace/,
      })
      .click();
    await expect(page).toHaveURL(/\/seller$/);
    expect(
      (await context.cookies()).find(
        (cookie) => cookie.name === "catera_workspace",
      )?.value,
    ).toBe("caterer");
  });
}

test("staff customer mode blocks seller routes until explicitly switched", async ({
  page,
}) => {
  await login(page, "staff");
  await page.request.post("/api/v1/auth/workspace", {
    data: { workspace: "customer" },
  });
  await page.goto("/seller/schedule");
  await expect(page).toHaveURL("/");
  await expect(page.locator(".ops-layout")).toHaveCount(0);
  await page.getByRole("button", { name: "Buka menu akun" }).click();
  await page.getByRole("menuitemradio", { name: /Katerer/ }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await expect(page.locator(".ops-layout")).toBeVisible();
});
