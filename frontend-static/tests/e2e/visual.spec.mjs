import { expect, test } from "./fixtures.mjs";

const ROUTES = ["home", "nearby", "dong", "topics", "datasets"];

test.beforeEach(({}, testInfo) => {
  test.skip(
    !["desktop-chrome", "mobile-chrome"].includes(testInfo.project.name),
    "시각 기준선은 대표 데스크톱·모바일 폭에서 관리",
  );
});

for (const route of ROUTES) {
  test(`${route} 공개 화면 시각 기준선`, async ({ page }) => {
    await page.goto(`/#/${route}`);
    await expect(page.locator("#view h1, #view h2").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-app-data-state", "ready");
    if (route === "home") await page.waitForTimeout(1_300);
    await expect(page).toHaveScreenshot(`${route}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      mask: [page.locator("#util-date")],
      maxDiffPixelRatio: 0.01,
    });
  });
}
