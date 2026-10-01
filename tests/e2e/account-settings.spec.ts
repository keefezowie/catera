import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const evidence = "output/playwright/familiar-settings/after";
test.beforeAll(() => mkdir(evidence, { recursive: true }));
test.beforeEach(async ({ page }) => {
  expect((await (await page.request.get("/api/v1/me")).json()).data.demo).toBe(
    true,
  );
});

test("English seller navigation keeps complete words at 320 pixels", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "catera_locale", value: "en", url: baseURL! },
  ]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  for (const path of [
    "/seller",
    "/seller/schedule",
    "/seller/packages",
    "/seller/settings",
  ]) {
    await page.goto(path);
    const nav = page.getByRole("navigation", {
      name: "Caterer navigation",
      exact: true,
    });
    await expect(nav).toBeVisible();
    const labels = nav.locator("a > span, button > span");
    const broken = await labels.evaluateAll((elements) =>
      elements.flatMap((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter(
          (rect) => rect.width > 0,
        );
        const lines = new Set(rects.map((rect) => Math.round(rect.top)));
        return lines.size > 1 ? [element.textContent] : [];
      }),
    );
    expect(broken).toEqual([]);
    for (const control of await nav.locator("a, button").all())
      expect((await control.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: `${evidence}/seller-navigation-en-320.png` });
});

