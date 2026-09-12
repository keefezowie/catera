# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: seller-operational-controls.spec.ts >> UI sweep: focus rings, support count, composition controls and centered previews
- Location: tests\e2e\seller-operational-controls.spec.ts:104:1

# Error details

```
Test timeout of 40000ms exceeded.
```

```
Error: locator.click: Test timeout of 40000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /6\. Tinjau/ })

```

# Page snapshot

```yaml
- generic:
  - generic [aria-hidden]:
    - link:
      - /url: "#main"
      - text: Lewati ke konten
    - generic: Demo eksplorasi · Katerer, menu, dan transaksi menggunakan data sintetis.
    - complementary:
      - link:
        - /url: /
      - generic:
        - generic:
          - strong: Ruang katerer
          - text: Arini — Dapur Senja
      - navigation:
        - paragraph: Kegiatan harian
        - link:
          - /url: /seller
          - text: Hari ini
        - link:
          - /url: /seller/schedule
          - text: Jadwal
        - link:
          - /url: /seller/packages
          - text: Paket
        - link:
          - /url: /seller/menus
          - text: Menu
        - paragraph: Kelola usaha
        - link:
          - /url: /seller/customers
          - text: Pelanggan
        - link:
          - /url: /seller/support
          - text: Pesan & bantuan
        - link:
          - /url: /seller/transactions
          - text: Transaksi
        - link:
          - /url: /seller/settings
          - text: Pengaturan
      - generic:
        - strong: Good food. Good days.
        - link:
          - /url: /
          - text: Lihat marketplace
    - banner:
      - generic: Makanan baik dimulai dari dapur yang tertata.
      - combobox:
        - generic: ID
      - link:
        - /url: /notifications
      - generic:
        - button:
          - generic [aria-hidden]: A
    - main:
      - generic:
        - generic:
          - heading [level=1]: Paket dari dapurmu.
          - paragraph: Dapur Senja
      - generic:
        - paragraph: Paket yang sudah tayang tidak dapat diubah. Buat paket baru untuk penawaran berbeda.
        - button: Buat paket
      - generic:
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Ayam Panggang Harian
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Rantang Nusantara
            - paragraph: 10 hari · Siang + malam · Fleksibel
            - strong: Rp 65.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Ayam Sambal Rumahan
            - paragraph: 5 hari · Makan siang · Tetap
            - strong: Rp 32.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Draf
            - heading [level=2]: Sintetis UI sweep 1789209688299
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - button: Kelola paket
  - status
  - alert
  - dialog [ref=f1e2]:
    - heading "Kelola paket" [level=2] [ref=f1e3]
    - paragraph [ref=f1e4]: Siapkan paket selangkah demi selangkah. Draf dapat dilanjutkan nanti.
    - button "Tutup" [ref=f1e5] [cursor=pointer]
    - generic [ref=f1e9]:
      - generic "Langkah paket" [ref=f1e10]:
        - button "1. Paket" [ref=f1e11] [cursor=pointer]
        - button "2. Isi" [ref=f1e17] [cursor=pointer]
        - button "3. Harga" [ref=f1e23] [cursor=pointer]
        - button "4. Jadwal" [ref=f1e28] [cursor=pointer]
        - button "5. Periksa" [ref=f1e32] [cursor=pointer]
      - generic [ref=f1e38]:
        - generic [ref=f1e39]:
          - heading "Isi" [level=3] [ref=f1e40]
          - generic [ref=f1e42]:
            - generic [ref=f1e43]:
              - 'button "Lihat foto: Foto paket" [ref=f1e44] [cursor=pointer]'
              - generic [ref=f1e54]:
                - generic [ref=f1e55]: Foto paket
                - generic [ref=f1e56]:
                  - button "Foto paket" [ref=f1e57] [cursor=pointer]
                  - generic [aria-hidden] [ref=f1e58]: Ganti foto
                - generic [ref=f1e62]: PNG, JPG atau WebP · maksimal 8 MB
            - button "Hapus foto" [ref=f1e64] [cursor=pointer]
          - button "Gunakan foto sintetis demo" [ref=f1e68] [cursor=pointer]
          - generic [ref=f1e69]:
            - generic [ref=f1e70]: Label pencarian (opsional)
            - generic [ref=f1e75]:
              - generic [ref=f1e76]:
                - text: Rumahan
                - button "Hapus label Rumahan" [ref=f1e77] [cursor=pointer]
              - generic [ref=f1e81]:
                - text: Makan siang
                - button "Hapus label Makan siang" [ref=f1e82] [cursor=pointer]
            - generic [ref=f1e86]:
              - textbox "Label pencarian (opsional)" [ref=f1e87]:
                - /placeholder: "Contoh: Rumahan"
              - button "Tambah" [disabled]
            - generic [ref=f1e88]: Membantu pelanggan menemukan paket. Isi hidangan diatur di bawah.
          - group [ref=f1e89]:
            - generic "Informasi gizi (opsional)" [ref=f1e90] [cursor=pointer]
            - group "Informasi gizi (opsional)" [ref=f1e94]:
              - paragraph [ref=f1e96]: Isi satu nilai untuk angka tetap, atau tambahkan nilai maksimum untuk rentang.
              - generic [ref=f1e97]:
                - generic [ref=f1e98]:
                  - generic [ref=f1e99]:
                    - strong [ref=f1e102]: Kalori
                    - generic [ref=f1e103]: kkal
                  - generic [ref=f1e104]:
                    - generic [ref=f1e105]:
                      - generic [ref=f1e106]: Nilai tetap / min.
                      - spinbutton "Kalori · nilai tetap atau minimum (kkal)" [ref=f1e107]: "620"
                    - generic [aria-hidden] [ref=f1e108]: –
                    - generic [ref=f1e109]:
                      - generic [ref=f1e110]: Maks. (opsional)
                      - spinbutton "Kalori · nilai maksimum opsional (kkal)" [ref=f1e111]
                - generic [ref=f1e112]:
                  - generic [ref=f1e113]:
                    - strong [ref=f1e120]: Protein
                    - generic [ref=f1e121]: g
                  - generic [ref=f1e122]:
                    - generic [ref=f1e123]:
                      - generic [ref=f1e124]: Nilai tetap / min.
                      - spinbutton "Protein · nilai tetap atau minimum (g)" [ref=f1e125]: "32"
                    - generic [aria-hidden] [ref=f1e126]: –
                    - generic [ref=f1e127]:
                      - generic [ref=f1e128]: Maks. (opsional)
                      - spinbutton "Protein · nilai maksimum opsional (g)" [ref=f1e129]
                - generic [ref=f1e130]:
                  - generic [ref=f1e131]:
                    - strong [ref=f1e141]: Karbohidrat
                    - generic [ref=f1e142]: g
                  - generic [ref=f1e143]:
                    - generic [ref=f1e144]:
                      - generic [ref=f1e145]: Nilai tetap / min.
                      - spinbutton "Karbohidrat · nilai tetap atau minimum (g)" [ref=f1e146]: "78"
                    - generic [aria-hidden] [ref=f1e147]: –
                    - generic [ref=f1e148]:
                      - generic [ref=f1e149]: Maks. (opsional)
                      - spinbutton "Karbohidrat · nilai maksimum opsional (g)" [ref=f1e150]
                - generic [ref=f1e151]:
                  - generic [ref=f1e152]:
                    - strong [ref=f1e155]: Lemak
                    - generic [ref=f1e156]: g
                  - generic [ref=f1e157]:
                    - generic [ref=f1e158]:
                      - generic [ref=f1e159]: Nilai tetap / min.
                      - spinbutton "Lemak · nilai tetap atau minimum (g)" [ref=f1e160]: "20"
                    - generic [aria-hidden] [ref=f1e161]: –
                    - generic [ref=f1e162]:
                      - generic [ref=f1e163]: Maks. (opsional)
                      - spinbutton "Lemak · nilai maksimum opsional (g)" [ref=f1e164]
              - paragraph [ref=f1e165]: Estimasi katerer per porsi makan. Catera tidak menghitung atau memverifikasi nilai ini.
          - generic [ref=f1e166]:
            - heading "Makan siang" [level=3] [ref=f1e167]
            - paragraph [ref=f1e168]: Tentukan isi per porsi. Pilih hidangannya nanti di kalender Menu.
            - generic [ref=f1e169]:
              - generic [ref=f1e170]:
                - generic [ref=f1e171]: Kategori
                - combobox "Kategori" [ref=f1e172] [cursor=pointer]:
                  - generic: Nasi
                - combobox [aria-hidden] [ref=f1e175]
              - generic [ref=f1e176]:
                - generic [ref=f1e177]: Jumlah Nasi
                - spinbutton "Jumlah Nasi" [ref=f1e178]: "1"
              - button "Hapus Nasi" [ref=f1e179] [cursor=pointer]
            - generic [ref=f1e183]:
              - generic [ref=f1e184]:
                - generic [ref=f1e185]: Kategori
                - combobox "Kategori" [ref=f1e186] [cursor=pointer]:
                  - generic: Lauk
                - combobox [aria-hidden] [ref=f1e189]
              - generic [ref=f1e190]:
                - generic [ref=f1e191]: Jumlah Lauk
                - spinbutton "Jumlah Lauk" [ref=f1e192]: "1"
              - button "Hapus Lauk" [ref=f1e193] [cursor=pointer]
            - generic [ref=f1e197]:
              - generic [ref=f1e198]:
                - generic [ref=f1e199]: Kategori
                - combobox "Kategori" [ref=f1e200] [cursor=pointer]:
                  - generic: Sayur
                - combobox [aria-hidden] [ref=f1e203]
              - generic [ref=f1e204]:
                - generic [ref=f1e205]: Jumlah Sayur
                - spinbutton "Jumlah Sayur" [ref=f1e206]: "1"
              - button "Hapus Sayur" [ref=f1e207] [cursor=pointer]
            - generic [ref=f1e211]:
              - generic [ref=f1e212]:
                - generic [ref=f1e213]: Kategori
                - combobox "Kategori" [ref=f1e214] [cursor=pointer]:
                  - generic: Pelengkap
                - combobox [aria-hidden] [ref=f1e217]
              - generic [ref=f1e218]:
                - generic [ref=f1e219]: Jumlah Pelengkap
                - spinbutton "Jumlah Pelengkap" [ref=f1e220]: "1"
              - button "Hapus Pelengkap" [ref=f1e221] [cursor=pointer]
            - generic [ref=f1e225]:
              - generic [ref=f1e226]: Tambah kategori ke paket
              - combobox "Tambah kategori ke paket" [ref=f1e227] [cursor=pointer]:
                - generic: Pilih kategori
              - combobox [aria-hidden] [ref=f1e230]
            - button "Kategori baru" [active] [ref=f1e232] [cursor=pointer]
          - heading "Akan dilihat pelanggan" [level=3] [ref=f1e234]
          - generic [ref=f1e235]:
            - strong [ref=f1e236]: Nasi box
            - paragraph [ref=f1e237]:
              - text: 620 kkal · 32 g protein · 78 g karbohidrat · 20 g lemak
              - generic [ref=f1e238]: Per porsi makan · estimasi katerer
            - generic [ref=f1e239]:
              - paragraph [ref=f1e240]: Makan siang · Menu belum ditentukan
              - paragraph [ref=f1e241]: 1 Nasi · 1 Lauk · 1 Sayur · 1 Pelengkap
              - list
        - generic [ref=f1e242]:
          - generic [ref=f1e243]:
            - button "Kembali" [ref=f1e244] [cursor=pointer]
            - button "Lanjutkan" [ref=f1e247] [cursor=pointer]
          - button "Simpan draf" [ref=f1e250] [cursor=pointer]
```

