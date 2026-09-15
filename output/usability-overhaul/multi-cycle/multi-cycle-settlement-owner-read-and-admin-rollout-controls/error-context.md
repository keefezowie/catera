# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: multi-cycle.spec.ts >> settlement owner read and admin rollout controls
- Location: tests\e2e\multi-cycle.spec.ts:42:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('spinbutton', { name: 'Minimum payout (IDR)' })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('spinbutton', { name: 'Minimum payout (IDR)' }) with timeout 20000ms
  - waiting for getByRole('spinbutton', { name: 'Minimum payout (IDR)' })

```

```yaml
- link "Skip to content":
  - /url: "#main"
- text: Exploration demo · Caterers, meals, and transactions are synthetic.
- complementary:
  - link "Catera — Good Food on Repeat":
    - /url: /
    - img "Catera"
  - strong: Catera Admin
  - text: Tim Catera
  - navigation:
    - link "Caterers":
      - /url: /admin/sellers
    - link "Transactions":
      - /url: /admin/transactions
    - link "Support & refunds":
      - /url: /admin/support
    - link "Payouts":
      - /url: /admin/payouts
    - link "Earnings & schedule":
      - /url: /admin/settlement
    - link "Promotions":
      - /url: /admin/promotions
    - link "Review moderation":
      - /url: /admin/reviews
    - link "Audit trail":
      - /url: /admin/audit
  - strong: Good food. Good days.
  - link "View marketplace":
    - /url: /
- banner:
  - text: Marketplace & trust
  - combobox "Language": EN
  - link "Notifications":
    - /url: /notifications
  - button "Open account menu"
- main:
  - heading "Delivery-earned settlement" [level=1]
  - text: Caterer
  - combobox "Caterer": Dapur Senja
  - paragraph: Every Monday, 09:00 WIB. Each policy is saved as a new version.
  - checkbox "Enable payouts"
  - text: Enable payouts
  - checkbox "Synthetic testing" [checked]
  - text: Synthetic testing Reason
  - textbox "Reason"
  - button "Save payout policy"
  - heading "Earnings & payouts" [level=2]
  - paragraph: Earnings are credited after the complete delivery day. Lunch + dinner packages require both meals to be delivered.
  - term: Future deliveries
  - definition: Rp 14.683.200
  - term: Available for payout
  - definition: Rp 0
  - term: Held for review
  - definition: Rp 0
  - term: Payout in progress
  - definition: Rp 0
  - term: Paid to bank
  - definition: Rp 0
  - term: Recovery due
  - definition: Rp 0
  - term: Next scheduled payout
  - definition: 21/09/2026, 09:00:00 WIB
  - paragraph: Every Monday at 09:00 WIB, once payout configuration is approved. This balance cannot be spent on purchases.
  - paragraph: Automatic payouts are not enabled.
  - heading "Payout history" [level=3]
  - paragraph: No payouts yet.
  - group: Recent earnings entries
  - heading "Rollout controls" [level=2]
  - checkbox "Multi-cycle purchases"
  - text: Multi-cycle purchases
  - checkbox "Automatic payout dispatch"
  - text: Automatic payout dispatch Reason
  - textbox "Reason"
  - button "Save controls"
