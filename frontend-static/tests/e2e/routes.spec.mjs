import { expect, test } from "./fixtures.mjs";

const PUBLIC_ROUTES = [
  ["#/home", "오늘의 금천"],
  ["#/nearby", "내 주변"],
  ["#/dong", "우리 동"],
  ["#/topics", "분야별"],
  ["#/datasets", "데이터 찾기"],
  ["#/about", ""],
];

test.describe("공개 라우트 스모크", () => {
  for (const [route, activeNav] of PUBLIC_ROUTES) {
    test(`${route} 직접 진입`, async ({ page }) => {
      const errors = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
          errors.push(message.text());
        }
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(`/${route}`);
      await expect(page.locator("#view")).not.toBeEmpty();
      await expect(page.locator("#view h1, #view h2").first()).toBeVisible();

      if (activeNav) {
        await expect(page.locator(".nav a.is-active")).toContainText(activeNav);
      }

      const overflowReport = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        return {
          hasDocumentOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
          elements: [...document.querySelectorAll("body *")]
            .filter((element) => element.getBoundingClientRect().right > viewportWidth + 1)
            .slice(0, 10)
            .map((element) => ({
              selector: element.id ? `#${element.id}` : element.className || element.tagName,
              right: Math.round(element.getBoundingClientRect().right),
              width: Math.round(element.getBoundingClientRect().width),
            })),
        };
      });
      expect(overflowReport.hasDocumentOverflow, JSON.stringify(overflowReport, null, 2)).toBe(false);
      expect(errors).toEqual([]);
    });
  }
});
