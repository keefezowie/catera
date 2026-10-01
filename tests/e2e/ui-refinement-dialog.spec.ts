import { test, expect, type Page } from "@playwright/test";

async function openDirtyEditor(page: Page, locale: "id" | "en") {
  await page.goto("/seller/packages");
  const trigger = page.getByRole("button", {
    name: locale === "id" ? "Buat paket" : "Create package",
    exact: true,
  });
  await trigger.click();
  const name = page.getByLabel(
    locale === "id" ? "Nama paket" : "Package name",
    {
      exact: true,
    },
  );
  await name.fill("Synthetic dialog focus regression");
  await name.focus();
  await page.keyboard.press("Escape");
  const confirmation = page.locator(".dialog-confirmation");
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", {
      name: locale === "id" ? "Lanjut mengedit" : "Keep editing",
    }),
  ).toBeFocused();
  return { trigger, name, confirmation };
}

// Exercise real retained exits in both orders without replacing the dialog or
// its focus trap. This reproduces an editor returning focus while its child
// confirmation is still present under a slower frame/timer schedule.
async function staggerExits(page: Page, delayed: 1 | 2) {
  await page.addInitScript((delayedExit) => {
    const original = window.setTimeout;
    let exits = 0;
    window.setTimeout = ((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (
        delay === 120 &&
        document.querySelectorAll('.dialog[data-motion-state="closed"]')
          .length === 2
      ) {
        exits += 1;
        if (exits === delayedExit) delay += 200;
      }
      return original(handler, delay, ...args);
    }) as typeof window.setTimeout;
  }, delayed);
}

for (const width of [320, 1440]) {
  for (const locale of ["id", "en"] as const) {
    test.describe(`${width} ${locale}`, () => {
      test.beforeEach(async ({ page, baseURL }) => {
        await page.setViewportSize({ width, height: 900 });
        await page
          .context()
          .addCookies([
            { name: "catera_locale", value: locale, url: baseURL! },
          ]);
        expect(
          (
            await page.request.post("/api/v1/auth/demo", {
              data: { role: "owner" },
            })
          ).ok(),
        ).toBe(true);
      });

      for (const delayed of [1, 2] as const) {
        test(`nested discard restores trigger with exit ${delayed} delayed`, async ({
          page,
        }) => {
          await staggerExits(page, delayed);
          const { trigger, confirmation } = await openDirtyEditor(page, locale);
          await confirmation
            .getByRole("button", {
              name: locale === "id" ? "Buang perubahan" : "Discard changes",
            })
            .click();
          await expect(page.locator(".dialog")).toHaveCount(0);
          await expect(trigger).toBeFocused();
        });
      }

      test("nested escape returns to the retained editor field", async ({
        page,
      }) => {
        const { name, confirmation } = await openDirtyEditor(page, locale);
        await page.keyboard.press("Escape");
        await expect(confirmation).toHaveCount(0);
        await expect(name).toBeFocused();
        await expect(name).toHaveValue("Synthetic dialog focus regression");
      });

      test("pending return preserves a different chosen focus target", async ({
        page,
      }) => {
        await staggerExits(page, 2);
        const { confirmation } = await openDirtyEditor(page, locale);
        const chosen = page
          .getByRole("button", {
            name:
              locale === "id" ? "Lihat rincian paket" : "View package details",
            exact: true,
            includeHidden: true,
          })
          .first();
        // Choose another real page control at the first moment the modal stops
        // blocking it, before a pending animation-frame restoration can run.
        await chosen.evaluate((element) => {
          const observer = new MutationObserver(() => {
            if (document.querySelector(".dialog")) return;
            observer.disconnect();
            (element as HTMLElement).focus();
          });
          observer.observe(document.body, { childList: true, subtree: true });
        });
        await confirmation
          .getByRole("button", {
            name: locale === "id" ? "Buang perubahan" : "Discard changes",
          })
          .click();
        await expect(page.locator(".dialog")).toHaveCount(0);
        await expect(chosen).toBeFocused();
        await page.waitForTimeout(1100);
        await expect(chosen).toBeFocused();
      });
    });
  }
}
