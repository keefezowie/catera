import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SellerOperationsState } from "@catera/domain";

const sellerId = "10000000-0000-4000-8000-000000000001";

async function login(page: Page, role: string) {
  const response = await page.request.post("/api/v1/auth/demo", {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Content must fit the viewport when a disclosure opens",
  ).toBe(true);
}

async function doubleText(page: Page) {
  await page.evaluate(() => {
    // Snapshot computed sizes before editing so inherited values do not double
    // again as descendants are visited; px-based text is included as well.
    const sizes = [...document.querySelectorAll<HTMLElement>("body *")].map(
      (element) => {
        const style = getComputedStyle(element);
        return {
          element,
          font: parseFloat(style.fontSize),
          line: parseFloat(style.lineHeight),
        };
      },
    );
    for (const { element, font, line } of sizes) {
      element.style.setProperty("font-size", `${font * 2}px`, "important");
      if (Number.isFinite(line))
        element.style.setProperty("line-height", `${line * 2}px`, "important");
    }
  });
  await settled(page);
}

// Read all related rectangles together: separately scrolling/sampling each
// locator can make a gap assertion compare two different viewport positions.
async function disclosureSpacing(disclosure: Locator) {
  const measurements = await disclosure.evaluate((element) => {
    const summary = element.querySelector(":scope > summary")!;
    const heading = summary.querySelector(".disclosure-heading")!;
    const body = element.querySelector(":scope > .disclosure-body")!;
    const summaryBox = summary.getBoundingClientRect();
    const headingBox = heading.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const children = [...body.children]
      .filter((child) => {
        const box = child.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .map((child) => child.getBoundingClientRect());
    return {
      summaryInset: headingBox.left - summaryBox.left,
      firstBodyGap: children[0]?.top - summaryBox.bottom,
      bodyInset: children[0]?.left - bodyBox.left,
      siblingGaps: children
        .slice(1)
        .map((box, index) => box.top - children[index].bottom),
      minimumInset: element.classList.contains("disclosure-panel") ? 16 : 12,
    };
  });
  expect(
    measurements.summaryInset,
    "Summary label has its own inset",
  ).toBeGreaterThanOrEqual(measurements.minimumInset);
  expect(
    measurements.firstBodyGap,
    "Expanded content clears the summary",
  ).toBeGreaterThanOrEqual(12);
  expect(
    measurements.bodyInset,
    "Expanded content retains side padding",
  ).toBeGreaterThanOrEqual(measurements.minimumInset);
  for (const gap of measurements.siblingGaps)
    expect(
      gap,
      "Neighboring body blocks have positive spacing",
    ).toBeGreaterThanOrEqual(12);
}

async function keyboardDisclosure(page: Page, disclosure: Locator) {
  const summary = disclosure.locator(":scope > summary");
  const body = disclosure.locator(":scope > .disclosure-body");
  await expect(disclosure).not.toHaveAttribute("open");
  await expect(body).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(body).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).not.toHaveCSS("outline-style", "none");
  await settled(page);
  await disclosureSpacing(disclosure);
  await noOverflow(page);
  await page.keyboard.press("Space");
  await expect(disclosure).not.toHaveAttribute("open");
  await expect(body).toBeHidden();
  await expect(summary).toBeFocused();
}

async function readinessSpacing(readiness: Locator) {
  const gaps = await readiness.evaluate((element) => {
    const action = element.querySelector(".seller-readiness-next")!;
    const summary = element.querySelector(
      ".seller-readiness-checklist > summary",
    )!;
    const checklist = element.querySelector(".disclosure-body > ol")!;
    const hint = element.querySelector(".disclosure-body > .field-hint")!;
    return {
      actionToSummary:
        summary.getBoundingClientRect().top -
        action.getBoundingClientRect().bottom,
      checklistToHint:
        hint.getBoundingClientRect().top -
        checklist.getBoundingClientRect().bottom,
    };
  });
  expect(
    gaps.actionToSummary,
    "The setup control clears the main action",
  ).toBeGreaterThanOrEqual(12);
  expect(
    gaps.checklistToHint,
    "The payout hint clears the checklist",
  ).toBeGreaterThanOrEqual(12);
}

async function operationsSpacing(page: Page) {
  const operations = page.locator(".seller-operations");
  await expect(operations.locator(":scope > .ops-scope-area")).toBeVisible();
  await expect(operations.locator(':scope > p[role="status"]')).toHaveCount(0);
  await settled(page);
  const gaps = await operations.evaluate((element) => {
    const readiness = element
      .querySelector(":scope > .seller-readiness")!
      .getBoundingClientRect();
    const context = element
      .querySelector(":scope > .ops-context")!
      .getBoundingClientRect();
    const notice = element
      .querySelector(":scope > .notice")!
      .getBoundingClientRect();
    const scope = element
      .querySelector(":scope > .ops-scope-area")!
      .getBoundingClientRect();
    return [
      {
        label: "Readiness and operational context",
        gap: context.top - readiness.bottom,
      },
      {
        label: "Operational context and verification notice",
        gap: notice.top - context.bottom,
      },
      {
        label: "Verification notice and order filters",
        gap: scope.top - notice.bottom,
      },
    ];
  });
  for (const { label, gap } of gaps)
    expect(
      gap,
      `${label} retain distinct section spacing`,
    ).toBeGreaterThanOrEqual(16);
}

for (const locale of ["id", "en"] as const) {
  test.describe(locale, () => {
    test.beforeEach(async ({ page, context, baseURL }) => {
      expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
      const me = await page.request.get("/api/v1/me");
      expect(
        (await me.json()).data.demo,
        "Explicit synthetic demo required",
      ).toBe(true);
      await context.addCookies([
        { name: "catera_locale", value: locale, url: baseURL! },
      ]);
    });

    for (const width of [320, 390, 768, 1440, 2560]) {
      test(`readiness keeps distinct blocks and padded controls at ${width}px`, async ({
        page,
      }, testInfo) => {
        await login(page, "owner");
        await page.setViewportSize({ width, height: 900 });
        const response = await page.request.get(`/api/v1/seller/${sellerId}`);
        expect(response.ok()).toBe(true);
        const original = (await response.json()).data as SellerOperationsState;
        const template = original.offers[0];
        expect(template).toBeTruthy();
        for (const status of ["draft", "corrections"] as const) {
          await page.route(`**/api/v1/seller/${sellerId}**`, (route) =>
            route.fulfill({
              json: {
                data: {
                  ...original,
                  caterer: {
                    ...original.caterer,
                    status,
                    description:
                      "Synthetic profile complete for spacing verification",
                    review_note:
                      status === "corrections"
                        ? "Synthetic requested correction with retained context"
                        : null,
                  },
                  offers:
                    status === "draft"
                      ? []
                      : [
                          {
                            ...template,
                            status: "draft",
                            price: null,
                            capacity: {},
                          },
                        ],
                },
              },
            }),
          );
          await page.goto("/seller");
          const readiness = page.locator(".seller-readiness");
          const disclosure = readiness.locator(".seller-readiness-checklist");
          await expect(readiness).toBeVisible();
          await expect(readiness.locator(".seller-readiness-next")).toHaveText(
            status === "draft"
              ? locale === "id"
                ? "Buat paket pertama"
                : "Create your first package"
              : locale === "id"
                ? "Periksa catatan perbaikan"
                : "Review requested changes",
          );
          await expect(
            disclosure.locator(":scope > .disclosure-body"),
          ).toBeHidden();
          await disclosure.locator(":scope > summary").focus();
          await page.keyboard.press("Enter");
          await expect(disclosure).toHaveAttribute("open", "");
          await expect(disclosure.locator(":scope > summary")).toBeFocused();
          await expect(disclosure.locator(":scope > summary")).not.toHaveCSS(
            "outline-style",
            "none",
          );
          await expect(disclosure.locator("ol li")).toHaveCount(4);
          await settled(page);
          await disclosureSpacing(disclosure);
          await readinessSpacing(readiness);
          await operationsSpacing(page);
          await noOverflow(page);
          await page.screenshot({
            path: testInfo.outputPath(`readiness-${status}.png`),
            fullPage: true,
          });
          if (width === 390) {
            await test.step(`${status} keeps its spacing with 200% text`, async () => {
              await doubleText(page);
              await disclosureSpacing(disclosure);
              await readinessSpacing(readiness);
              await operationsSpacing(page);
              await noOverflow(page);
              await page.screenshot({
                path: testInfo.outputPath(`readiness-${status}-text-200.png`),
                fullPage: true,
              });
            });
          }
          await page.keyboard.press("Space");
          await expect(disclosure).not.toHaveAttribute("open");
          await expect(
            disclosure.locator(":scope > .disclosure-body"),
          ).toBeHidden();
          await expect(disclosure.locator(":scope > summary")).toBeFocused();
          await page.unroute(`**/api/v1/seller/${sellerId}**`);
        }
      });
    }

    for (const width of [390, 1440]) {
      test(`shared disclosure spacing reaches customer seller admin and checkout at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await test.step("customer purchase details retain a gap between price and schedule", async () => {
          await login(page, "customer");
          const response = await page.request.get("/api/v1/customer");
          expect(response.ok()).toBe(true);
          const customer = (await response.json()).data;
          expect(customer.subscriptions[0]).toBeTruthy();
          await page.goto(`/subscriptions/${customer.subscriptions[0].id}`);
          const disclosure = page
            .locator(".disclosure")
            .filter({ has: page.locator(".purchase-schedule") })
            .first();
          await expect(disclosure).toBeVisible();
          await keyboardDisclosure(page, disclosure);
        });
        await test.step("checkout package disclosure preserves padded content", async () => {
          await page.goto("/checkout/20000000-0000-4000-8000-000000000001");
          const disclosure = page.locator(".checkout-package-details");
          await expect(disclosure).toBeVisible();
          await keyboardDisclosure(page, disclosure);
        });
        await test.step("seller help panel keeps the steps and explanations separate", async () => {
          await login(page, "owner");
          await page.goto("/seller/transactions");
          const disclosure = page.locator(".settlement-help");
          await expect(disclosure).toBeVisible();
          await keyboardDisclosure(page, disclosure);
        });
        await test.step("admin audit detail separates its reference and payload", async () => {
          await login(page, "platform_admin");
          const response = await page.request.get("/api/v1/admin");
          expect(response.ok()).toBe(true);
          const admin = (await response.json()).data;
          await page.route("**/api/v1/admin", (route) =>
            route.fulfill({
              json: {
                data: {
                  ...admin,
                  audit: [
                    {
                      id: "aaaaaaaa-0000-4000-8000-000000000001",
                      action: "profile.update",
                      actor_id: null,
                      created_at: "2026-10-01T00:00:00Z",
                      details: { note: "Synthetic audit spacing fixture" },
                    },
                  ],
                },
              },
            }),
          );
          await page.goto("/admin/audit");
          const disclosure = page.locator(".record-table .disclosure").first();
          await expect(disclosure).toBeVisible();
          await keyboardDisclosure(page, disclosure);
        });
      });
    }
  });
}

test("nested flow keeps its default rhythm inside a compact disclosure", async ({
  page,
  context,
  baseURL,
}) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const me = await page.request.get("/api/v1/me");
  expect((await me.json()).data.demo).toBe(true);
  await context.addCookies([
    { name: "catera_locale", value: "id", url: baseURL! },
  ]);
  await page.setViewportSize({ width: 390, height: 900 });
  await login(page, "owner");
  await page.goto("/seller/transactions");
  const disclosure = page.locator(".settlement-help");
  await expect(disclosure).toBeVisible();
  await disclosure.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");

  // Mount a new content group in an existing real disclosure. This exercises
  // composition without adding a product route or modifying stored records.
  await disclosure.evaluate((element) => {
    const body = element.querySelector(":scope > .disclosure-body")!;
    const group = document.createElement("div");
    group.className = "flow";
    group.dataset.spacingFixture = "nested";
    for (const [tag, text] of [
      ["p", "Synthetic nested group with existing spaced content"],
      ["button", "Synthetic action"],
      ["button", "Synthetic longer action with meaningful words ".repeat(8)],
      ["p", "Synthetic final explanation"],
    ]) {
      const child = document.createElement(tag);
      child.className = tag === "button" ? "button spaced" : "spaced";
      child.textContent = text;
      if (child instanceof HTMLButtonElement) child.type = "button";
      group.append(child);
    }
    body.children[0].after(group);
  });
  await settled(page);
  const measurements = await disclosure.evaluate((element) => {
    const group = element.querySelector<HTMLElement>(
      '[data-spacing-fixture="nested"]',
    )!;
    const groupBox = group.getBoundingClientRect();
    const children = [...group.children];
    const boxes = children.map((child) => child.getBoundingClientRect());
    const previous = group.previousElementSibling!.getBoundingClientRect();
    const next = group.nextElementSibling!.getBoundingClientRect();
    const short = boxes[1],
      long = boxes[2];
    return {
      compactBefore: groupBox.top - previous.bottom,
      compactAfter: next.top - groupBox.bottom,
      nestedGaps: boxes
        .slice(1)
        .map((box, index) => box.top - boxes[index].bottom),
      childMargins: children.map((child) => {
        const style = getComputedStyle(child);
        return [parseFloat(style.marginTop), parseFloat(style.marginBottom)];
      }),
      shortWidth: short.width,
      groupWidth: groupBox.width,
      longWidth: long.width,
      longRight: long.right,
      groupRight: groupBox.right,
      buttonMaxWidth: getComputedStyle(children[2]).maxWidth,
    };
  });
  expect(measurements.compactBefore).toBeCloseTo(12, 1);
  expect(measurements.compactAfter).toBeCloseTo(12, 1);
  for (const gap of measurements.nestedGaps)
    expect(
      gap,
      "A nested group establishes its own standard rhythm",
    ).toBeCloseTo(16, 1);
  for (const margins of measurements.childMargins)
    expect(
      margins,
      "Existing child margins do not accumulate with the group gap",
    ).toEqual([0, 0]);
  expect(
    measurements.shortWidth,
    "A short action retains its intrinsic width",
  ).toBeLessThan(measurements.groupWidth - 20);
  expect(measurements.buttonMaxWidth).toBe("100%");
  expect(measurements.longWidth).toBeLessThanOrEqual(measurements.groupWidth);
  expect(measurements.longRight).toBeLessThanOrEqual(measurements.groupRight);
  await disclosureSpacing(disclosure);
  await noOverflow(page);
});
