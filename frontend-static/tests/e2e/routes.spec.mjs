import { expect, test } from "./fixtures.mjs";

const PUBLIC_ROUTES = [
  ["#/home", "종합 현황"],
  ["#/population", "인구·생활"],
  ["#/nearby", "인구·생활"],
  ["#/commercial", "상권·경제"],
  ["#/welfare", "복지·건강"],
  ["#/realtime", "종합 현황"],
  ["#/safety", "안전·환경"],
  ["#/dong", "상권·경제"],
  ["#/datasets", "데이터 카탈로그"],
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

test.describe("섹션 세부 메뉴 라우팅", () => {
  const CASES = [
    { start: "#/home", href: "#/realtime", hash: "#/realtime", activeNav: "종합 현황" },
    { start: "#/population", href: "#/topics", hash: "#/topics", activeNav: "인구·생활" },
    { start: "#/commercial", href: "#/dong", hash: "#/dong", activeNav: "상권·경제" },
    { start: "#/welfare", href: "#/nearby?category=복지", hash: "#/nearby?category=복지", activeNav: "복지·건강" },
    { start: "#/safety", href: "#/nearby?category=CCTV", hash: "#/nearby?category=CCTV", activeNav: "안전·환경" },
  ];

  for (const item of CASES) {
    test(`${item.start} 세부 메뉴 ${item.href}`, async ({ page }) => {
      await page.goto(`/${item.start}`);
      await page.locator("#section-nav").locator(`a[href="${item.href}"]`).click();

      await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
        .toBe(item.hash);
      await expect(page.locator(".nav a.is-active")).toContainText(item.activeNav);
      await expect(page.locator("#view")).not.toBeEmpty();
    });
  }
});
