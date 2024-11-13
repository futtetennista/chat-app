import { test } from "@playwright/test";

test("should load page without errors", async ({ page }) => {
  // The base URL is defined in playwright.config.ts
  await page.goto("/");
});
