import { expect, test } from "./fixtures.mjs";

test("공개 홈이 기본 성능 예산 안에서 표시된다", async ({ page }) => {
  await page.addInitScript(() => {
    window.__performanceBudget = { cls: 0, lcp: 0, shifts: [] };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__performanceBudget.lcp = entries.at(-1)?.startTime || 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          window.__performanceBudget.cls += entry.value;
          window.__performanceBudget.shifts.push({
            value: entry.value,
            sources: entry.sources.map((source) => ({
              element: source.node?.id || source.node?.className || source.node?.tagName || "unknown",
              previousRect: source.previousRect,
              currentRect: source.currentRect,
            })),
          });
        }
      });
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto("/#/home");
  await expect(page.locator(".home-dash")).toBeVisible();
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const localAssetBytes = performance.getEntriesByType("resource")
      .filter((entry) => entry.name.startsWith(location.origin) && /\.(?:js|css)(?:\?|$)/.test(entry.name))
      .reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
    const firstContentfulPaint = performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0;
    const renderMs = window.__performanceBudget.lcp || firstContentfulPaint;
    return {
      ...window.__performanceBudget,
      firstContentfulPaint,
      renderMs,
      renderMetric: window.__performanceBudget.lcp ? "lcp" : "fcp-fallback",
      localAssetBytes,
    };
  });

  expect(metrics.renderMs, JSON.stringify(metrics)).toBeGreaterThan(0);
  expect(metrics.renderMs, JSON.stringify(metrics)).toBeLessThanOrEqual(2_500);
  expect(metrics.cls, JSON.stringify(metrics)).toBeLessThanOrEqual(0.1);
  expect(metrics.localAssetBytes, JSON.stringify(metrics)).toBeLessThanOrEqual(2_000_000);
});
