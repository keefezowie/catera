import { test, expect, type Page } from "@playwright/test";

const packageId = "20000000-0000-4000-8000-000000000003";

async function expectLogin(page: Page, destination: string) {
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/login" && url.searchParams.get("next") === destination,
  );
  await expect(page.locator(".mobile-bottom")).toHaveCount(0);
}

test("guests browse and compare without mobile navigation; login and logout update the shell", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".mobile-bottom")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Masuk / Daftar" }),
  ).toBeVisible();
  await expect(page.locator(".site-footer")).toHaveCSS(
    "padding-bottom",
    "28px",
  );
  await expect(page.locator(".toast")).toHaveCSS("bottom", "24px");
  await page
    .getByRole("button", { name: "Bandingkan: Rantang Nusantara", exact: true })
    .click();
  await expect(page.locator(".compare-floating")).toHaveCSS("bottom", "20px");
  await page.screenshot({
    path: "output/guest-auth/mobile-guest.png",
    fullPage: true,
  });
  await page
    .locator(".compare-floating")
    .getByRole("link", { name: "Bandingkan" })
    .click();
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.locator(".mobile-bottom")).toHaveCount(0);
  await page.goto("/login?next=" + encodeURIComponent("/compare"));
  await expect(page.locator(".mobile-bottom")).toHaveCount(0);
  await page.getByRole("button", { name: "Jelajah sebagai pelanggan" }).click();
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.locator(".mobile-bottom")).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".compare-floating")).toHaveCSS("bottom", "89px");
  await expect(page.locator(".toast")).toHaveCSS("bottom", "93px");
  const bar = (await page.locator(".mobile-bottom").boundingBox())!;
  const comparison = (await page.locator(".compare-floating").boundingBox())!;
  expect(comparison.y + comparison.height).toBeLessThan(bar.y);
  await page.screenshot({
    path: "output/guest-auth/mobile-authenticated.png",
    fullPage: true,
  });
  await page
    .locator(".mobile-bottom")
    .getByRole("link", { name: "Akun", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  await page.reload();
  await expect(page.locator(".mobile-bottom a[aria-current]")).toHaveText(
    "Akun",
  );
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".mobile-bottom")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".desktop-nav")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Masuk / Daftar" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/guest-auth/desktop-guest.png",
    fullPage: true,
  });
  await page
    .locator(".compare-floating")
    .getByRole("button", {
      name: "Hapus semua paket dari perbandingan",
      exact: true,
    })
    .click();
  await expect(page.locator(".compare-floating")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("comparison portions allow replacement typing and normalize zero", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Bandingkan: Rantang Nusantara", exact: true })
    .click();
  await page
    .locator(".compare-floating")
    .getByRole("link", { name: "Bandingkan" })
    .click();
  const portions = page.getByRole("spinbutton", { name: "Porsi perbandingan" });

  const box = (await portions.boundingBox())!;
  await portions.click({ position: { x: 4, y: box.height / 2 } });
  await page.keyboard.press("Backspace");
  await expect(portions).toHaveValue("");
  await portions.pressSequentially("2");
  await expect(portions).toHaveValue("2");

  await portions.fill("0");
  await expect(portions).toHaveValue("0");
  await portions.blur();
  await expect(portions).toHaveValue("1");

  await portions.fill("");
  await portions.blur();
  await expect(portions).toHaveValue("1");
});

for (const trial of [false, true]) {
  test(`guest ${trial ? "trial" : "purchase"} resumes checkout after authentication`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/packages/" + packageId);
    await expect(page.locator(".mobile-bottom")).toHaveCount(0);
    await page.getByRole("button", { name: "Tambah porsi" }).click();
    const action = page.getByRole("link", {
      name: trial ? /Coba 1 hari/ : "Pilih paket ini",
    });
    await expect(action).toHaveAttribute("href", /portions=2/);
    const destination = (await action.getAttribute("href"))!;
    expect(destination).toContain("portions=2");
    if (trial) expect(destination).toContain("trial=1");
    await action.click();
    await expectLogin(page, destination);
    await page
      .getByRole("button", { name: "Jelajah sebagai pelanggan" })
      .click();
    await expect(page).toHaveURL(destination);
    await expect(
      page.getByRole("button", { name: "Tinjau jadwal & harga" }),
    ).toBeVisible();
    await expect(page.locator(".mobile-bottom")).toBeVisible();
  });
}

test("protected deep links retain all query parameters", async ({ page }) => {
  for (const destination of [
    `/checkout/${packageId}?trial=1&portions=2&source=one&source=two`,
    "/home",
    "/calendar",
    "/account",
    "/addresses",
    "/notifications",
    "/subscriptions",
    "/deliveries/example",
    "/payment/example",
    "/support",
    "/messages?caterer=example",
  ]) {
    await page.goto(destination);
    await expectLogin(page, destination);
  }
});

test("caterer messaging resumes after login", async ({ page }) => {
  await page.goto("/packages/" + packageId);
  const catererHref = await page
    .locator('a[href^="/caterers/"]')
    .first()
    .getAttribute("href");
  await page.goto(catererHref!);
  const action = page.getByRole("link", { name: "Tanya katerer" });
  const loginUrl = new URL(
    (await action.getAttribute("href"))!,
    "http://localhost",
  );
  const destination = loginUrl.searchParams.get("next")!;
  expect(destination).toMatch(/^\/messages\?caterer=/);
  await action.click();
  await expectLogin(page, destination);
  await page.getByRole("button", { name: "Jelajah sebagai pelanggan" }).click();
  await expect(page).toHaveURL(destination);
});

test("guest login keeps sign-in accessible without navigation clearance", async ({
  page,
}) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login");
    await expect(page.locator(".mobile-bottom")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Masuk / Daftar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Jelajah sebagai pelanggan" }),
    ).toBeVisible();
    if (width === 390) {
      await expect(page.locator(".site-footer")).toHaveCSS(
        "padding-bottom",
        "28px",
      );
      await expect(page.locator(".toast")).toHaveCSS("bottom", "24px");
    } else {
      await expect(page.locator(".desktop-nav")).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/guest-auth/login-${width}.png`,
      fullPage: true,
    });
  }
});
