// React POC 접근성 테스트 — axe-core critical/serious 위반 0 단언
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

const require = createRequire(import.meta.url);
// axe-core는 react-poc/node_modules에 자체 설치됨(4.11.1)
const axePath = require.resolve("axe-core/axe.min.js");

// 라우트별 준비 신호 — visible 확인 후 axe 스캔 진행
const ROUTES = [
  { hash: "home",     ready: ".gdp-kpi-card"  },
  { hash: "nearby",   ready: "h1"             },
  { hash: "dong",     ready: "h1"             },
  { hash: "welfare",  ready: "h1"             },
  { hash: "realtime", ready: "h1"             },
  { hash: "safety",   ready: "h1"             },
  { hash: "topics",   ready: "#topics-title"  },
  { hash: "datasets", ready: "h1"             },
];

for (const route of ROUTES) {
  test(`#/${route.hash} — 중대 접근성 오류 없음`, async ({ page }) => {
    await page.goto(`/#/${route.hash}`);

    // 콘텐츠 준비 대기(axe가 빈 페이지를 스캔하면 위양성 발생)
    await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 10_000 });

    // axe-core 주입
    await page.addScriptTag({ path: axePath });

    // 스캔 — color-contrast는 테마·모드 변동이 크므로 비활성
    const result = await page.evaluate(async () =>
      window.axe.run(document, {
        resultTypes: ["violations"],
        rules: {
          "color-contrast": { enabled: false },
        },
      })
    );

    const serious = result.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
