import { defineConfig } from '@playwright/test';
import base from '../playwright.config';
export default defineConfig({ ...base, testDir: '../tests/e2e', testMatch: ['slot-menus.spec.ts'], webServer: undefined, outputDir: './migration-audit-results', use: { ...base.use, baseURL: 'http://127.0.0.1:3106' } });
