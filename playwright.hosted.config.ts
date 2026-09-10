import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'tests/hosted', timeout:60000, workers:1, reporter:'list',
  use:{baseURL:'http://127.0.0.1:3001',viewport:{width:1440,height:1000},trace:'off',
    launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined}},
});
