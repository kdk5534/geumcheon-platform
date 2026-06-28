// 관리자 콘솔 인증 게이트 E2E 테스트 — 백엔드 없이 검증 가능한 범위
import { expect, test } from "../../../frontend-static/node_modules/@playwright/test/index.mjs";

// admin.html 진입점으로 이동하는 헬퍼
async function gotoAdmin(page) {
  await page.goto("/admin.html");
}

// ─── 미인증 게이트 ────────────────────────────────────────

test("admin.html 접근 시 로그인 화면이 렌더된다", async ({ page }) => {
  await gotoAdmin(page);

  // 세션 복원 시도 후(백엔드 없으면 즉시 실패) 로그인 폼 노출
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });
  await expect(page.locator("#admin-login-id")).toBeVisible();
  await expect(page.locator("#admin-password")).toBeVisible();
  await expect(page.getByRole("button", { name: /로그인/, exact: false })).toBeVisible();
});

test("admin 로그인 폼 — ID·비밀번호 필드가 입력 가능하다", async ({ page }) => {
  await gotoAdmin(page);
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  await page.locator("#admin-login-id").fill("admin");
  await page.locator("#admin-password").fill("somepassword");

  await expect(page.locator("#admin-login-id")).toHaveValue("admin");
  await expect(page.locator("#admin-password")).toHaveValue("somepassword");
});

test("admin 로그인 — 제출 시 에러 메시지가 노출된다 (백엔드 없음·연결 오류)", async ({ page }) => {
  await gotoAdmin(page);
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  await page.locator("#admin-login-id").fill("admin");
  await page.locator("#admin-password").fill("wrongpassword");

  // 백엔드 미기동 → 네트워크 오류 → "서버에 연결할 수 없습니다" 메시지
  await page.getByRole("button", { name: /로그인/, exact: false }).click();

  // 에러 메시지가 화면에 표시되는지만 확인 (메시지 내용은 상태에 따라 다름)
  await expect(page.locator("#admin-login-error")).toBeVisible({ timeout: 20000 });
});

test("admin 로그인 — 비어 있는 폼은 제출 버튼이 비활성화된다", async ({ page }) => {
  await gotoAdmin(page);
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  // 초기 상태: ID·비밀번호 모두 비어 있음 → 버튼 비활성
  await expect(
    page.getByRole("button", { name: /로그인/, exact: false }),
  ).toBeDisabled();

  // ID만 입력 → 여전히 비활성
  await page.locator("#admin-login-id").fill("admin");
  await expect(
    page.getByRole("button", { name: /로그인/, exact: false }),
  ).toBeDisabled();

  // 비밀번호까지 입력 → 활성화
  await page.locator("#admin-password").fill("pw");
  await expect(
    page.getByRole("button", { name: /로그인/, exact: false }),
  ).not.toBeDisabled();
});

// ─── 모바일 반응형 ────────────────────────────────────────

test("admin.html 로그인 화면은 모바일 너비에서 수평 오버플로가 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAdmin(page);
  await expect(page.locator("#admin-login-form")).toBeVisible({ timeout: 6000 });

  const report = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
});
