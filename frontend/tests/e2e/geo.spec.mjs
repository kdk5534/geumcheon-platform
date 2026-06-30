// geo 페이지(행정동별 인구·시설 비교) E2E 테스트
import { expect, test } from "@playwright/test";

test("geo 페이지가 마운트되고 제목을 렌더한다", async ({ page }) => {
  await page.goto("/#/geo");
  await expect(page.locator("#geo-title")).toContainText("행정동별 인구·시설 비교");
});

test("geo 페이지 — 데이터 로드 후 세그먼트 또는 notice가 표시된다", async ({ page }) => {
  await page.goto("/#/geo");
  // 페이지가 안정화되기를 기다림: 세그먼트 또는 notice 중 하나가 나타날 때까지
  const segment = page.locator(".gdp-segmented");
  const notice = page.locator(".gdp-geo-notice");
  await Promise.race([
    segment.waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
    notice.waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
  ]);
  // 둘 중 하나가 반드시 표시됨
  const segCount = await segment.count();
  const noticeCount = await notice.count();
  expect(segCount + noticeCount).toBeGreaterThan(0);
});

test("geo 페이지 — 인구 세그먼트 버튼 클릭 시 활성화된다", async ({ page }) => {
  await page.goto("/#/geo");
  const popBtn = page.getByRole("button", { name: "인구", exact: true });
  // 인구 버튼이 생길 때까지 대기(데이터 없으면 skip)
  const visible = await popBtn.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  if (!visible) {
    test.skip();
    return;
  }
  await popBtn.click();
  await expect(popBtn).toHaveClass(/is-active/);
});

test("geo 페이지 — 현황표가 렌더된다(데이터 있을 때)", async ({ page }) => {
  await page.goto("/#/geo");
  const table = page.locator(".gdp-geo-table");
  const visible = await table.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  if (!visible) {
    test.skip();
    return;
  }
  const rows = page.locator(".gdp-geo-table tbody tr");
  await expect(rows).not.toHaveCount(0);
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
  // 페이지가 어느 정도 안정화될 때까지 제목 대기
  await expect(page.locator("#geo-title")).toBeVisible();
  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});
