import { defineConfig } from '@playwright/test';
import base from '../playwright.config';
export default defineConfig({ ...base, testDir: '../tests/e2e', outputDir: './ui-sweep-test-results', webServer: undefined, reporter: [['list']], use: { ...base.use, baseURL: 'http://127.0.0.1:3117' } });
