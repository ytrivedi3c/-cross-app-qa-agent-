import "dotenv/config";
import { existsSync } from "fs";
import path from "path";
import { defineConfig, devices } from "@playwright/test";
import { getAppBaseUrl } from "./src/app-urls.js";

const baseURL = getAppBaseUrl();
const storageStatePath = path.resolve(process.cwd(), "tests", "ui", ".auth", "storage-state.json");
const useStorageState = existsSync(storageStatePath);

export default defineConfig({
  testDir: "./tests/ui",
  outputDir: "./reports/playwright",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  maxFailures: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "reports/ui-test-results.json" }],
    ["html", { outputFolder: "reports/playwright-html", open: "never" }],
  ],
  use: {
    baseURL,
    ...(useStorageState && { storageState: storageStatePath }),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        launchOptions: { args: ["--start-maximized", "--window-size=1920,1080"] },
      },
    },
  ],
});