# Test source

```ts
  100 |   await expect(cutoff).toHaveText("22:30");
  101 |   await expect(page.locator('input[name="cutoff"]')).toHaveValue("22:30");
  102 | });
  103 | 
  104 | test("UI sweep: focus rings, support count, composition controls and centered previews", async ({
  105 |   page,
  106 | }) => {
  107 |   await mkdir("output/ui-sweep", { recursive: true });
  108 |   await page.request.post("/api/v1/auth/demo", { data: { role: "customer" } });
  109 |   const customer = (await (await page.request.get("/api/v1/customer")).json())
  110 |     .data;
  111 |   const support = await page.request.post("/api/v1/commands", {
  112 |     data: {
  113 |       action: "support.create",
  114 |       requestId: crypto.randomUUID(),
  115 |       payload: {
  116 |         subscriptionId: customer.subscriptions[0].id,
  117 |         subject: "Synthetic UI sweep support count",
  118 |         description:
  119 |           "Synthetic support case for browser verification of the open-case badge.",
  120 |       },
  121 |     },
  122 |   });
  123 |   expect(support.ok(), await support.text()).toBe(true);
  124 |   await login(page);
  125 |   const actor = (await (await page.request.get("/api/v1/me")).json()).data
  126 |     .actor;
  127 |   const catalog = (
  128 |     await (await page.request.get("/api/v1/catalog?limit=100")).json()
  129 |   ).data.items;
  130 |   const base = catalog.find(
  131 |     (offer: { catererId: string }) => offer.catererId === actor.catererId,
  132 |   );
  133 |   const name = "Sintetis UI sweep " + Date.now();
  134 |   const draft = await page.request.post("/api/v1/commands", {
  135 |     data: {
  136 |       action: "package.save",
  137 |       requestId: crypto.randomUUID(),
  138 |       payload: {
  139 |         catererId: actor.catererId,
  140 |         slug: "ui-sweep-" + crypto.randomUUID(),
  141 |         offer: { ...base, name, status: "draft" },
  142 |       },
  143 |     },
  144 |   });
  145 |   expect(draft.ok(), await draft.text()).toBe(true);
  146 |   await page.goto("/seller");
  147 |   const badge = page.locator(".ops-support-link .ops-count-badge");
  148 |   await expect(badge).toHaveText(/^[1-9]\d*$/);
  149 |   await expect(badge).toHaveCSS("background-color", "rgb(163, 48, 36)");
  150 |   await page.screenshot({
  151 |     path: "output/ui-sweep/support-badge.png",
  152 |     fullPage: true,
  153 |   });
  154 |   await page.goto("/seller/menus");
  155 |   const library = page.locator(".menu-library-desktop");
  156 |   await library.getByRole("button", { name: "Tambah", exact: true }).click();
  157 |   const input = library.getByRole("textbox", {
  158 |     name: "Nama hidangan",
  159 |     exact: true,
  160 |   });
  161 |   await input.focus();
  162 |   const clearance = await input.evaluate((el) => {
  163 |     const box = el.getBoundingClientRect(),
  164 |       scroll = el.closest("aside")!.getBoundingClientRect();
  165 |     const style = getComputedStyle(el),
  166 |       ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
  167 |     return {
  168 |       left: box.left - scroll.left,
  169 |       right: scroll.right - box.right,
  170 |       ring,
  171 |     };
  172 |   });
  173 |   expect(clearance.left).toBeGreaterThanOrEqual(clearance.ring);
  174 |   expect(clearance.right).toBeGreaterThanOrEqual(clearance.ring);
  175 |   await library.screenshot({ path: "output/ui-sweep/dish-focus.png" });
  176 |   // Keep Menu's loaded styles in the page while navigating into the package editor.
  177 |   await page
  178 |     .locator(".ops-sidebar")
  179 |     .getByRole("link", { name: "Paket", exact: true })
  180 |     .click();
  181 |   await page
  182 |     .locator(".panel")
  183 |     .filter({ has: page.getByRole("heading", { name, exact: true }) })
  184 |     .getByRole("button", { name: "Kelola paket", exact: true })
  185 |     .click();
  186 |   await page.getByRole("button", { name: /2\. Isi/ }).click();
  187 |   const row = page.locator(".composition-row").first();
  188 |   const count = row.getByRole("spinbutton");
  189 |   await count.fill("0");
  190 |   await count.press("Tab");
  191 |   await expect(count).toHaveValue("1");
  192 |   const category = page
  193 |     .getByRole("button", { name: "Kategori baru", exact: true })
  194 |     .first();
  195 |   await category.click();
  196 |   await expect(category).toHaveAttribute("aria-expanded", "true");
  197 |   await expect(category.locator("svg")).toHaveClass(/lucide-minus/);
  198 |   await category.click();
  199 |   await expect(category).toHaveAttribute("aria-expanded", "false");
> 200 |   await page.getByRole("button", { name: /6\. Tinjau/ }).click();
      |                                                          ^ Error: locator.click: Test timeout of 40000ms exceeded.
  201 |   const preview = page.locator(".listing-preview.card");
  202 |   await expect(preview).toBeVisible();
  203 |   for (const width of [1440, 768, 390]) {
  204 |     await page.setViewportSize({ width, height: 1000 });
  205 |     const delta = await preview.evaluate((el) => {
  206 |       const a = el.getBoundingClientRect(),
  207 |         p = el.parentElement!.getBoundingClientRect();
  208 |       return Math.abs(a.x + a.width / 2 - p.x - p.width / 2);
  209 |     });
  210 |     expect(delta).toBeLessThanOrEqual(1);
  211 |     expect(
  212 |       await page
  213 |         .getByRole("dialog")
  214 |         .evaluate((el) => el.scrollWidth <= el.clientWidth),
  215 |     ).toBe(true);
  216 |     await preview.screenshot({ path: `output/ui-sweep/preview-${width}.png` });
  217 |   }
  218 | });
  219 | 
```