import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHomePopularDatasets, loadHomeRealtimeSummary } from "../../js/pages/home-data.js";

describe("홈 데이터 로더", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("인기 데이터셋을 조회수 순으로 제한한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        datasets: [
          { id: "a", views: 3 },
          { id: "b", views: 20 },
          { id: "c", views: 8 },
        ],
      }),
    })));

    const result = await loadHomePopularDatasets({ limit: 2 });
    expect(result.map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("실시간 summary가 없으면 빈 객체를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })));

    await expect(loadHomeRealtimeSummary()).resolves.toEqual({});
  });
});
