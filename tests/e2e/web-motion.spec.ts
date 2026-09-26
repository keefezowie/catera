import { test, expect, type Page } from "@playwright/test";
import { addDays, localDay, type Offer } from "@catera/domain";
import { mkdir } from "node:fs/promises";

const evidence = "output/playwright/motion";
const cid = "10000000-0000-4000-8000-000000000001";
async function login(page: Page, role: string) {
  expect(
    (await page.request.post("/api/v1/auth/demo", { data: { role } })).ok(),
  ).toBe(true);
}
async function capture(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: false });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function command(page: Page, action: string, payload: unknown) {
  const response = await page.request.post("/api/v1/commands", {
    data: { action, payload, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).data;
}

for (const locale of ["id", "en"])
  for (const width of [1440, 390]) {
    test(`motion journeys preserve selection, checkout, payment and editor drafts ${locale} ${width}`, async ({
      page,
      baseURL,
    }) => {
      test.setTimeout(90000);
      const t = (id: string, en: string) => (locale === "id" ? id : en);
      const shot = (name: string) =>
        capture(page, `after-${locale}-${width}-${name}`);
      await page
        .context()
        .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await expect(page.locator(".package-card").first()).toBeVisible();
      await shot("discovery");
      if (width === 390) {
        for (const narrow of [320, 768]) {
          await page.setViewportSize({ width: narrow, height: 844 });
          await capture(page, `after-${locale}-${narrow}-discovery-reflow`);
        }
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await page
        .locator(".catalog-controls")
        .getByRole("button", { name: t("Makan siang", "Lunch"), exact: true })
        .click();
      await page
        .locator(".catalog-controls")
        .getByRole("button", { name: t("Makan malam", "Dinner"), exact: true })
        .click();
      await page
        .getByRole("button", {
          name: t("Semua paket", "All packages"),
          exact: true,
        })
        .click();
      const card = page.locator(".package-card").first();
      const name = await card.locator("h3").innerText();
      await card
        .getByRole("button", {
          name: t("Bandingkan: ", "Compare: ") + name,
          exact: true,
        })
        .click();
      await expect(page.locator(".compare-floating")).toBeVisible();
      await shot("comparison-tray");
      await card
        .getByRole("link", {
          name: t("Lihat paket", "View package"),
          exact: true,
        })
        .click();
      await expect(page.locator(".detail-hero")).toBeVisible();
      await shot("package-detail");
      await page.goBack();
      await expect(
        page.getByRole("button", {
          name: t("Semua paket", "All packages"),
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");

      await login(page, "owner");
      const offers = (await (await page.request.get("/api/v1/catalog")).json())
        .data.items as Offer[];
      const original = offers.find((offer) => offer.catererId === cid)!;
      const created = await command(page, "package.save", {
        catererId: cid,
        slug: `motion-${crypto.randomUUID()}`,
        offer: {
          ...original,
          name: `Synthetic motion ${locale} ${width}`,
          days: 2,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          capacity: Object.fromEntries(
            [0, 1, 2, 3, 4, 5, 6].map((day) => [day, 100]),
          ),
        },
      });
      await login(page, "customer");
      const checkoutPath = `/checkout/${created.id}?startDate=${addDays(localDay(), 15)}`;
      await page.goto(checkoutPath);
      const review = () =>
        page.getByRole("button", {
          name: t("Tinjau jadwal & harga", "Review schedule & price"),
          exact: true,
        });
      await review().click();
      const pay = () =>
        page.getByRole("button", {
          name: t("Lanjutkan ke pembayaran", "Continue to payment"),
          exact: true,
        });
      await expect(pay()).toBeDisabled();
      await page
        .getByRole("button", { name: t("Ubah", "Edit"), exact: true })
        .click();
      await expect(review()).toBeEnabled();
      await review().click();
      await shot("checkout-review");
      if (width === 390) {
        for (const narrow of [320, 768]) {
          await page.setViewportSize({ width: narrow, height: 844 });
          await capture(page, `after-${locale}-${narrow}-checkout-reflow`);
        }
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await page.getByRole("checkbox", { name: /Syarat|Terms/ }).check();
      // Hold the request long enough to verify stable geometry and duplicate protection.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let submissions = 0;
      await page.route("**/api/v1/commands", async (route) => {
        if (route.request().postDataJSON().action !== "checkout.create")
          return route.continue();
        submissions++;
        await gate;
        await route.continue();
      });
      const before = await pay().boundingBox();
      await pay().click();
      const pending = page.locator(
        ".checkout-fields button[data-pending=true]",
      );
      await expect(pending).toBeDisabled();
      const during = await pending.boundingBox();
      expect(during!.width).toBeCloseTo(before!.width, 0);
      expect(during!.height).toBeCloseTo(before!.height, 0);
      await page.locator(".checkout-fields form").evaluate((form) => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      await shot("checkout-pending");
      release();
      await page.waitForURL(/\/payment\//);
      expect(submissions).toBe(1);
      await expect(page.locator(".payment-success")).toHaveCount(0);
      await page
        .getByRole("button", {
          name: t(
            "Simulasikan pembayaran berhasil",
            "Simulate successful payment",
          ),
          exact: true,
        })
        .click();
      await expect(page.locator(".payment-success")).toBeVisible();
      const paid = (
        await (
          await page.request.get(
            "/api/v1/checkouts/" + page.url().split("/").at(-1),
          )
        ).json()
      ).data;
      expect(paid.state).toBe("paid");
      expect(paid.subscription_id).toBeTruthy();
      await shot("payment-success");
      await page
        .getByRole("link", {
          name: t("Lihat jadwal makan", "View meal calendar"),
        })
        .click();
      await expect(page.locator(".coverage-strip")).toBeVisible();
      await shot("customer-calendar");

      await login(page, "owner");
      await page.goto("/seller/schedule");
      await expect(page.locator(".coverage-strip")).toBeVisible();
      await shot("seller-schedule");
      await page.goto("/seller/packages");
      await page
        .getByRole("button", {
          name: t("Buat paket", "Create package"),
          exact: true,
        })
        .click();
      const editor = page.locator(".package-dialog");
      await editor
        .getByRole("button", { name: t("Lanjutkan", "Continue"), exact: true })
        .click();
      await expect(editor.locator("[aria-invalid=true]:focus")).toHaveCount(1);
      await shot("editor-validation");
      await editor
        .getByLabel(t("Nama paket", "Package name"), { exact: true })
        .fill("Demo motion draft");
      await editor
        .getByLabel(t("Deskripsi paket", "Package description"), { exact: true })
        .fill("Paket sintetis khusus verifikasi motion Catera.");
      await editor
        .getByRole("combobox", {
          name: t("Jenis paket", "Package type"),
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: t("Nasi box", "Rice box"), exact: true })
        .click();
      await editor
        .getByRole("button", { name: t("Lanjutkan", "Continue"), exact: true })
        .click();
      await shot("editor-step");
      await editor
        .getByRole("button", { name: t("Kembali", "Back"), exact: true })
        .click();
      await expect(
        editor.getByLabel(t("Nama paket", "Package name"), { exact: true }),
      ).toHaveValue("Demo motion draft");
      await editor
        .getByRole("button", {
          name: t("Simpan draf", "Save draft"),
          exact: true,
        })
        .click();
      await expect(editor).toHaveCount(0);
      await shot("draft-saved");
      expect(errors).toEqual([]);
    });
  }

test("live reduced motion cancels movement and leaves focus and drafts usable under mobile CPU throttling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // Switch the real preference as soon as the real step animation begins.
  // A post-click assertion can miss a 220ms transition on a busy test host.
  await page.exposeFunction("onMotionStart", () =>
    page.emulateMedia({ reducedMotion: "reduce" }),
  );
  await page.addInitScript(() => {
    const state = window as typeof window & {
      motionUnderTest?: Animation[];
      onMotionStart?: () => Promise<void>;
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (this.matches(".editor-fields")) {
        state.motionUnderTest = [animation];
        void state.onMotionStart?.();
      }
      return animation;
    };
  });
  await login(page, "owner");
  await page.goto("/seller/packages");
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  const editor = page.locator(".package-dialog");
  await editor
    .getByLabel("Nama paket", { exact: true })
    .fill("Reduced motion retained draft");
  await editor
    .getByLabel("Deskripsi paket", { exact: true })
    .fill("Synthetic motion cancellation check.");
  await editor
    .getByRole("combobox", { name: "Jenis paket", exact: true })
    .click();
  await page.getByRole("option", { name: "Nasi box", exact: true }).click();
  await editor.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { motionUnderTest?: Animation[] })
            .motionUnderTest?.length || 0,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      editor.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
    )
    .toBe(0);
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { motionUnderTest?: Animation[] }
      ).motionUnderTest?.every((animation) => animation.playState === "idle"),
    ),
  ).toBe(true);
  await editor.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(editor.getByLabel("Nama paket", { exact: true })).toHaveValue(
    "Reduced motion retained draft",
  );
  await page.keyboard.press("Escape");
  const confirm = page.locator(".dialog-confirmation");
  await expect(
    confirm.getByRole("button", { name: "Lanjut mengedit" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(editor).not.toHaveAttribute("inert", "");
  await capture(page, "after-id-390-reduced-motion");
  await page.goto("/seller/schedule");
  await expect(page.locator(".coverage-strip")).toBeVisible();
  for (const width of [768, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await capture(page, `after-id-${width}-seller-reflow`);
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});

test("filter entrances are limited to visible results and never replay on typing or locale changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const state = window as typeof window & { motionTargets: string[] };
    state.motionTargets = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      state.motionTargets.push(this.className.toString());
      return animate.call(this, frames, options);
    };
  });
  await page.goto("/#packages");
  const search = page.getByRole("searchbox", { name: "Cari katering" });
  await expect(search).toBeVisible();
  await search.focus();
  const reset = () =>
    page.evaluate(() => {
      (window as typeof window & { motionTargets: string[] }).motionTargets =
        [];
    });
  const targets = () =>
    page.evaluate(
      () =>
        (window as typeof window & { motionTargets: string[] }).motionTargets,
    );
  await reset();
  await search.pressSequentially("Ayam");
  expect(await targets()).toEqual([]);
  await page.getByRole("combobox", { name: "Bahasa" }).click();
  await page.getByRole("option", { name: /English/ }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search caterers" }),
  ).toHaveValue("Ayam");
  expect(await targets()).toEqual([]);
  await page.getByRole("searchbox", { name: "Search caterers" }).fill("");
  await page.locator(".catalog-controls").evaluate((el) =>
    window.scrollTo({
      top: el.getBoundingClientRect().top + scrollY - 160,
      behavior: "instant",
    }),
  );
  await reset();
  await page
    .locator(".catalog-controls")
    .getByRole("button", { name: "Lunch", exact: true })
    .click();
  const animated = await targets();
  expect(animated.length).toBeGreaterThan(0);
  expect(animated.every((name) => name.includes("package-card"))).toBe(true);
  expect(animated.length).toBeLessThan(
    await page.locator(".package-card").count(),
  );
});

test.describe("touch discovery", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("swipe changes the featured caterer and vertical touch scrolling stays available", async ({
    page,
  }) => {
    await page.goto("/");
    const active = page.locator(".featured-slide:not([inert])");
    await expect(active).toContainText("Dapur Senja");
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
    ).toBe(true);
    const box = (await page.locator(".featured-viewport").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const y = box.y + 130;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width - 25, y }],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: box.x + box.width - 25 - ((box.width - 50) * i) / 10, y },
        ],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(active).not.toContainText("Dapur Senja");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 195, y: 410 }],
    });
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 195, y: 410 - i * 25 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Tampilkan Dapur Senja" }).click();
    await expect(active).toContainText("Dapur Senja");
    await capture(page, "after-id-390-touch-carousel");
  });
});

