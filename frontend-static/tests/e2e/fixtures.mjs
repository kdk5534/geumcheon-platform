import { expect, test as base } from "@playwright/test";

const EXTERNAL_ASSET_URL = /^https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|api\.vworld\.kr|(?:[abc]\.)?tile\.openstreetmap\.org)\//;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/public/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: false }),
    }));

    await page.route(EXTERNAL_ASSET_URL, (route) => route.abort("blockedbyclient"));

    await use(page);
  },
});

export { expect };
