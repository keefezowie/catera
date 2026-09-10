import {test,expect} from '@playwright/test';
import fs from 'node:fs';
// Explicit hosted test fixture. Credential file is ignored and never attached to reports.
const setup=JSON.parse(fs.readFileSync('.data/demo-accounts.json','utf8'));
for(const account of setup.accounts as {role:string;email:string;password:string}[]) {
  test(`${account.role} signs in, retains its session and signs out`,async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email',{exact:true}).fill(account.email);
    await page.getByLabel('Kata sandi',{exact:true}).fill(account.password);
    await page.getByRole('button',{name:'Masuk',exact:true}).click();
    const route=account.role==='platform_admin'?'/admin':account.role==='customer'?'/home':'/seller';
    await expect(page).toHaveURL(new RegExp(route+'$'));
    await page.reload();
    expect((await (await page.request.get('/api/v1/me')).json()).data.actor.role).toBe(account.role);
    if(account.role!=='platform_admin') expect((await page.request.get('/api/v1/admin')).status()).toBe(403);
    if(account.role==='customer') {
      await page.goto('/seller');
      await expect(page.getByRole('heading',{name:'Halaman tidak ditemukan'})).toBeVisible();
    }
    await page.request.post('/api/v1/auth/logout',{data:{}});
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login\?next=/);
    expect((await (await page.request.get('/api/v1/me')).json()).data.actor).toBeNull();
  });
}
test('hosted auth rejects invalid credentials, cross-origin posts and demo shortcuts',async({page})=>{
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill('demo.customer@catera.example');
  await page.getByLabel('Kata sandi',{exact:true}).fill('invalid-test-password');
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Email atau kata sandi tidak cocok');
  expect((await page.request.post('/api/v1/auth/demo',{data:{role:'platform_admin'}})).status()).toBe(403);
  expect((await page.request.post('/api/v1/auth/password',{headers:{origin:'https://untrusted.example'},data:{email:'demo.customer@catera.example',password:'invalid'}})).status()).toBe(403);
  await page.setViewportSize({width:390,height:844});
  fs.mkdirSync('output/fixes-verification',{recursive:true});
  await page.screenshot({path:'output/fixes-verification/login-phone.png',fullPage:true});
});
