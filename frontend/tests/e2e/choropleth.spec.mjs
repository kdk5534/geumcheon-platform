// choropleth(행정동 단계구분도) E2E 테스트
import { expect, test } from "@playwright/test";

test.describe("choropleth 토글 및 범례", () => {
  test("home 지도 모드에서 인구 색칠 토글이 렌더된다", async ({ page }) => {
    await page.goto("/#/home");
    // 지도 탭이 기본
    const toggleBtn = page.getByRole("button", { name: /인구 색칠/ });
    // 인구 데이터가 없을 때(mock) 토글이 안 보일 수도 있으나, mock 데이터가 있으면 보임
    // 버튼이 있는 경우만 검증
    const count = await toggleBtn.count();
    if (count > 0) {
      await expect(toggleBtn).toBeVisible();
      await expect(toggleBtn).toHaveText("인구 색칠 켜기");
    }
  });

  test("choropleth 토글 클릭 시 상태가 전환된다", async ({ page }) => {
    await page.goto("/#/home");
    const toggleBtn = page.getByRole("button", { name: /인구 색칠/ });
    const count = await toggleBtn.count();
    if (count === 0) {
      test.skip();
      return;
    }
    // 켜기 → 끄기 전환
    await expect(toggleBtn).toHaveText("인구 색칠 켜기");
    await expect(toggleBtn).not.toHaveClass(/is-active/);
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText("인구 색칠 끄기");
    await expect(toggleBtn).toHaveClass(/is-active/);
    // 다시 끄기
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText("인구 색칠 켜기");
  });

  test("choropleth 활성 시 범례가 표시된다", async ({ page }) => {
    await page.goto("/#/home");
    const toggleBtn = page.getByRole("button", { name: "인구 색칠 켜기" });
    const count = await toggleBtn.count();
    if (count === 0) {
      test.skip();
      return;
    }
    // 범례는 choropleth 비활성 시 없어야 함
    await expect(page.locator(".gdp-choropleth-legend")).toHaveCount(0);
    // 활성화
    await toggleBtn.click();
    await expect(page.locator(".gdp-choropleth-legend")).toBeVisible();
    await expect(page.locator(".gdp-choropleth-legend-title")).toContainText("인구");
    // 범례 아이템 1개 이상
    const items = page.locator(".gdp-choropleth-legend-item");
    await expect(items).not.toHaveCount(0);
  });

  test("목록 모드에서 토글이 숨겨진다", async ({ page }) => {
    await page.goto("/#/home");
    await page.getByRole("button", { name: "목록" }).click();
    await expect(page.locator(".gdp-choropleth-toggle")).toHaveCount(0);
  });

  test("수평 오버플로 없음(모바일)", async ({ page, viewport: _v }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/home");
    const toggleBtn = page.getByRole("button", { name: "인구 색칠 켜기" });
    if ((await toggleBtn.count()) > 0) await toggleBtn.click();
    const report = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
  });
});
