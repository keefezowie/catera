import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function login(page: Page) {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role: "owner" },
  });
  expect(response.ok()).toBe(true);
}

test("operational date and meal period are separate responsive controls", async ({
  page,
  context,
}) => {
  await login(page);

  for (const locale of ["id", "en"] as const) {
    await context.addCookies([
      {
        name: "catera_locale",
        value: locale,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);

    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/seller");

      const date = page.getByRole("button", {
        name: locale === "id" ? "Tanggal operasional" : "Operational date",
      });
      const meal = page.getByRole("tab", {
        name: locale === "id" ? "Siang" : "Lunch",
        exact: true,
      });
      const dinner = page.getByRole("tab", {
        name: locale === "id" ? "Malam" : "Dinner",
        exact: true,
      });
      const [dateBox, mealBox] = await Promise.all([
        date.boundingBox(),
        meal.boundingBox(),
      ]);
      expect(dateBox).not.toBeNull();
      expect(mealBox).not.toBeNull();
      expect(mealBox!.y).toBeGreaterThanOrEqual(dateBox!.y + dateBox!.height);
      expect(mealBox!.height).toBeGreaterThanOrEqual(44);
      expect(dateBox!.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await date.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(date).toBeFocused();
      const selectedDate = await date.textContent();
      await meal.focus();
      await meal.press("ArrowRight");
      await expect(dinner).toBeFocused();
      await expect(dinner).toHaveAttribute("aria-selected", "true");
      await expect(date).toHaveText(selectedDate!);
      await dinner.press("ArrowLeft");
      await expect(meal).toHaveAttribute("aria-selected", "true");
    }
  }
});

test("cutoff editor stays in a 24-hour format", async ({ page }) => {
  await login(page);
  await page.goto("/seller/settings");

  const cutoff = page.getByRole("button", {
    name: "Cutoff sehari sebelumnya",
  });
  await expect(cutoff).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.locator('input[name="cutoff"]')).toHaveValue(
    (await cutoff.textContent())!,
  );
  await expect(page.locator('input[type="time"]')).toHaveCount(0);

  await cutoff.click();
  const picker = page.getByRole("dialog", { name: "Pilih waktu" });
  await expect(picker).toBeVisible();

  await picker.getByRole("combobox", { name: "Jam" }).click();
  await page.getByRole("option", { name: "22", exact: true }).click();
  await picker.getByRole("combobox", { name: "Menit" }).click();
  await page.getByRole("option", { name: "30", exact: true }).click();
  await picker.getByRole("button", { name: "Simpan" }).click();

  await expect(cutoff).toHaveText("22:30");
  await expect(page.locator('input[name="cutoff"]')).toHaveValue("22:30");
});

test("UI sweep: focus rings, support count, composition controls and centered previews", async ({
  page,
}) => {
  await mkdir("output/ui-sweep", { recursive: true });
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  const customer = (await (await page.request.get("/api/v1/customer")).json())
    .data;
  const support = await page.request.post("/api/v1/commands", {
    data: {
      action: "support.create",
      requestId: crypto.randomUUID(),
      payload: {
        subscriptionId: customer.subscriptions[0].id,
        subject: "Synthetic UI sweep support count",
        description:
          "Synthetic support case for browser verification of the open-case badge.",
      },
    },
  });
  expect(support.ok(), await support.text()).toBe(true);
  await login(page);
  const actor = (await (await page.request.get("/api/v1/me")).json()).data
    .actor;
  const catalog = (
    await (await page.request.get("/api/v1/catalog?limit=100")).json()
  ).data.items;
  const base = catalog.find(
    (offer: { catererId: string }) => offer.catererId === actor.catererId,
  );
  const name = "Sintetis UI sweep " + Date.now();
  const draft = await page.request.post("/api/v1/commands", {
    data: {
      action: "package.save",
      requestId: crypto.randomUUID(),
      payload: {
        catererId: actor.catererId,
        slug: "ui-sweep-" + crypto.randomUUID(),
        offer: { ...base, name, status: "draft" },
      },
    },
  });
  expect(draft.ok(), await draft.text()).toBe(true);
  await page.goto("/seller");
  const badge = page.locator(".ops-support-link .ops-count-badge");
  await expect(badge).toHaveText(/^[1-9]\d*$/);
  await expect(badge).toHaveCSS("background-color", "rgb(163, 48, 36)");
  await page.screenshot({
    path: "output/ui-sweep/support-badge.png",
    fullPage: true,
  });
  await page.goto("/seller/menus");
  const library = page.locator(".menu-library-desktop");
  await library.getByRole("button", { name: "Tambah", exact: true }).click();
  const input = library.getByRole("textbox", {
    name: "Nama hidangan",
    exact: true,
  });
  await input.focus();
  const clearance = await input.evaluate((el) => {
    const box = el.getBoundingClientRect(),
      scroll = el.closest("aside")!.getBoundingClientRect();
    const style = getComputedStyle(el),
      ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    return {
      left: box.left - scroll.left,
      right: scroll.right - box.right,
      ring,
    };
  });
  expect(clearance.left).toBeGreaterThanOrEqual(clearance.ring);
  expect(clearance.right).toBeGreaterThanOrEqual(clearance.ring);
  await library.screenshot({ path: "output/ui-sweep/dish-focus.png" });
  // Keep Menu's loaded styles in the page while navigating into the package editor.
  await page
    .locator(".ops-sidebar")
    .getByRole("link", { name: "Paket", exact: true })
    .click();
  await page
    .locator(".panel")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "Kelola paket", exact: true })
    .click();
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  const row = page.locator(".composition-row").first();
  const count = row.getByRole("spinbutton");
  await count.fill("0");
  await count.press("Tab");
  await expect(count).toHaveValue("1");
  const category = page
    .getByRole("button", { name: "Kategori baru", exact: true })
    .first();
  await category.click();
  await expect(category).toHaveAttribute("aria-expanded", "true");
  await expect(category.locator("svg")).toHaveClass(/lucide-minus/);
  await category.click();
  await expect(category).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  const preview = page.locator(".listing-preview.card");
  await expect(preview).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const delta = await preview.evaluate((el) => {
      const a = el.getBoundingClientRect(),
        p = el.parentElement!.getBoundingClientRect();
      return Math.abs(a.x + a.width / 2 - p.x - p.width / 2);
    });
    expect(delta).toBeLessThanOrEqual(1);
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await preview.screenshot({ path: `output/ui-sweep/preview-${width}.png` });
  }
});
