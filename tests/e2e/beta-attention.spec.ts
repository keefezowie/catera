import { test, expect } from "@playwright/test";
test("fallback follow-up records seller action and disappears only after server confirmation", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "catera_locale", value: "en", url: baseURL! }]);
  await page.request.post("/api/v1/auth/demo", { data: { role: "owner" } });
  const id = "d1000000-0000-4000-8000-000000000001";
  let done = false,
    attempts = 0;
  await page.route("**/api/v1/seller-attention/**", (route) =>
    route.fulfill({
      json: {
        data: {
          timezone: "Asia/Makassar",
          total: done ? 0 : 1,
          nextCursor: null,
          items: done
            ? []
            : [
                {
                  id: `choice-${id}-dinner`,
                  kind: "choice_fallback",
                  priority: 2,
                  at_time: "2026-09-17T08:00:00Z",
                  context: "2026-09-18 · dinner · Synthetic package",
                  href: "/seller/schedule?date=2026-09-18",
                  destination: "/seller/schedule?date=2026-09-18&meal=dinner",
                  serviceDate: "2026-09-18",
                  meal: "dinner",
                  packageName: "Synthetic package",
                  deliveryId: id,
                },
              ],
        },
      },
    }),
  );
  await page.route("**/api/v1/commands", async (route) => {
    const input = route.request().postDataJSON();
    if (input.action !== "attention.choiceHandled") return route.continue();
    expect(input.payload).toEqual({
      deliveryId: id,
      meal: "dinner",
      date: "2026-09-18",
      body: "Synthetic dishes selected and communicated",
    });
    if (attempts++ === 0)
      return route.fulfill({
        status: 409,
        json: { error: { code: "CONFLICT" } },
      });
    done = true;
    return route.fulfill({ json: { data: { id } } });
  });
  await page.goto("/seller");
  const attention = page.getByRole("region", { name: "Needs attention" });
  await expect(attention).toContainText("Asia/Makassar");
  await attention
    .getByRole("button", { name: "Dishes planned & customer informed" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Follow-up note" })
    .fill("Synthetic dishes selected and communicated");
  await dialog.getByRole("button", { name: "Save follow-up" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveValue(
    "Synthetic dishes selected and communicated",
  );
  await dialog.getByRole("button", { name: "Save follow-up" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(attention).toContainText(
    "No exceptions require action in this scope.",
  );
});
