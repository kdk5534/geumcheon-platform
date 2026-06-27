import { expect, test } from "../../../frontend-static/node_modules/@playwright/test/index.mjs";

test("overview renders data, filter state, and fallback-safe map panel", async ({ page }) => {
  await page.goto("/#/home");

  await expect(page.locator("#overview-title")).toContainText("금천구");
  await expect(page.locator(".gdp-data-status")).toBeVisible();
  await expect(page.locator(".gdp-kpi-card")).toHaveCount(4);

  await page.getByRole("button", { name: "목록" }).click();
  await expect(page.locator(".gdp-map-list")).toBeVisible();
  await page.locator(".gdp-map-list button").first().click();
  await expect(page.locator(".gdp-facility-detail")).toBeVisible();

  await page.getByRole("button", { name: "상권" }).click();
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toContain("topic=commercial");
});

test("overview has no horizontal document overflow on mobile", async ({ page }) => {
  await page.goto("/#/home?map=list");
  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});
