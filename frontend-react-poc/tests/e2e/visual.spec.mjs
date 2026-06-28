// React POC 시각회귀 테스트 — 주요 라우트 스냅샷 기준선
import { expect, test } from "@playwright/test";

// 날짜·실시간 지표처럼 렌더링마다 달라지는 영역을 마스킹해 스냅샷 안정성 확보
const DYNAMIC_MASKS = [
  ".gdp-util-bar",   // 오늘 날짜 표시
  ".gdp-pulse-bar",  // 실시간 지표 숫자
  ".gdp-kicker",     // 홈 헤더의 기준일 문구
];

// 확인 대상 라우트 목록
// ready: 해당 요소가 visible 되면 콘텐츠 로드 완료로 간주
const ROUTES = [
  { hash: "home",    label: "home",    ready: ".gdp-kpi-card" },
  { hash: "nearby",  label: "nearby",  ready: "h1"           },
  { hash: "dong",    label: "dong",    ready: "h1"           },
  { hash: "topics",  label: "topics",  ready: "#topics-title" },
  { hash: "datasets",label: "datasets",ready: "h1"           },
];

for (const route of ROUTES) {
  test(`시각회귀 — ${route.label} 페이지`, async ({ page }, testInfo) => {
    await page.goto(`/#/${route.hash}`);

    // 콘텐츠 준비 대기
    await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 10_000 });

    // 추가 settle — 레이아웃 shift가 끝나도록 짧게 대기
    await page.waitForTimeout(300);

    // 마스킹 요소 수집 (없으면 빈 배열)
    const maskLocators = DYNAMIC_MASKS.map((sel) => page.locator(sel));

    const projectName = testInfo.project.name;
    await expect(page).toHaveScreenshot(`${route.label}-${projectName}.png`, {
      mask: maskLocators,
      maxDiffPixelRatio: 0.02,
    });
  });
}
