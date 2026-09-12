# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: seller-operational-controls.spec.ts >> UI sweep: focus rings, support count, composition controls and centered previews
- Location: tests\e2e\seller-operational-controls.spec.ts:104:1

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1
Received:    4
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
            - heading [level=2]: Paket komposisi 1789209091763
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209117882
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209268886
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209301182
            - paragraph: 2 hari · Makan siang · Fleksibel
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
            - generic: Tayang
            - heading [level=2]: Demo · Ayam panggang ala carte
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Demo · Ayam dan tempe ala carte
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Demo · Nasi box lengkap
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis isi 1789208791501
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Komposisi kustom 1789208800492
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic: Foto belum ditambahkan
          - generic:
            - generic: Draf
            - heading [level=2]: Draf tanpa nama
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - button: Kelola paket
        - article:
          - generic:
            - generic: Draf
            - heading [level=2]: Kapasitas bersama
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - button: Kelola paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789208842071
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789208904539
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209029162
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209370404
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209377376
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209384340
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Paket komposisi 1789209394397
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Sintetis kalender 1789209397191
            - paragraph: 2 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic: Foto belum ditambahkan
          - generic:
            - generic: Draf
            - heading [level=2]: Draf kemudahan 1789209444659
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - button: Kelola paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Impor mudah 1789209449355
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Legacy isi 1789208796549
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic: Foto belum ditambahkan
          - generic:
            - generic: Draf
            - heading [level=2]: Draf kemudahan 1789209674028
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - button: Kelola paket
        - article:
          - generic:
            - generic: Tayang
            - heading [level=2]: Impor mudah 1789209676965
            - paragraph: 5 hari · Makan siang · Fleksibel
            - strong: Rp 35.000 / porsi / hari
          - generic:
            - paragraph: Tangguhkan penjualan sebelum mengarsipkan paket. Pelanggan yang sudah membeli tetap dilayani.
            - generic:
              - button: Tangguhkan paket
        - article:
          - generic:
            - generic: Draf
            - heading [level=2]: Sintetis UI sweep 1789209869257
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
          - heading "Periksa" [active] [level=3] [ref=f1e40]
          - heading "Pratinjau pelanggan" [level=3] [ref=f1e41]
          - paragraph [ref=f1e42]: Tampilan menggunakan isian Anda saat ini. Tindakan pembelian dinonaktifkan dalam pratinjau.
          - generic [ref=f1e43]:
            - button "Kartu penelusuran" [ref=f1e44] [cursor=pointer]
            - button "Detail paket" [ref=f1e45] [cursor=pointer]
          - article [ref=f1e47]:
            - generic [ref=f1e48]:
              - link [disabled] [ref=f1e49]:
                - /url: /packages/ui-sweep-0ce2e752-52e2-4b97-868c-a118d5a84b2e
                - img "Sintetis UI sweep 1789209869257" [ref=f1e50]
              - generic [ref=f1e51]: Bisa coba dulu
            - generic [ref=f1e52]:
              - generic [ref=f1e53]:
                - generic [ref=f1e54]:
                  - strong [ref=f1e55]: Dapur Senja
                  - generic [ref=f1e56]: Baru
                - link [disabled] [ref=f1e57]:
                  - /url: /packages/ui-sweep-0ce2e752-52e2-4b97-868c-a118d5a84b2e
                  - heading "Sintetis UI sweep 1789209869257" [level=3] [ref=f1e58]
              - generic [ref=f1e59]:
                - strong [ref=f1e60]:
                  - text: "5"
                  - generic [ref=f1e61]: hari
                - generic [ref=f1e62]:
                  - generic [ref=f1e63]: Makan siang
                  - generic [ref=f1e70]: Jadwal fleksibel
              - generic [ref=f1e73]:
                - generic [ref=f1e74]: Menu belum ditentukan
                - paragraph [ref=f1e76]: 1 Nasi · 1 Lauk · 1 Sayur · 1 Pelengkap
                - link "Lihat isi paket" [disabled] [ref=f1e77]:
                  - /url: /packages/ui-sweep-0ce2e752-52e2-4b97-868c-a118d5a84b2e#isi-paket-lunch
                - generic [ref=f1e80]:
                  - generic [ref=f1e81]:
                    - generic [ref=f1e82]:
                      - term [ref=f1e83]: Energi
                      - definition [ref=f1e86]: 620 kkal
                    - generic [ref=f1e87]:
                      - term [ref=f1e88]: Protein
                      - definition [ref=f1e95]: 32 g
                    - generic [ref=f1e96]:
                      - term [ref=f1e97]: Karbo
                      - definition [ref=f1e107]: 78 g
                    - generic [ref=f1e108]:
                      - term [ref=f1e109]: Lemak
                      - definition [ref=f1e112]: 20 g
                  - paragraph [ref=f1e113]: Estimasi katerer · per porsi makan
              - generic [ref=f1e114]:
                - generic [ref=f1e116]:
                  - strong [ref=f1e117]: Rp 35.000
                  - generic [ref=f1e118]: / porsi / hari
                - paragraph [ref=f1e119]: Pengantaran termasuk
                - generic [ref=f1e125]:
                  - 'button "Bandingkan: Sintetis UI sweep 1789209869257" [disabled]': Bandingkan
                  - link "Lihat paket" [disabled] [ref=f1e126]:
                    - /url: /packages/ui-sweep-0ce2e752-52e2-4b97-868c-a118d5a84b2e
          - generic [ref=f1e129]:
            - generic [ref=f1e130]: Status penawaran
            - combobox "Status penawaran" [ref=f1e131] [cursor=pointer]:
              - generic: Simpan draf
            - combobox [aria-hidden] [ref=f1e134]
        - generic [ref=f1e135]:
          - generic [ref=f1e136]:
            - button "Kembali" [ref=f1e137] [cursor=pointer]
            - button "Simpan paket" [ref=f1e140] [cursor=pointer]
          - button "Simpan draf" [ref=f1e145] [cursor=pointer]
```

# Test source

```ts
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
  200 |   await page.getByRole("button", { name: /5\. Periksa/ }).click();
  201 |   const preview = page.locator(".listing-preview.card");
  202 |   await expect(preview).toBeVisible();
  203 |   for (const width of [1440, 768, 390]) {
  204 |     await page.setViewportSize({ width, height: 1000 });
  205 |     const delta = await preview.evaluate((el) => {
  206 |       const a = el.getBoundingClientRect(),
  207 |         p = el.parentElement!.getBoundingClientRect();
  208 |       return Math.abs(a.x + a.width / 2 - p.x - p.width / 2);
  209 |     });
> 210 |     expect(delta).toBeLessThanOrEqual(1);
      |                   ^ Error: expect(received).toBeLessThanOrEqual(expected)
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