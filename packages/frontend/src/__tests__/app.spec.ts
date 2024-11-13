import { test } from "@playwright/test";

test("should load page without errors", async ({ page }) => {
  await page.goto(`http://localhost:${process.env.REACT_APP_PORT ?? "3000"}`);
});
