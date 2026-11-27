// CHECK 2: test the whole site in a real browser before it is published.
// Run with:  npm test
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.mjs",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-report" }]],
  use: {
    baseURL: "http://localhost:8123/",
    screenshot: "only-on-failure",
    // Only for computers that can't download Playwright's browser; unset on GitHub.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npx http-server . -p 8123 -c-1 -s",
    url: "http://localhost:8123/",
    reuseExistingServer: !process.env.CI,
  },
});
