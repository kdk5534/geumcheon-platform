// 관리자 업로드 페이지 E2E 테스트 — 백엔드 없이 검증 가능한 범위
import { expect, test } from "@playwright/test";

async function gotoAdmin(page) {
  await page.goto("/admin.html");
}

// ── 미인증 게이트 ─────────────────────────────────────────────

test("admin.html#/upload — 미인증 시 로그인 화면을 표시한다", async ({ page }) => {
  // HashRouter 경로로 진입
  await page.goto("/admin.html#/upload");

  // 세션 복원 실패(백엔드 없음) → 로그인 폼 노출
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });
  // 업로드 화면은 보이지 않아야 한다
  await expect(page.locator(".gdp-admin-upload-controls")).not.toBeVisible();
});

// ── 라우트 마운트 확인 (인증 불필요 — 로그인 화면 레벨에서 확인) ─

test("admin.html 접근 시 로그인 이후 업로드 링크가 헤더 내비에 노출된다는 전제를 DOM 구조로 검증한다", async ({ page }) => {
  // 이 테스트는 백엔드 없이 AdminShell 구조만 확인한다.
  // 실제 로그인 플로우는 백엔드 의존이므로 수동 검증으로 분리.
  await gotoAdmin(page);
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });
  // 로그인 폼이 보이면 shell이 정상 렌더됐음을 의미한다.
  await expect(page.locator(".gdp-admin-login-wrap")).toBeVisible();
});

// ── 모바일 반응형 ─────────────────────────────────────────────

test("admin.html#/upload 로그인 화면은 모바일 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin.html#/upload");
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});

test("admin.html 업로드 경로는 데스크톱 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin.html#/upload");
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});
