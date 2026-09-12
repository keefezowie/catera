import { test, expect } from "@playwright/test";

test("mascot loads, pauses, respects reduced motion and releases loading immediately", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dev/mascot");
  const mascot = page.locator(".mascot-animation").first();
  await expect(mascot).toHaveAttribute("data-ready", "true");
  await expect(mascot).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: "Jeda", exact: true }).click();
  await expect(mascot).toHaveAttribute("data-active", "false");
  await expect(mascot.locator(".mascot-rig")).toHaveCSS("opacity", "1");
  await expect(mascot.locator(".mascot-body")).toHaveCSS(
    "animation-play-state",
    "paused",
  );
  await page.getByRole("button", { name: "Putar", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(mascot.locator(".mascot-rig")).toBeHidden();
  await expect(mascot.locator(".mascot-poster")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Mulai memuat", exact: true }).click();
  await expect(page.getByRole("status")).toHaveAttribute(
    "aria-label",
    "Menyiapkan Catera untuk Anda…",
  );
  await expect(page.locator(".mascot-loading-visual")).toBeVisible();
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("note")).toHaveText("Konten siap.");
  expect(errors).toEqual([]);
});

test("missing animation layer retains neutral artwork", async ({ page }) => {
  await page.route("**/mascot-motion/closed.png", (route) => route.abort());
  await page.goto("/dev/mascot");
  const mascot = page.locator(".mascot-animation").first();
  await expect(mascot.locator(".mascot-poster")).toBeVisible();
  await expect(mascot).toHaveAttribute("data-ready", "false");
});

test("reveal delay prevents fast-load flashes and narrow layouts do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/mascot");
  await page.getByRole("button", { name: "Mulai memuat", exact: true }).click();
  await expect(page.locator(".mascot-loading-visual")).toHaveAttribute(
    "data-visible",
    "false",
  );
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("loop boundary is continuous and eye transitions blend without dropping the body", async ({
  page,
}) => {
  await page.goto("/dev/mascot");
  const mascot = page.locator(".mascot-animation").first();
  await expect(mascot).toHaveAttribute("data-ready", "true");
  const sample = async (time: number) =>
    mascot.evaluate((el, t) => {
      el.getAnimations({ subtree: true }).forEach((a) => {
        if (a instanceof CSSAnimation) {
          a.pause();
          a.currentTime = t;
        }
      });
      const css = (selector: string) =>
        getComputedStyle(el.querySelector(selector)!);
      return {
        body: css(".mascot-body").transform,
        half: Number(css(".mascot-half").opacity),
        closed: Number(css(".mascot-closed").opacity),
        rig: Number(css(".mascot-rig").opacity),
      };
    }, time);
  const start = await sample(0);
  const end = await sample(2400);
  expect(end.body).toBe(start.body);
  expect(end.half).toBe(0);
  expect(end.closed).toBe(0);
  const half = await sample(1095);
  expect(half.half).toBeGreaterThan(0);
  expect(half.half).toBeLessThan(1);
  const closed = await sample(1155);
  expect(closed.closed).toBeGreaterThan(0);
  expect(closed.closed).toBeLessThan(1);
  expect(closed.half).toBe(1);
  await expect(mascot.locator(".mascot-rig")).toHaveCSS("opacity", "1");
});

test("reduced motion still reveals the loading label", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/mascot");
  await page.getByRole("button", { name: "Mulai memuat", exact: true }).click();
  await expect(page.locator(".mascot-loading-visual")).toBeVisible();
  await expect(page.locator(".mascot-loading .mascot-poster")).toHaveCSS(
    "opacity",
    "1",
  );
});

for (const width of [390, 1440])
  test(`navigation preserves shared bars and scopes pending content at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.request.post("/api/v1/auth/demo", {
      data: { role: "customer" },
    });
    await page.goto("/home");
    await expect(page.locator(".next-meal-card")).toBeVisible();
    const header = page.locator(".site-header");
    await expect(header).toBeVisible();
    await header.evaluate((el) =>
      el.setAttribute("data-persistence-test", "retained"),
    );
    if (width === 390)
      await page
        .locator(".mobile-bottom")
        .evaluate((el) => el.setAttribute("data-persistence-test", "retained"));
    let release!: () => void;
    let requested = false;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      width === 390 ? "**/api/v1/conversations**" : "**/api/v1/customer**",
      async (route) => {
        requested = true;
        await pending;
        await route.continue();
      },
    );
    try {
      if (width === 390)
        await page
          .locator(".mobile-bottom")
          .getByRole("link", { name: "Pesan", exact: true })
          .click();
      else {
        await header.getByRole("button", { name: "Buka menu akun" }).click();
        await page.getByRole("menuitem", { name: "Akun", exact: true }).click();
      }
      await expect.poll(() => requested).toBe(true);
      const loader = page.locator("#main .mascot-loading");
      await expect(loader).toBeVisible();
      await expect(header).toHaveAttribute("data-persistence-test", "retained");
      const h = await header.boundingBox(),
        l = await loader.boundingBox();
      expect(l!.y).toBeGreaterThanOrEqual(h!.y + h!.height);
      expect(await page.locator(".mascot-startup").count()).toBe(0);
      if (width === 390)
        await expect(page.locator(".mobile-bottom")).toHaveAttribute(
          "data-persistence-test",
          "retained",
        );
      await expect(loader.locator(".mascot-loading-visual")).toBeVisible();
      await expect(loader.locator(".mascot-loading-visual")).toHaveCSS(
        "opacity",
        "1",
      );
      await page.screenshot({
        path: `output/mascot-motion/scoped-${width}.png`,
        fullPage: true,
      });
    } finally {
      release();
    }
    await expect(page.locator("#main .mascot-loading")).toHaveCount(0);
  });

test("seller sidebar and top bar persist while the next workspace loads", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  await page.goto("/seller");
  await expect(page.locator(".ops-main h1")).toBeVisible();
  for (const selector of [".ops-topbar", ".ops-sidebar"])
    await page
      .locator(selector)
      .evaluate((el) => el.setAttribute("data-persistence-test", "retained"));
  let release!: () => void,
    requested = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/seller/**", async (route) => {
    requested = true;
    await pending;
    await route.continue();
  });
  try {
    await page
      .locator(".ops-sidebar")
      .getByRole("link", { name: "Paket", exact: true })
      .click();
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator("#main .mascot-loading-visual")).toBeVisible();
    for (const selector of [".ops-topbar", ".ops-sidebar"])
      await expect(page.locator(selector)).toHaveAttribute(
        "data-persistence-test",
        "retained",
      );
    const sidebar = await page.locator(".ops-sidebar").boundingBox(),
      loader = await page.locator("#main .mascot-loading").boundingBox();
    expect(loader!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
    await page.screenshot({
      path: "output/mascot-motion/scoped-seller.png",
      fullPage: true,
    });
  } finally {
    release();
  }
  await expect(page.locator("#main .mascot-loading")).toHaveCount(0);
});