- status
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import { addDays, localDay } from '@catera/domain';
  4  | import { mkdir } from 'node:fs/promises';
  5  | const cid='10000000-0000-4000-8000-000000000001';
  6  | for (const locale of ['id','en']) for (const width of [390,1440]) test(`multi-cycle purchase and early renewal ${locale} ${width}`, async({page,baseURL})=>{
  7  |  const t=(id:string,en:string)=>locale==='id'?id:en;const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  8  |  await page.context().addCookies([{name:'catera_locale',value:locale,url:baseURL!}]);await page.setViewportSize({width,height:900});
  9  |  const command=async(action:string,payload:unknown)=>{const response=await page.request.post('/api/v1/commands',{data:{action,payload,requestId:crypto.randomUUID()}});const body=await response.json();expect(response.ok(),JSON.stringify(body)).toBe(true);return body.data;};
  10 |  await page.request.post('/api/v1/auth/demo',{data:{role:'owner'}});
  11 |  const seller=(await (await page.request.get('/api/v1/seller/'+cid)).json()).data;
  12 |  const original=seller.offers.find((o:any)=>o.status==='published');
  13 |  const name=`Synthetic duration ${locale} ${width} ${Date.now()}`;
  14 |  const created=await command('package.save',{catererId:cid,slug:'cycles-'+locale+width+'-'+Date.now(),offer:{...original,name,days:20,durationPricing:{revision:0,options:[{cycles:1,discountPercent:0}]}}});
  15 |  await page.goto('/seller/packages');const editor=page.locator('article').filter({has:page.getByRole('heading',{name,exact:true})}).locator('.duration-editor');
  16 |  await editor.locator('summary').click();await editor.getByRole('checkbox',{name:/3 (periode|cycles)/}).check();
  17 |  await editor.getByRole('spinbutton',{name:t('Diskon durasi (%)','Multi-cycle discount (%)')}).last().fill('5');
  18 |  await editor.getByRole('button',{name:t('Simpan pilihan durasi','Save duration options'),exact:true}).click();
  19 |  await expect.poll(async()=>{const s=(await (await page.request.get('/api/v1/seller/'+cid)).json()).data;return s.offers.find((o:any)=>o.id===created.id)?.durationPricing.options.length;}).toBe(2);
  20 |  await page.request.post('/api/v1/auth/demo',{data:{role:'customer'}});
  21 |  await page.goto('/checkout/'+created.id+'?cycles=3&portions=2&startDate='+addDays(localDay(),30));
  22 |  await expect(page.getByRole('combobox',{name:t('Durasi paket','Package duration')})).toContainText('60');
  23 |  await expect(page.getByRole('textbox',{name:/promo/i})).toHaveCount(0);
  24 |  await page.getByRole('button',{name:t('Tinjau jadwal & harga','Review schedule & price'),exact:true}).click();
  25 |  await expect(page.getByText(t('Dibayar penuh di awal','Paid in full upfront'),{exact:true})).toBeVisible();
  26 |  await expect(page.locator('.purchase-schedule details')).toHaveCount(3);
  27 |  await expect(page.locator('.purchase-schedule .schedule-preview > div')).toHaveCount(60);
  28 |  await expect(page.getByText(t('Diskon durasi paket','Multi-cycle discount')+' (5%)',{exact:true})).toBeVisible();
  29 |  await mkdir('output/usability-overhaul/multi-cycle',{recursive:true});await page.screenshot({path:`output/usability-overhaul/multi-cycle/checkout-${locale}-${width}.png`,fullPage:true});
  30 |  const axe=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa']).analyze();expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact||''))).toEqual([]);
  31 |  await page.getByRole('checkbox',{name:t('Saya sudah memeriksa jadwal, alamat, dan aturan paket.','I have reviewed the schedule, address, and package rules.')}).check();
  32 |  await page.getByRole('button',{name:t('Lanjutkan ke pembayaran','Continue to payment'),exact:true}).click();await page.waitForURL(/\/payment\//);
  33 |  const id=page.url().split('/').at(-1)!;const c=(await(await page.request.get('/api/v1/checkouts/'+id)).json()).data;expect(c.quote.cycles).toBe(3);expect(c.quote.dates).toHaveLength(60);
  34 |  await page.getByRole('button',{name:t('Simulasikan pembayaran berhasil','Simulate successful payment'),exact:true}).click();
  35 |  await expect.poll(async()=> (await(await page.request.get('/api/v1/checkouts/'+id)).json()).data.subscription_id).toBeTruthy();
  36 |  const paid=(await(await page.request.get('/api/v1/checkouts/'+id)).json()).data;
  37 |  await page.goto('/renew/'+paid.subscription_id);await expect(page.getByRole('heading',{name:t('Siapkan paket berikutnya','Prepare your next package')})).toBeVisible();
  38 |  const renewal=(await(await page.request.get('/api/v1/renewal-context/'+paid.subscription_id+'?cycles=3')).json()).data;expect(renewal.startDate>c.quote.dates.at(-1)).toBe(true);expect(renewal.dates).toHaveLength(60);
  39 |  await page.getByRole('button',{name:t('Gunakan alamat & tinjau pembelian','Use address & review purchase')}).click();await page.getByRole('link',{name:t('Lanjutkan ke pembayaran','Continue to checkout')}).click();await page.waitForURL(/renewedFrom=/);
  40 |  expect(errors).toEqual([]);
  41 | });
  42 | test('settlement owner read and admin rollout controls',async({page,baseURL})=>{
  43 |  await page.context().addCookies([{name:'catera_locale',value:'en',url:baseURL!}]);await page.request.post('/api/v1/auth/demo',{data:{role:'owner'}});
  44 |  await page.goto('/seller/transactions');await expect(page.getByRole('heading',{name:'Earnings & payouts'})).toBeVisible();await expect(page.getByText('Paid to bank',{exact:true})).toBeVisible();
  45 |  await page.request.post('/api/v1/auth/demo',{data:{role:'platform_admin'}});await page.goto('/admin/settlement');
  46 |  await expect(page.getByRole('heading',{name:'Rollout controls'})).toBeVisible();await expect(page.getByRole('checkbox',{name:'Automatic payout dispatch'})).not.toBeChecked();
  47 |  await page.getByRole('combobox',{name:'Caterer',exact:true}).click();await page.getByRole('option').filter({hasText:'Dapur Senja'}).click();
> 48 |  await expect(page.getByRole('spinbutton',{name:'Minimum payout (IDR)'})).toBeVisible();
     |                                                                           ^ Error: expect(locator).toBeVisible() failed
  49 |  await page.screenshot({path:'output/usability-overhaul/multi-cycle/settlement-admin.png',fullPage:true});
  50 | });
  51 | 
```