import { expect, test } from "./fixtures.mjs";

test("테스트 브라우저가 정적 서버에 연결된다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#view")).toBeAttached();
});
