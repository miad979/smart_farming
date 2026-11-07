import { defineConfig } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const uiDataDir = process.env.UI_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'sf-ui-data-'));

const uiPort = Number(process.env.UI_PORT || 5176);
const baseURL = process.env.UI_BASE_URL || `http://127.0.0.1:${uiPort}`;
const skipWebServer = process.env.UI_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: 'tests/ui',
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['line']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run build && node server/preview-server.cjs',
        port: uiPort,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PORT: String(uiPort),
          // Isolated data for every run: never read or modify the developer's real local database
          // (local data file, uploads, or the Postgres in .env.local).
          SF_DATA_DIR: uiDataDir,
          DATABASE_URL: '',
        },
      },
});
