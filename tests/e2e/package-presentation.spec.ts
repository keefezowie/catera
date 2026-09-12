import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import type { Offer } from "@catera/domain";

const evidenceDir =
  process.env.CATERA_PRESENTATION_EVIDENCE || "output/package-presentation";
let box: Offer, single: Offer;
test.beforeAll(async ({ request }) => {
  await mkdir(evidenceDir, { recursive: true });
  await request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const base: Offer = (
    await (await request.get("/api/v1/catalog?limit=100")).json()
  ).data.items[0];
  const create = async (slug: string, overrides: Partial<Offer>) => {
    const result = await request.post("/api/v1/commands", {
      data: {
        action: "package.save",
        requestId: crypto.randomUUID(),
        payload: {
          catererId: base.catererId,
          slug,
          offer: { ...base, ...overrides },
        },
      },
    });
    expect(result.ok(), await result.text()).toBe(true);
    const items: Offer[] = (
      await (await request.get("/api/v1/catalog?limit=100")).json()
    ).data.items;
    return items.find((o) => o.slug === slug)!;
  };
  const dish = (id: string, name: string, image: string, groupId = "lauk") => ({
    id,
    name,
    image,
    groupId,
    description: "Hidangan sintetis untuk verifikasi tampilan.",
    serving: "150 g",
  });
  const lunch = {
    meal: "lunch",
    name: "Menu siang sintetis",
    image: base.image,
    description: "Contoh untuk pengujian",
    composition: [
      { id: "lauk", name: "Lauk", slots: 2 },
      { id: "sayur", name: "Sayur", slots: 1 },
      { id: "custom", name: "Pelengkap spesial", slots: 1 },
    ],
    items: [
      dish("ayam", "Ayam foto uji", base.image),
      dish("salmon", "Salmon foto uji", "/assets/food/salmon-teriyaki.png"),
      dish("sayur", "Sayur tanpa foto", "", "sayur"),
      dish(
        "broken",
        "Pelengkap foto gagal",
        "/missing-dish-photo.png",
        "custom",
      ),
    ],
    nutrition: null,
  };
  const suffix = Date.now();
  box = await create("photo-box-" + suffix, {
    name: "Demo · Paket siang dan malam " + suffix,
    packageType: "nasi_box",
    meal: "both",
    nutrition: {
      caloriesKcal: { min: 610, max: 650 },
      proteinG: { min: 27, max: 45 },
      carbsG: 0,
      fatG: 18,
    },
    menus: [
      lunch,
      {
        ...lunch,
        meal: "dinner",
        name: "Menu malam sintetis",
        nutrition: null,
        items: lunch.items.map((d) => ({ ...d, name: d.name + " malam" })),
      },
    ],
  });
  single = await create("photo-single-" + suffix, {
    name: "Demo · Satu hidangan " + suffix,
    packageType: "ala_carte",
    nutrition: null,
    menus: [
      {
        ...lunch,
        composition: [],
        items: [{ ...lunch.items[0], groupId: undefined }],
        nutrition: null,
      },
    ],
  });
});

