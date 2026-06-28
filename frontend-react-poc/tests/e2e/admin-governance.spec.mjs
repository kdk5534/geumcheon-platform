// 관리자 거버넌스 페이지 E2E 테스트 — 백엔드 없이 검증 가능한 범위
import { expect, test } from "@playwright/test";

// ── 미인증 게이트 ─────────────────────────────────────────────

test("admin.html#/governance — 미인증 시 로그인 화면을 표시한다", async ({ page }) => {
  await page.goto("/admin.html#/governance");
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });
  await expect(page.locator(".gdp-admin-gov-page")).not.toBeVisible();
});

// ── 내비 구조 확인 ────────────────────────────────────────────

test("admin.html — 거버넌스 내비 링크가 헤더에 존재한다는 전제를 로그인 화면 레벨에서 확인한다", async ({
  page,
}) => {
  // 인증 전에는 로그인 화면이 렌더된다 — shell 마운트 증명
  await page.goto("/admin.html#/governance");
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });
  await expect(page.locator(".gdp-admin-login-wrap")).toBeVisible();
});

// ── 모바일 반응형 ─────────────────────────────────────────────

test("admin.html#/governance 는 모바일 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin.html#/governance");
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});

test("admin.html#/governance 는 데스크톱 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin.html#/governance");
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});