for (const locale of ["id", "en"] as const) {
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  for (const width of [320, 390, 768, 1440]) {
    test(`account settings preserve familiar actions and accessible layout ${locale} ${width}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
      await page.goto("/account");
      const account = page.locator(".account-page");
      await expect(
        account.getByRole("heading", {
          name: t("Alamat tersimpan", "Saved addresses"),
          exact: true,
        }),
      ).toBeVisible();
      const navigation = account.getByRole("navigation");
      for (const href of [
        "/subscriptions",
        "/messages",
        "/notifications",
        "/support",
      ]) {
        const link = navigation.locator(`a[href="${href}"]`);
        await expect(link).toBeVisible();
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const catererEntry = navigation.getByRole("button", {
        name: t("Ruang katerer", "Caterer workspace"),
        exact: true,
      });
      await expect(catererEntry).toBeVisible();
      expect((await catererEntry.boundingBox())!.height).toBeGreaterThanOrEqual(
        44,
      );
      const language = account.getByRole("combobox", {
        name: t("Bahasa", "Language"),
        exact: true,
      });
      await expect(language).toContainText(
        locale === "id" ? "Bahasa Indonesia" : "English",
      );
      await language.focus();
      await language.press("Enter");
      await expect(
        page.getByRole("option", { name: "English", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(language).toBeFocused();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await language.evaluate((element) =>
        element.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      expect(
        await language.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          const bar = document
            .querySelector(".mobile-bottom")
            ?.getBoundingClientRect();
          return (
            element.contains(hit) && (!bar?.height || box.bottom <= bar.top)
          );
        }),
      ).toBe(true);
      await language.click();
      await page
        .getByRole("option", {
          name: locale === "id" ? "English" : "Bahasa Indonesia",
          exact: true,
        })
        .click();
      await expect(
        account.getByRole("heading", {
          name: t("Saved addresses", "Alamat tersimpan"),
          exact: true,
        }),
      ).toBeVisible();
      await page.reload();
      await expect(
        account.getByRole("heading", {
          name: t("Saved addresses", "Alamat tersimpan"),
          exact: true,
        }),
      ).toBeVisible();
      await account.getByRole("combobox").click();
      await page
        .getByRole("option", {
          name: locale === "id" ? "Bahasa Indonesia" : "English",
          exact: true,
        })
        .click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(
        account.getByRole("button", {
          name: t("Tambah alamat", "Add address"),
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".account-page")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `${evidence}/account-${locale}-${width}.png`,
        fullPage: true,
      });
    });
  }

  test(`empty addresses explain recovery and address dialog restores focus ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "catera_locale", value: locale, url: baseURL! },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.request.post("/api/v1/auth/demo", {
      data: { role: "customer" },
    });
    const customer = (await (await page.request.get("/api/v1/customer")).json())
      .data;
    await page.route("**/api/v1/customer", (route) =>
      route.fulfill({ json: { data: { ...customer, addresses: [] } } }),
    );
    await page.goto("/account");
    await expect(
      page.getByText(
        t("Belum ada alamat tersimpan", "No saved addresses yet"),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.locator(".account-navigation").getByRole("button", {
        name: t("Ruang katerer", "Caterer workspace"),
        exact: true,
      }),
    ).toHaveCount(0);
    const add = page.getByRole("button", {
      name: t("Tambah alamat", "Add address"),
      exact: true,
    });
    await add.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      t(
        "Alamat pengantaran yang sudah dijadwalkan hanya berubah",
        "A scheduled delivery address can only be changed",
      ),
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
    await page.screenshot({
      path: `${evidence}/account-empty-${locale}-390.png`,
      fullPage: true,
    });
  });

  for (const role of ["owner", "staff"] as const)
    test(`account enters the caterer workspace without changing ${role} access ${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        (await page.request.post("/api/v1/auth/demo", { data: { role } })).ok(),
      ).toBe(true);
      expect(
        (
          await page.request.post("/api/v1/auth/workspace", {
            data: { workspace: "customer" },
          })
        ).ok(),
      ).toBe(true);
      const businessActions: string[] = [],
        errors: string[] = [];
      await page.route("**/api/v1/commands", (route) => {
        businessActions.push(route.request().postDataJSON().action);
        return route.abort();
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/account");
      await expect(page.locator(".mobile-bottom")).toBeVisible();
      const entry = page.locator(".account-navigation").getByRole("button", {
        name: t("Ruang katerer", "Caterer workspace"),
        exact: true,
      });
      await expect(entry).toBeVisible();
      const transition = page.waitForRequest(
        (request) =>
          new URL(request.url()).pathname === "/api/v1/auth/workspace" &&
          request.method() === "POST",
      );
      await entry.focus();
      await page.keyboard.press("Enter");
      expect((await transition).postDataJSON()).toEqual({
        workspace: "caterer",
      });
      await expect(page).toHaveURL(baseURL! + "/seller");
      await expect(
        page.getByRole("navigation", {
          name: t("Navigasi katerer", "Caterer navigation"),
          exact: true,
        }),
      ).toBeVisible();
      const operations = page.locator(".seller-operations");
      await expect(operations.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(operations.locator(".page-heading")).toHaveCSS(
        "opacity",
        "1",
      );
      expect(
        (await context.cookies(baseURL!)).find(
          (cookie) => cookie.name === "catera_workspace",
        )?.value,
      ).toBe("caterer");
      expect(
        (await (await page.request.get("/api/v1/me")).json()).data.actor.role,
      ).toBe(role);
      expect(businessActions).toEqual([]);
      expect(errors).toEqual([]);
      await page.screenshot({
        path: `${evidence}/account-workspace-entry-${role}-${locale}-390.png`,
        fullPage: true,
      });
    });

  test(`account workspace switching shows pending and recovers after failure ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "catera_locale", value: locale, url: baseURL! },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      (
        await page.request.post("/api/v1/auth/demo", {
          data: { role: "owner" },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post("/api/v1/auth/workspace", {
          data: { workspace: "customer" },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/account");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    await page.route("**/api/v1/auth/workspace", async (route) => {
      calls++;
      expect(route.request().postDataJSON()).toEqual({ workspace: "caterer" });
      await pending;
      await route.fulfill({
        status: 503,
        json: { error: { code: "REQUEST_FAILED" } },
      });
    });
    const entry = page.locator(".account-navigation").getByRole("button", {
      name: t("Ruang katerer", "Caterer workspace"),
      exact: true,
    });
    await entry.click();
    await expect(entry).toBeDisabled();
    await expect(entry).toHaveAttribute("aria-busy", "true");
    release();
    await expect(
      page.getByRole("status").filter({
        hasText: t(
          "Ruang kerja belum berhasil diganti. Coba lagi.",
          "The workspace could not be changed. Try again.",
        ),
      }),
    ).toBeVisible();
    await expect(entry).toBeEnabled();
    await expect(page).toHaveURL(baseURL! + "/account");
    expect(calls).toBe(1);
    expect(
      (await context.cookies(baseURL!)).find(
        (cookie) => cookie.name === "catera_workspace",
      )?.value,
    ).toBe("customer");
    await page.screenshot({
      path: `${evidence}/account-workspace-recovery-${locale}-390.png`,
      fullPage: true,
    });
    await page.unroute("**/api/v1/auth/workspace");
    await entry.click();
    await expect(page).toHaveURL(baseURL! + "/seller");
    expect(
      (await (await page.request.get("/api/v1/me")).json()).data.actor.role,
    ).toBe("owner");
  });

  test(`sign-out shows pending state and recovers without ending the session ${locale}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "catera_locale", value: locale, url: baseURL! },
    ]);
    await page.request.post("/api/v1/auth/demo", {
      data: { role: "customer" },
    });
    await page.goto("/account");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    await page.route("**/api/v1/auth/logout", async (route) => {
      calls++;
      await pending;
      await route.fulfill({
        status: 503,
        json: { error: { code: "REQUEST_FAILED" } },
      });
    });
    await page
      .locator(".account-session")
      .getByRole("button", { name: t("Keluar", "Sign out"), exact: true })
      .click();
    const button = page.getByRole("button", {
      name: t("Sedang keluar…", "Signing out…"),
      exact: true,
    });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    release();
    await expect(page.locator(".account-session .error-notice")).toContainText(
      t("Sesi masih aktif", "Your session remains open"),
    );
    expect(calls).toBe(1);
    expect(
      (await (await page.request.get("/api/v1/me")).json()).data.actor,
    ).toBeTruthy();
    await page.unrouteAll();
    await page
      .locator(".account-session")
      .getByRole("button", { name: t("Coba lagi", "Try again"), exact: true })
      .click();
    await expect(page).toHaveURL(baseURL! + "/");
    expect(
      (await (await page.request.get("/api/v1/me")).json()).data.actor,
    ).toBeNull();
  });
}

test("saved address editing persists while booked delivery addresses retain their snapshot", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "catera_locale", value: "en", url: baseURL! },
  ]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const before = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  await page.goto("/addresses");
  const card = page.locator(".address-card").filter({
    has: page.getByRole("heading", {
      name: before.addresses[0].label,
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const label = `Home ${Date.now()}`;
  await dialog
    .getByRole("textbox", { name: "Address label", exact: true })
    .fill(label);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const savedCard = page.locator(".address-card").filter({
    has: page.getByRole("heading", { name: label, exact: true }),
  });
  await expect(savedCard).toBeVisible();
  const after = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  expect(
    after.deliveries.map((delivery: { id: string; address: unknown }) => [
      delivery.id,
      delivery.address,
    ]),
  ).toEqual(
    before.deliveries.map((delivery: { id: string; address: unknown }) => [
      delivery.id,
      delivery.address,
    ]),
  );
  await savedCard.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "Address label", exact: true })
    .fill(before.addresses[0].label);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