test("seller calendar cancels an active smooth scroll when reduced motion changes", async ({
  page,
}) => {
  await login(page, "owner");
  await page.goto("/seller/schedule");
  const strip = page.locator(".coverage-strip");
  await expect(strip).toBeVisible();
  await page.exposeFunction("onCalendarScroll", () =>
    page.emulateMedia({ reducedMotion: "reduce" }),
  );
  await strip.evaluate((node) => {
    const el = node as HTMLElement;
    const state = window as typeof window & {
      calendarStopped?: boolean;
      onCalendarScroll?: () => Promise<void>;
    };
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    const by = el.scrollBy.bind(el),
      to = el.scrollTo.bind(el);
    el.scrollBy = (options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === "number") return by(options, y || 0);
      by(options);
      if (options?.behavior === "smooth") void state.onCalendarScroll?.();
    };
    el.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === "number") return to(options, y || 0);
      if (options?.behavior === "instant") state.calendarStopped = true;
      to(options);
    };
  });
  await page
    .getByRole("button", { name: "Tanggal sebelumnya", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { calendarStopped?: boolean })
            .calendarStopped,
      ),
    )
    .toBe(true);
  const stopped = await strip.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(100);
  expect(await strip.evaluate((el) => el.scrollLeft)).toBeCloseTo(stopped, 0);
  await expect(
    page.getByRole("button", { name: "Tanggal sebelumnya", exact: true }),
  ).toBeFocused();
});
