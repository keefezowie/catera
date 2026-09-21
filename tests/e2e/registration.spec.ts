import { test, expect } from "@playwright/test";
// UI contract tests: isolated server points at an unused loopback Auth endpoint.
// Auth API responses below are synthetic; these tests do not prove mail delivery.
for (const locale of ["id", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`email registration and resend ${locale} ${width}`, async ({
      page,
      context,
    }) => {
      await context.addCookies([
        {
          name: "catera_locale",
          value: locale,
          domain: "127.0.0.1",
          path: "/",
        },
      ]);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let submitted: Record<string, string> | undefined;
      await page.route("**/api/v1/auth/register", (route) => {
        submitted = route.request().postDataJSON();
        return route.fulfill({ json: { data: { sent: true } } });
      });
      await page.goto(
        "/register?next=" + encodeURIComponent("/checkout/synthetic?trial=1"),
      );
      await page
        .getByLabel(locale === "id" ? "Nama" : "Name", { exact: true })
        .fill("Synthetic Customer");
      await page
        .getByLabel("Email", { exact: true })
        .fill("synthetic@catera.test");
      const password = page.getByLabel(
        locale === "id" ? "Kata sandi baru" : "New password",
        { exact: true },
      );
      await password.fill("synthetic-password");
      await page
        .getByRole("button", {
          name: locale === "id" ? "Tampilkan kata sandi" : "Show password",
          exact: true,
        })
        .click();
      await expect(password).toHaveAttribute("type", "text");
      await page
        .getByRole("button", {
          name: locale === "id" ? "Buat akun" : "Create account",
          exact: true,
        })
        .click();
      await expect(
        page.locator(".login-form").getByRole("status"),
      ).toContainText("synthetic@catera.test");
      await expect(
        page.locator(".login-form").getByRole("status"),
      ).toBeFocused();
      expect(submitted).toMatchObject({
        name: "Synthetic Customer",
        email: "synthetic@catera.test",
        next: "/checkout/synthetic?trial=1",
      });
      await expect(
        page.getByRole("button", { name: /^(Kirim ulang|Resend) \(/ }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/registration/check-email-${locale}-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", {
          name: locale === "id" ? "Ubah email" : "Change email",
          exact: true,
        })
        .click();
      await expect(password).toHaveValue("");
      expect(errors).toEqual([]);
    });
  }
}
test("phone login does not ask returning customers for a name and preserves OTP retry", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", message => {
    if (/uncontrolled|controlled input|hydration/i.test(message.text())) warnings.push(message.text());
  });
  let sent: Record<string, unknown> | undefined;
  await page.route("**/api/v1/auth/send", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { data: {} } });
  });
  await page.route("**/api/v1/auth/verify", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "Kode ponsel", exact: true }).click();
  await page.getByLabel("Nomor WhatsApp / ponsel").fill("+6281234567890");
  await page
    .getByRole("button", { name: "Kirim kode OTP", exact: true })
    .click();
  expect(sent?.intent).toBe("login");
  await expect(page.getByLabel("Nama", { exact: true })).toHaveCount(0);
  await page.getByLabel("Kode OTP", { exact: true }).fill("123456");
  await page
    .getByRole("button", { name: "Verifikasi & masuk", exact: true })
    .click();
  await expect(page.locator(".login-form").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Kode OTP", { exact: true })).toBeVisible();
  expect(warnings).toEqual([]);
});
test("recovery request and rejected reset show actionable states", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/recover", (route) =>
    route.fulfill({ json: { data: { sent: true } } }),
  );
  await page.route("**/api/v1/auth/reset-password", (route) =>
    route.fulfill({
      status: 400,
      json: { error: { code: "RECOVERY_EXPIRED" } },
    }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("synthetic@catera.test");
  await page
    .getByRole("button", { name: "Kirim tautan pemulihan", exact: true })
    .click();
  await expect(page.locator(".login-form").getByRole("status")).toContainText(
    "Jika email tersebut terdaftar",
  );
  await page.goto("/reset-password");
  await page
    .getByLabel("Kata sandi baru", { exact: true })
    .fill("synthetic-new-password");
  await page
    .getByRole("button", { name: "Simpan kata sandi", exact: true })
    .click();
  await expect(page.locator(".login-form").getByRole("alert")).toContainText(
    "kedaluwarsa",
  );
  await expect(
    page.getByRole("link", {
      name: "Minta tautan pemulihan baru",
      exact: true,
    }),
  ).toHaveAttribute("href", "/forgot-password");
});
test("cross-origin auth mutations are rejected by the actual API", async ({
  request,
}) => {
  const response = await request.post("/api/v1/auth/register", {
    headers: { Origin: "https://evil.test" },
    data: {
      name: "Test",
      email: "synthetic@catera.test",
      password: "synthetic-password",
    },
  });
  expect(response.status()).toBe(403);
});