test("card meal switch, comparison, contents navigation, photo failure and viewer accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#packages");
  const card = page.locator(".package-card").filter({
    has: page.getByRole("heading", { name: box.name, exact: true }),
  });
  await expect(card.locator(".composition-preview")).toHaveText(
    "2 Lauk · 1 Sayur · 1 Pelengkap spesial",
  );
  await expect(card).toContainText("610–650 kkal");
  await expect(card).toContainText("0 g");
  const price = (await card.locator(".card-price").textContent())!;
  await card.getByRole("button", { name: "Malam", exact: true }).click();
  await expect(card).toContainText("27–45 g");
  await expect(card).toContainText("610–650 kkal");
  await expect(card.locator(".card-price")).toHaveText(price);
  await card
    .getByRole("button", { name: "Bandingkan: " + box.name, exact: true })
    .click();
  await expect(
    card.getByRole("button", {
      name: "Hapus dari perbandingan: " + box.name,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await card
    .getByRole("link", { name: "Lihat isi paket", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(box.slug + "#isi-paket-dinner"));
  const dinner = page.locator("#isi-paket-dinner");
  await expect(
    dinner.getByRole("heading", { name: "Makan malam" }),
  ).toBeInViewport();
  await expect(
    dinner.getByText("Sayur tanpa foto malam", { exact: true }),
  ).toBeVisible();
  await expect(
    dinner.getByRole("button", {
      name: "Lihat foto Pelengkap foto gagal malam",
      exact: true,
    }),
  ).toHaveCount(0);
  const trigger = dinner.getByRole("button", {
    name: "Lihat foto Ayam foto uji malam",
    exact: true,
  });
  await trigger.click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toContainText("150 g");
  expect(
    await viewer
      .locator("img")
      .evaluate((el) => getComputedStyle(el).objectFit),
  ).toBe("contain");
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("responsive cards and galleries, duplicate single photo, English and text enlargement", async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#packages");
    await page.getByRole("textbox", { name: "Cari katering" }).fill(box.name);
    const card = page.locator(".package-card");
    await expect(card).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    await card.screenshot({
      path: `${evidenceDir}/card-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card.getByRole("link", { name: "Lihat paket", exact: true }).click();
    await page.locator("#isi-paket-lunch").scrollIntoViewIfNeeded();
    await page.locator("#isi-paket-lunch .dish-photo img").first().waitFor();
    await expect(
      page.locator("#isi-paket-lunch .dish-photo img").first(),
    ).toHaveJSProperty("complete", true);
    await page
      .locator("#isi-paket-lunch")
      .screenshot({ path: `${evidenceDir}/dishes-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/packages/" + single.slug);
  await expect(page.locator(".dish-photo")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Lihat foto hidangan", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute(
    "src",
    single.image,
  );
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("combobox", { name: "Bahasa", exact: true }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Included dishes", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Example menu", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("seller card preview allows meal inspection without navigation or purchasing", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const name = "Sintetis pratinjau draf " + Date.now();
  const draft = await page.request.post("/api/v1/commands", { data: {
    action: "package.save", requestId: crypto.randomUUID(), payload: {
      catererId: box.catererId, slug: "preview-draft-" + crypto.randomUUID(),
      offer: { ...box, name, status: "draft" },
    },
  }});
  expect(draft.ok(), await draft.text()).toBe(true);
  await page.goto("/seller/packages");
  const row = page.locator(".panel").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
  await row.getByRole("button", { name: "Kelola paket", exact: true }).click();
  await page.getByRole("button", { name: /2\. Isi/ }).click();
  const customRows = page
    .locator(".composition-row")
    .filter({ hasText: "Pelengkap spesial" });
  for (let i = 0; i < 2; i++) {
    await customRows.first().getByRole("combobox").click();
    await page.getByRole("option", { name: "Buah", exact: true }).click();
  }
  await page.getByRole("button", { name: /6\. Tinjau/ }).click();
  const card = page.locator(".listing-preview .package-card");
  await card.getByRole("button", { name: "Malam", exact: true }).click();
  await expect(card).toContainText("Menu belum ditentukan");
  await expect(card).not.toContainText("27 g");
  await expect(
    card.getByRole("button", { name: /^Bandingkan:/ }),
  ).toBeDisabled();
  await expect(
    card.getByRole("link", { name: "Lihat paket", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("long names, serving descriptions and many components remain readable at enlarged text", async ({
  page,
}) => {
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const slug = "photo-long-" + Date.now();
  const longName = "Demo · " + slug;
  const composition = Array.from({ length: 12 }, (_, i) => ({
    id: `g${i}`,
    name: `Komponen pilihan katerer ${i + 1}`,
    slots: 1,
  }));
  const items = composition.map((g, i) => ({
    id: `d${i}`,
    groupId: g.id,
    name: `Hidangan sintetis ${i + 1} dengan nama panjang untuk menguji keterbacaan menu katering keluarga`,
    serving:
      "Satu porsi lengkap dengan ukuran saji yang dijelaskan secara rinci oleh katerer (150 g)",
    description: "Deskripsi hidangan tetap tersedia di dalam paket.",
    image: "",
  }));
  const result = await page.request.post("/api/v1/commands", {
    data: {
      action: "package.save",
      requestId: crypto.randomUUID(),
      payload: {
        catererId: box.catererId,
        slug,
        offer: {
          ...box,
          name:
            longName +
            " paket lengkap untuk makan bersama keluarga dengan pilihan hidangan",
          meal: "lunch",
          menus: [{ ...box.menus[0], composition, items }],
        },
      },
    },
  });
  expect(result.ok(), await result.text()).toBe(true);
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  await page.goto("/#packages");
  await page.getByRole("textbox", { name: "Cari katering" }).fill(longName);
  const card = page.locator(".package-card");
  await expect(card).toHaveCount(1);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(card.locator(".composition-preview")).toHaveCSS(
    "-webkit-line-clamp",
    "2",
  );
  expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await card
    .getByRole("link", { name: "Lihat isi paket", exact: true })
    .click();
  await expect(page.locator(".dish-tile")).toHaveCount(12);
  await expect(page.locator(".dish-serving").first()).toHaveText(
    items[0].serving,
  );
  await expect(page.locator(".dish-photo")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
