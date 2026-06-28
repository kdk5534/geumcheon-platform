import { expect, test } from "../../../frontend-static/node_modules/@playwright/test/index.mjs";

test("geo 페이지가 마운트되고 기본 권역 KPI를 렌더한다", async ({ page }) => {
  await page.goto("/#/geo");

  await expect(page.locator("#geo-title")).toContainText("접근성·권역");
  await expect(page.locator(".gdp-geo-notice")).toBeVisible();
  // 인구 데이터 유무에 따라 3~4개 KPI 카드 렌더
  const count = await page.locator(".gdp-geo-kpi-row article").count();
  expect(count).toBeGreaterThanOrEqual(3);
  await expect(page.locator(".gdp-geo-score-card")).toHaveCount(3);
});

test("geo 페이지 — 권역 버튼 클릭 시 KPI가 해당 권역으로 교체된다", async ({ page }) => {
  await page.goto("/#/geo");

  // 권역 선택 버튼 그룹에서 독산동만 클릭 (테이블 내 버튼과 구분)
  await page.locator(".gdp-geo-district-group button").filter({ hasText: "독산동" }).first().click();
  await expect(page.locator(".gdp-geo-kpi-row article").first()).toContainText("독산동");
});

test("geo 페이지 — 비교 기준 버튼 전환 시 차트 제목이 바뀐다", async ({ page }) => {
  await page.goto("/#/geo");

  await page.getByRole("button", { name: "교통", exact: true }).click();
  await expect(page.locator(".gdp-geo-chart-title").first()).toContainText("교통");
});

test("레거시 #/map → #/nearby 리다이렉트", async ({ page }) => {
  await page.goto("/#/map");
  await page.waitForURL((url) => url.hash.startsWith("#/nearby"));
  expect(page.url()).toContain("#/nearby");
});

test("레거시 #/catalog → #/datasets 리다이렉트", async ({ page }) => {
  await page.goto("/#/catalog");
  await page.waitForURL((url) => url.hash.startsWith("#/datasets"));
  expect(page.url()).toContain("#/datasets");
});

test("레거시 #/today → #/home 리다이렉트", async ({ page }) => {
  await page.goto("/#/today");
  await page.waitForURL((url) => url.hash.startsWith("#/home"));
  expect(page.url()).toContain("#/home");
});

test("레거시 #/dong?section=accessibility → #/geo 리다이렉트", async ({ page }) => {
  await page.goto("/#/dong?section=accessibility");
  await page.waitForURL((url) => url.hash.startsWith("#/geo"));
  expect(page.url()).toContain("#/geo");
});

test("레거시 #/dong?section=population → #/population 리다이렉트", async ({ page }) => {
  await page.goto("/#/dong?section=population");
  await page.waitForURL((url) => url.hash.startsWith("#/population"));
  expect(page.url()).toContain("#/population");
});

test("geo 페이지는 모바일 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/geo");
  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});
