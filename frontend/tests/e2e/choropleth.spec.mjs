// choropleth(행정동 단계구분도) E2E 테스트
import { expect, test } from "@playwright/test";

test.describe("choropleth 세그먼트 및 범례", () => {
  test("home 지도 모드에서 동별 색칠 세그먼트가 렌더된다", async ({ page }) => {
    await page.goto("/#/home");
    // 인구 또는 시설 데이터가 있을 때만 세그먼트 표시
    const segment = page.locator(".gdp-choropleth-segment");
    const count = await segment.count();
    if (count > 0) {
      await expect(segment).toBeVisible();
      // '끄기' 버튼은 항상 존재
      await expect(page.getByRole("button", { name: "끄기" })).toBeVisible();
    }
  });

  test("인구 버튼 클릭 시 choropleth가 활성화된다", async ({ page }) => {
    await page.goto("/#/home");
    const popBtn = page.getByRole("button", { name: "인구" });
    const count = await popBtn.count();
    if (count === 0) {
      test.skip();
      return;
    }
    // 초기 상태: 인구 버튼 비활성
    await expect(popBtn).not.toHaveClass(/is-active/);
    await popBtn.click();
    // 활성 후: 인구 버튼 is-active, 범례 표시
    await expect(popBtn).toHaveClass(/is-active/);
    await expect(page.locator(".gdp-choropleth-legend")).toBeVisible();
    await expect(page.locator(".gdp-choropleth-legend-title")).toContainText("인구");
  });

  test("시설 수 버튼 클릭 시 choropleth가 전환된다", async ({ page }) => {
    await page.goto("/#/home");
    const facilityBtn = page.getByRole("button", { name: "시설 수" });
    const count = await facilityBtn.count();
    if (count === 0) {
      test.skip();
      return;
    }
    await facilityBtn.click();
    await expect(facilityBtn).toHaveClass(/is-active/);
    await expect(page.locator(".gdp-choropleth-legend")).toBeVisible();
    await expect(page.locator(".gdp-choropleth-legend-title")).toContainText("시설 수");
  });

  test("끄기 버튼 클릭 시 범례가 사라진다", async ({ page }) => {
    await page.goto("/#/home");
    const popBtn = page.getByRole("button", { name: "인구" });
    const offBtn = page.getByRole("button", { name: "끄기" });
    if ((await popBtn.count()) === 0) {
      test.skip();
      return;
    }
    // 인구 켜기
    await popBtn.click();
    await expect(page.locator(".gdp-choropleth-legend")).toBeVisible();
    // 끄기
    await offBtn.click();
    await expect(page.locator(".gdp-choropleth-legend")).toHaveCount(0);
  });

  test("choropleth 활성 시 범례 아이템 1개 이상 표시", async ({ page }) => {
    await page.goto("/#/home");
    const popBtn = page.getByRole("button", { name: "인구" });
    if ((await popBtn.count()) === 0) {
      test.skip();
      return;
    }
    await popBtn.click();
    await expect(page.locator(".gdp-choropleth-legend")).toBeVisible();
    const items = page.locator(".gdp-choropleth-legend-item");
    await expect(items).not.toHaveCount(0);
  });

  test("목록 모드에서 세그먼트가 숨겨진다", async ({ page }) => {
    await page.goto("/#/home");
    await page.getByRole("button", { name: "목록" }).click();
    await expect(page.locator(".gdp-choropleth-segment")).toHaveCount(0);
  });

  test("수평 오버플로 없음(모바일)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/home");
    const popBtn = page.getByRole("button", { name: "인구" });
    if ((await popBtn.count()) > 0) await popBtn.click();
    const report = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
  });
});
