import { it } from "@playwright/test";

it("should load page without errors", async ({ page }) => {
  await page.goto(`https://localhost:${process.env.REACT_APP_PORT ?? 3000}`);
  // await page.fill('input[name="search"]', 'test');
  // await page.click('button[type="submit"]');
  // await expect(page.locator('.results')).toBeVisible();
});
