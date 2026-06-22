import { expect, test } from "./fixtures.mjs";

test("오늘의 금천 상태 카드는 값·상태·기준시각·출처를 함께 제공한다", async ({ page }) => {
  await page.goto("/#/home");
  const cards = page.locator("#home-kpi-grid .home-kpi-tile");
  await expect(cards).toHaveCount(4);
  await expect(cards.first().locator(".home-kpi-value")).not.toBeEmpty();
  await expect(cards.first().locator(".home-kpi-label")).toContainText(/샘플|운영 데이터|일부 지연|정상|갱신 지연/);
  await expect(cards.first().locator(".home-kpi-source")).toContainText("·");
  await expect(cards.first().locator(".home-kpi-change")).not.toBeEmpty();
});

test("우리 동 선택이 요약과 세부 링크를 함께 갱신한다", async ({ page }) => {
  await page.goto("/#/dong");
  const select = page.getByRole("combobox", { name: "비교할 동" });
  await expect(select).toHaveValue("가산동");
  await select.selectOption("시흥동");

  await expect(page).toHaveURL(/#\/dong\?district=.*$/);
  await expect(page.locator("#dong-comparison-title")).toHaveText("시흥동과 구 평균");
  await expect(page.locator(".dong-card-link").first()).toHaveAttribute("href", /district=.*$/);
  await expect(page.getByRole("table", { name: "시흥동 구 평균 비교 정확값" })).toBeVisible();
  await expect(page.getByRole("link", { name: "비교표 CSV 내려받기" }))
    .toHaveAttribute("href", /^data:text\/csv;charset=utf-8,/);
});

test("내 주변 카테고리 필터가 목록과 결과 수를 함께 갱신한다", async ({ page }) => {
  await page.goto("/#/nearby");
  await page.getByRole("button", { name: "CCTV", exact: true }).click();

  await expect(page.locator('.map-filter-btn[data-cat="CCTV"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#map-list-count")).toHaveText("3개");
  await expect(page.locator("#facility-list .facility-item")).toHaveCount(3);
  await expect(page.locator(".map-list-basis")).toContainText("거리순이 아닙니다");
  await expect(page.locator(".map-list-basis")).toContainText("영업 여부를 계산하지 않습니다");
});

test("공공 Wi-Fi는 마지막 성공 스냅샷과 기준시각을 명시한다", async ({ page }) => {
  await page.goto("/#/nearby");
  await page.getByRole("button", { name: "와이파이", exact: true }).click();

  const status = page.locator("#map-status-card");
  await expect(status).toContainText("마지막 성공 데이터");
  await expect(status).toContainText("1,644건");
  await expect(status).toContainText("실시간 수집은 비활성화");
  await expect(status).toContainText("기준시각 2026-06-19");
});

test("상권분석은 금천구만으로 시작하고 경계 생활권을 명시적으로 선택한다", async ({ page }) => {
  await page.goto("/#/commercial");

  const geumcheon = page.locator('.cml-scope-btn[data-scope="GEUMCHEON"]');
  const border = page.locator('.cml-scope-btn[data-scope="BORDER_AREA"]');
  await expect(geumcheon).toHaveAttribute("aria-pressed", "true");
  await expect(border).toHaveAttribute("aria-pressed", "false");

  await border.click();

  await expect(geumcheon).toHaveAttribute("aria-pressed", "false");
  await expect(border).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#cml-scope-note")).toContainText("외부 참고자료 제외");
});

test("상권 차트·표·CSV는 같은 필터 맥락과 합계를 제공한다", async ({ page }) => {
  await page.goto("/#/commercial");

  await page.getByRole("button", { name: "음식점", exact: true }).click();
  await expect(page.locator("#cml-bar-title")).toContainText("음식점");
  await expect(page.locator("#cml-line-title")).toContainText("음식점");

  const table = page.getByRole("table", { name: "행정동 업종 현황" });
  await expect(table).toBeVisible();
  const download = page.getByRole("link", { name: "CSV 내려받기" });
  await expect(download).toHaveAttribute("download", "geumcheon-commercial-by-dong.csv");
  await expect(download).toHaveAttribute("href", /^data:text\/csv;charset=utf-8,/);
});

test("외부 지도 자산이 없어도 주변 시설 목록을 사용할 수 있다", async ({ page }) => {
  await page.goto("/#/nearby");

  await expect(page.locator("#map-status-card")).toContainText("지도 오류");
  await expect(page.locator("#facility-list .facility-item")).toHaveCount(30);
  await expect(page.locator("#facility-list a[href^='tel:']").first()).toBeVisible();
});

test("외부 지도 자산 실패 후 다시 진입해도 대체 목록을 복구한다", async ({ page }) => {
  await page.goto("/#/nearby");
  await expect(page.locator("#map-status-card")).toContainText("지도 오류");

  await page.evaluate(() => { location.hash = "#/dong"; });
  await expect(page.locator(".dong-page")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/nearby"; });

  await expect(page.locator("#map-status-card")).toContainText("지도 오류");
  await expect(page.locator("#facility-list .facility-item")).toHaveCount(30);
  await expect(page.locator("#leaflet-js")).toHaveCount(0);
});

test("모바일 메뉴는 열고 링크를 선택하면 닫힌다", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "모바일 프로젝트 전용");
  await page.goto("/#/home");

  const toggle = page.locator("#nav-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.locator("#main-nav").getByRole("link", { name: "우리 동" }).click();
  await expect(page).toHaveURL(/#\/dong$/);
  await expect(page.locator("#nav-toggle")).toHaveAttribute("aria-expanded", "false");
});

test("빠르게 라우트를 전환해도 마지막 화면만 남는다", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/#/home");

  const routes = ["nearby", "topics", "datasets", "home", "dong"];
  for (let index = 0; index < 30; index += 1) {
    await page.evaluate((route) => { location.hash = `#/${route}`; }, routes[index % routes.length]);
  }

  await expect(page).toHaveURL(/#\/dong$/);
  await expect(page.locator(".dong-page")).toBeVisible();
  await expect(page.locator("#view")).not.toHaveAttribute("aria-busy", "true");
  expect(pageErrors).toEqual([]);
});

test("데이터 요청 중 화면을 떠나면 이전 화면 갱신을 취소한다", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  let markRequestStarted;
  const requestStarted = new Promise((resolve) => {
    markRequestStarted = resolve;
  });
  await page.route("**/assets/data/datasets.json", async (route) => {
    markRequestStarted();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ datasets: [] }),
    });
  });

  await page.goto("/#/datasets");
  await requestStarted;
  await page.evaluate(() => { location.hash = "#/dong"; });

  await expect(page.locator(".dong-page")).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.locator(".cat-page")).toHaveCount(0);
  await expect(page.locator(".route-error")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
