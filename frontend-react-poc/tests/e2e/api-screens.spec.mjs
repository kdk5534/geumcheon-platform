import { expect, test } from "../../../frontend-static/node_modules/@playwright/test/index.mjs";

// ─── API 수집 현황 페이지 ────────────────────────────────────────

test("api-status 페이지가 마운트되고 KPI 4개를 렌더한다", async ({ page }) => {
  await page.goto("/#/api-status");

  await expect(page.locator("#api-status-title")).toContainText("공공데이터 연동 상태");
  // KPI 행 4개 (준비됨/Mock/키 필요/확인 필요)
  await expect(page.locator(".gdp-api-kpi")).toHaveCount(4);
  // 기본 소스 카드가 1개 이상 렌더됨
  const count = await page.locator(".gdp-api-source-card").count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test("api-status 페이지 — 상태 필터 클릭 시 카드 수가 달라진다", async ({ page }) => {
  await page.goto("/#/api-status");
  // 렌더 완료 대기
  await expect(page.locator("#api-status-title")).toBeVisible();

  // 전체 카드 수 기록
  const allCount = await page.locator(".gdp-api-source-card").count();
  expect(allCount).toBeGreaterThanOrEqual(1);

  // "Mock" 필터 클릭
  await page.getByRole("button", { name: "Mock", exact: true }).click();
  const mockCount = await page.locator(".gdp-api-source-card").count();
  // Mock 필터 결과는 전체보다 작거나 같아야 함
  expect(mockCount).toBeLessThanOrEqual(allCount);
  // 필터 버튼이 활성 상태
  await expect(page.getByRole("button", { name: "Mock", exact: true })).toHaveAttribute("aria-pressed", "true");

  // "전체" 필터로 복귀 시 카드가 복원됨 — 백엔드 응답으로 추가 소스가 로드될 수 있으므로 >= 비교
  await page.getByRole("button", { name: "전체", exact: true }).click();
  const restoredCount = await page.locator(".gdp-api-source-card").count();
  expect(restoredCount).toBeGreaterThanOrEqual(allCount);
});

test("api-status 페이지 — 빈 필터 조건에서 빈 상태 메시지 표시", async ({ page }) => {
  await page.goto("/#/api-status");

  // "준비됨" 필터 클릭 후 count가 0이면 빈 상태 메시지 노출 (소스에 따라)
  // 단: 빈 결과일 때만 체크하면 되므로 "키 필요" 필터 클릭
  await page.getByRole("button", { name: "키 필요", exact: true }).click();
  const keyCount = await page.locator(".gdp-api-source-card").count();
  const emptyEl = page.locator(".gdp-api-grid-empty");
  if (keyCount === 0) {
    await expect(emptyEl).toBeVisible();
  } else {
    await expect(emptyEl).not.toBeVisible();
  }
});

// ─── API 수집 로그 페이지 ────────────────────────────────────────

test("api-logs 페이지가 마운트되고 KPI 4개와 로그 카드를 렌더한다", async ({ page }) => {
  await page.goto("/#/api-logs");

  await expect(page.locator("#api-logs-title")).toContainText("API 수집 실행 내역");
  await expect(page.locator(".gdp-api-kpi")).toHaveCount(4);
  const logCount = await page.locator(".gdp-api-log-card").count();
  expect(logCount).toBeGreaterThanOrEqual(1);
});

test("api-logs 페이지 — 상태 필터 클릭 시 로그 카드 수가 달라진다", async ({ page }) => {
  await page.goto("/#/api-logs");
  // 렌더 완료 대기
  await expect(page.locator("#api-logs-title")).toBeVisible();

  const allCount = await page.locator(".gdp-api-log-card").count();

  await page.getByRole("button", { name: "성공", exact: true }).click();
  const successCount = await page.locator(".gdp-api-log-card").count();
  expect(successCount).toBeLessThanOrEqual(allCount);
  await expect(page.getByRole("button", { name: "성공", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("api-logs 페이지 — 검색어 입력 시 결과가 필터링된다", async ({ page }) => {
  await page.goto("/#/api-logs");
  // 렌더 완료 대기
  await expect(page.locator("#api-logs-title")).toBeVisible();

  const allCount = await page.locator(".gdp-api-log-card").count();

  // "미세먼지"로 검색
  await page.locator(".gdp-api-search-input").fill("미세먼지");
  const filteredCount = await page.locator(".gdp-api-log-card").count();
  expect(filteredCount).toBeLessThanOrEqual(allCount);

  // 검색어 지우면 전체 복원
  await page.locator(".gdp-api-search-input").fill("");
  await expect(page.locator(".gdp-api-log-card")).toHaveCount(allCount);
});

test("api-logs 페이지 — 재수집 버튼 클릭 시 로그 상태가 성공으로 바뀐다", async ({ page }) => {
  await page.goto("/#/api-logs");
  // 렌더 완료 대기
  await expect(page.locator("#api-logs-title")).toBeVisible();

  // 재수집 버튼이 있는 카드를 nth(index)로 고정 — filter().first()는 클릭 후 재평가되어 다른 카드를 가리킬 수 있음
  const allCards = page.locator(".gdp-api-log-card");
  const totalCards = await allCards.count();
  let targetIdx = -1;
  for (let i = 0; i < totalCards; i++) {
    if ((await allCards.nth(i).locator(".gdp-api-retry-btn").count()) > 0) {
      targetIdx = i;
      break;
    }
  }
  expect(targetIdx).toBeGreaterThanOrEqual(0);

  const card = allCards.nth(targetIdx);
  const retryBtn = card.locator(".gdp-api-retry-btn").first();

  await expect(retryBtn).toBeVisible();

  // 재수집 전 상태: 실패·대기·수동 중 하나
  const statusBefore = await card.locator(".gdp-api-log-status").first().textContent();
  const isRetryable = ["실패", "대기", "수동"].includes((statusBefore ?? "").trim());
  expect(isRetryable).toBe(true);

  await retryBtn.click();

  // 재수집 후: 성공으로 변경되고 재수집 버튼 사라짐
  await expect(card.locator(".gdp-api-log-status").first()).toHaveText("성공");
  await expect(card.locator(".gdp-api-retry-btn")).toHaveCount(0);
});

// ─── 레거시 URL 리다이렉트 ───────────────────────────────────────

test("레거시 #/api → #/api-status 리다이렉트", async ({ page }) => {
  await page.goto("/#/api");
  await page.waitForURL((url) => url.hash.startsWith("#/api-status"));
  expect(page.url()).toContain("#/api-status");
});

// ─── 모바일 반응형 ───────────────────────────────────────────────

test("api-status 페이지는 모바일 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/api-status");
  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});

test("api-logs 페이지는 모바일 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/api-logs");
  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});
