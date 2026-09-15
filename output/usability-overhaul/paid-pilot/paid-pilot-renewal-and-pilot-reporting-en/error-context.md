# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: paid-pilot.spec.ts >> renewal and pilot reporting en
- Location: tests\e2e\paid-pilot.spec.ts:130:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Portions', { exact: true }).first()
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Portions', { exact: true }).first() with timeout 20000ms
  - waiting for getByText('Portions', { exact: true }).first()

```

```yaml
- link "Skip to content":
  - /url: "#main"
- text: Exploration demo · Caterers, meals, and transactions are synthetic.
- banner:
  - link "Catera — Good Food on Repeat":
    - /url: /
    - img "Catera"
  - navigation:
    - link "Explore catering":
      - /url: /#packages
    - link "My meals":
      - /url: /home
    - link "Meal calendar":
      - /url: /calendar
    - link "For caterers":
      - /url: /seller/onboarding
  - combobox "Language": EN
  - link "Notifications":
    - /url: /notifications
  - button "Open account menu"
- main:
  - link "Back to package":
    - /url: /packages/ayam-panggang
  - heading "Make room for good meals." [level=1]
  - paragraph: Clear portions and schedules, from the start.
  - text: 1. Portions & dates 2. Review package 3. Payment
  - heading "How many are eating?" [level=2]
  - paragraph: Portions stay fixed throughout the package. Every portion gets the same menu.
  - strong: Portions per day
  - button "Decrease portions" [disabled]
  - strong: "1"
  - button "Increase portions"
  - text: Start date
  - button "Start date": 23 September 2026
  - text: Delivery address
  - combobox "Delivery address": Rumah — Jl. Contoh No. 12, Kebayoran Baru, Jakarta Selatan
  - link "Add an address":
    - /url: /addresses?next=%2Fcheckout%2F20000000-0000-4000-8000-000000000001%3FrenewedFrom%3D245275a5-b24b-4901-a88a-9d3567158138%26portions%3D1%26startDate%3D2026-09-23%26addressId%3D30000000-0000-4000-8000-000000000001
  - group: Have a promo code?
  - button "Review schedule & price"
  - complementary:
    - img "Ayam Panggang Harian"
    - text: Dapur Senja
    - heading "Ayam Panggang Harian" [level=2]
    - strong: Rice box
    - paragraph: 620 kcal · 32 g protein · 78 g carbs · 20 g fat Per meal portion · caterer estimate
    - paragraph: Lunch · Menu not yet set
    - paragraph: 1 Rice · 1 Main dish · 1 Vegetable · 1 Pelengkap
    - list
    - paragraph: 5 days · Lunch · 1 portions
    - term: Package subtotal
    - definition: Rp 175.000
    - term: Delivery
    - definition: Included
    - term: Catera service fee
    - definition: Calculated on review
    - strong: Total
    - strong: —
    - paragraph: No automatic renewal. Your purchase is processed through Catera.
- contentinfo:
  - link "Catera — Good Food on Repeat":
    - /url: /
    - img "Catera"
  - paragraph: Good meals, for better everyday living.
  - link "Explore catering":
    - /url: /#packages
  - link "Become a partner":
    - /url: /seller/onboarding
  - link "Catera identity":
    - /url: /brand
  - paragraph: Good Food on Repeat.
