import { createRequire } from "node:module";
import { expect, test } from "./fixtures.mjs";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

for (const route of ["#/home", "#/nearby", "#/dong", "#/topics", "#/datasets"]) {
  test(`${route} 중대 접근성 오류 없음`, async ({ page }) => {
    await page.goto(`/${route}`);
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(async () => window.axe.run(document, {
      resultTypes: ["violations"],
      rules: {
        "color-contrast": { enabled: false },
      },
    }));
    const serious = result.violations.filter((item) =>
      item.impact === "critical" || item.impact === "serious"
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
