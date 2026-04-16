import { defineConfig } from '@playwright/test';

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
        },
      },
});
