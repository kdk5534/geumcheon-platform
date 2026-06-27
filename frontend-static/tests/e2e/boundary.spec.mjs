import { expect, test } from "./fixtures.mjs";

test("공개 첫 화면은 관리자 모듈을 미리 로드하지 않는다", async ({ page }) => {
  await page.goto("/#/home");
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(resources.some((url) => url.endsWith("/js/pages/admin.js"))).toBe(false);
  expect(resources.some((url) => url.endsWith("/js/pages/api-logs.js"))).toBe(false);
});

test("미인증 관리자 직접 진입은 인증 화면만 노출한다", async ({ page }) => {
  const adminRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/admin/")) adminRequests.push(request.url());
  });

  await page.goto("/#/admin");

  await expect(page.locator("#adminAuthForm")).toBeVisible();
  await expect(page.locator("#adminAccessGate")).toBeVisible();
  await expect(page.locator("#datasetEditor")).toBeHidden();
  await expect(page.locator("#commitUpload")).toBeHidden();
  expect(adminRequests).toEqual([expect.stringContaining("/api/admin/auth/me")]);
});

test("미인증 운영 로그 경로도 관리자 인증 경계로 보낸다", async ({ page }) => {
  await page.goto("/#/api-logs");

  await expect(page.locator("#adminAuthForm")).toBeVisible();
  await expect(page.locator("#adminAccessGate")).toBeVisible();
  await expect(page.locator(".api-log-list")).toHaveCount(0);
});

test("관리자 세션 로그인 성공 후에만 운영 도구를 표시한다", async ({ page }) => {
  const authorizationHeaders = [];
  await page.route("**/api/admin/**", async (route) => {
    authorizationHeaders.push(route.request().headers().authorization || "");
    const url = route.request().url();
    const isMe = url.includes("/auth/me");
    const data = url.includes("/auth/login")
      ? { loginId: "operator", roles: ["OPERATOR"] }
      : url.includes("/auth/csrf")
        ? { headerName: "X-XSRF-TOKEN", token: "test-csrf" }
        : [];
    await route.fulfill({
      status: isMe ? 401 : 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: !isMe, data: isMe ? null : data }),
    });
  });
  await page.goto("/#/admin");

  await page.locator("#adminLoginId").fill("operator");
  await page.locator("#adminPassword").fill("secret");
  await page.locator("#adminAuthForm button[type='submit']").click();

  await expect(page.locator("#adminAuthStatus")).toContainText("인증됨");
  await expect(page.locator("#adminAccessGate")).toHaveCount(0);
  await expect(page.locator("#datasetEditor")).toBeVisible();
  expect(authorizationHeaders.length).toBeGreaterThanOrEqual(1);
  expect(authorizationHeaders.every((header) => header === "")).toBe(true);
});