- status
- alert
```

# Test source

```ts
  59  |         .getByRole("button", {
  60  |           name: t("Periksa tabel", "Review table"),
  61  |           exact: true,
  62  |         })
  63  |         .click();
  64  |       await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  65  |       await expect(
  66  |         dialog.getByText(
  67  |           t(
  68  |             "Pelanggan baru, akun belum diperlukan",
  69  |             "New customer; no account required",
  70  |           ),
  71  |           { exact: true },
  72  |         ),
  73  |       ).toBeVisible();
  74  |       await dialog
  75  |         .getByRole("button", {
  76  |           name: t("Konfirmasi impor", "Confirm import"),
  77  |           exact: true,
  78  |         })
  79  |         .click();
  80  |       await expect(dialog).not.toBeVisible();
  81  |       const card = page
  82  |         .locator("article.panel")
  83  |         .filter({ has: page.getByRole("heading", { name, exact: true }) });
  84  |       await expect(card).toBeVisible();
  85  |       await expect(
  86  |         card.getByText(t("Dikelola katerer", "Seller managed"), {
  87  |           exact: true,
  88  |         }),
  89  |       ).toBeVisible();
  90  |       await expect(
  91  |         card.getByText(/3 (hari pengantaran tersisa|delivery days remaining)/),
  92  |       ).toBeVisible();
  93  |       await card
  94  |         .getByRole("button", {
  95  |           name: t("Undang pelanggan", "Invite customer"),
  96  |           exact: true,
  97  |         })
  98  |         .click();
  99  |       await expect(
  100 |         dialog.getByRole("link", { name: t("Buka WhatsApp", "Open WhatsApp") }),
  101 |       ).toHaveAttribute("href", /^https:\/\/wa.me\//);
  102 |       await expect(
  103 |         dialog.getByText(
  104 |           t(
  105 |             "Anda memilih kapan mengirim. Catera tidak dapat memastikan pesan WhatsApp terkirim atau dibaca.",
  106 |             "You choose when to send. Catera cannot confirm WhatsApp delivery or reading.",
  107 |           ),
  108 |           { exact: true },
  109 |         ),
  110 |       ).toBeVisible();
  111 |       await page.keyboard.press("Escape");
  112 |       await expect(dialog).not.toBeVisible();
  113 |       expect(
  114 |         await page.evaluate(
  115 |           () => document.documentElement.scrollWidth <= innerWidth,
  116 |         ),
  117 |       ).toBe(true);
  118 |       expect(
  119 |         (await new AxeBuilder({ page }).include(".pilot-workspace").analyze())
  120 |           .violations,
  121 |       ).toEqual([]);
  122 |       await mkdir("output/playwright/paid-pilot", { recursive: true });
  123 |       await page.screenshot({
  124 |         path: `output/playwright/paid-pilot/customers-${locale}-${width}.png`,
  125 |         fullPage: true,
  126 |       });
  127 |       expect(errors).toEqual([]);
  128 |     });
  129 | for (const locale of ["id", "en"])
  130 |   test(`renewal and pilot reporting ${locale}`, async ({ page, baseURL }) => {
  131 |     const t = (id: string, en: string) => (locale === "id" ? id : en);
  132 |     await page
  133 |       .context()
  134 |       .addCookies([{ name: "catera_locale", value: locale, url: baseURL! }]);
  135 |     await page.request.post("/api/v1/auth/demo", {
  136 |       data: { role: "customer" },
  137 |     });
  138 |     const response = await (await page.request.get("/api/v1/customer")).json();
  139 |     const data = response.data || response;
  140 |     await page.goto("/renew/" + data.subscriptions[0].id);
  141 |     await page
  142 |       .getByRole("button", {
  143 |         name: t(
  144 |           "Gunakan alamat & tinjau pembelian",
  145 |           "Use address & review purchase",
  146 |         ),
  147 |         exact: true,
  148 |       })
  149 |       .click();
  150 |     const link = page.getByRole("link", {
  151 |       name: t("Lanjutkan ke pembayaran", "Continue to checkout"),
  152 |       exact: true,
  153 |     });
  154 |     await expect(link).toHaveAttribute("href", /renewedFrom=/);
  155 |     await link.click();
  156 |     await expect(page).toHaveURL(/addressId=/);
  157 |     await expect(
  158 |       page.getByText(t("Porsi", "Portions"), { exact: true }).first(),
> 159 |     ).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
  160 |     await page.request.post("/api/v1/auth/demo", {
  161 |       data: { role: "platform_admin" },
  162 |     });
  163 |     await page.goto("/admin/pilot");
  164 |     await expect(
  165 |       page.getByRole("heading", {
  166 |         name: t("Hasil pilot", "Pilot results"),
  167 |         exact: true,
  168 |       }),
  169 |     ).toBeVisible();
  170 |     await expect(
  171 |       page.getByText(
  172 |         t(
  173 |           "Konfigurasi sintetis. Bukan persetujuan untuk menerima pembayaran nyata.",
  174 |           "Synthetic configuration. This is not approval to accept real payments.",
  175 |         ),
  176 |         { exact: true },
  177 |       ),
  178 |     ).toBeVisible();
  179 |     await expect(
  180 |       page.getByText(t("Belum diketahui", "Unknown"), { exact: true }).first(),
  181 |     ).toBeVisible();
  182 |     expect(
  183 |       (await new AxeBuilder({ page }).include(".pilot-workspace").analyze())
  184 |         .violations,
  185 |     ).toEqual([]);
  186 |   });
  187 | 
```