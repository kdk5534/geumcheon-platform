import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, isDevelopmentSampleEnabled, loadBackendData, loadFacilitiesInBbox, loadStoreScopeCount } from "../../js/core/api.js";

describe("sample data policy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not enable sample data without an explicit development host", () => {
    expect(isDevelopmentSampleEnabled()).toBe(false);
  });

  it("respects an explicit production override", () => {
    vi.stubGlobal("window", { __ENV__: { ENABLE_SAMPLE_DATA: "false" }, location: { hostname: "localhost" } });
    expect(isDevelopmentSampleEnabled()).toBe(false);
  });
});

describe("fetchWithTimeout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("호출자가 전달한 signal이 중단되면 진행 중인 요청도 중단한다", async () => {
    vi.stubGlobal("fetch", vi.fn((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      }, { once: true });
    })));

    const controller = new AbortController();
    const request = fetchWithTimeout("https://example.test/data", 10_000, {
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("loadStoreScopeCount", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("기본 범위는 금천구만 조회한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { count: 15516, scopes: ["GEUMCHEON"] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadStoreScopeCount()).resolves.toEqual({ count: 15516, scopes: ["GEUMCHEON"] });
    expect(fetchMock.mock.calls[0][0]).toContain("scope=GEUMCHEON");
  });

  it("경계 생활권 선택 시 외부 참고자료 없이 두 범위를 요청한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { count: 24045, scopes: ["GEUMCHEON", "BORDER_AREA"] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadStoreScopeCount("GEUMCHEON,BORDER_AREA")).resolves.toMatchObject({ count: 24045 });
    expect(fetchMock.mock.calls[0][0]).toContain("scope=GEUMCHEON%2CBORDER_AREA");
    expect(fetchMock.mock.calls[0][0]).not.toContain("EXTERNAL_REFERENCE");
  });
});

describe("loadFacilitiesInBbox", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bbox 응답의 백엔드 카테고리 코드를 화면 표준 라벨로 정규화한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 1, category: "SCHOOL_ZONE" },
          { id: 2, category: "PARKING" },
          { id: 3, category: "CCTV" },
        ],
      }),
    }));

    await expect(loadFacilitiesInBbox({
      minLat: 37.4,
      minLng: 126.8,
      maxLat: 37.5,
      maxLng: 126.9,
    })).resolves.toEqual([
      { id: 1, category: "보호구역" },
      { id: 2, category: "주차장" },
      { id: 3, category: "CCTV" },
    ]);
  });

  it("bbox 시설의 모든 페이지를 합쳐 카테고리 현황 누락을 막는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const secondPage = String(url).includes("page=1");
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: secondPage
            ? [{ id: 2, category: "WIFI" }]
            : [{ id: 1, category: "CCTV" }],
          meta: { pagination: { page: secondPage ? 1 : 0, hasNext: !secondPage } },
        }),
      };
    }));

    const result = await loadFacilitiesInBbox({ minLat: 37.4, minLng: 126.8, maxLat: 37.5, maxLng: 126.9 });

    expect(result).toEqual([
      { id: 1, category: "CCTV" },
      { id: 2, category: "와이파이" },
    ]);
  });
});

describe("loadBackendData metadata", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("백엔드 기준시각과 stale 상태를 화면 메타에 반영한다", async () => {
    const payloadByPath = {
      "/api/public/datasets": { success: true, data: [] },
      "/api/public/facilities": {
        success: true,
        data: [],
        meta: { status: "AVAILABLE", source: "시설 원천", collectedAt: "2026-06-21T00:00:00Z" },
      },
      "/api/public/stores": {
        success: true,
        data: [],
        meta: { status: "AVAILABLE", source: "상가 원천", collectedAt: "2026-06-20T23:00:00Z" },
      },
      "/api/public/air-quality": {
        success: true,
        data: [{ districtName: "금천구", grade: "보통", measuredAt: "2026-06-20T20:00:00Z" }],
        meta: { status: "STALE", source: "에어코리아", observedAt: "2026-06-20T20:00:00Z" },
      },
      "/api/public/population": {
        success: true,
        data: [{ areaName: "가산동", total: 1 }],
        meta: { status: "AVAILABLE", source: "행정안전부", collectedAt: "2026-06-01T00:00:00Z" },
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const path = Object.keys(payloadByPath).find((candidate) => String(url).includes(candidate));
      return { ok: true, json: async () => payloadByPath[path] };
    }));
    const localData = {
      metrics: [], facilities: [], population: [],
      meta: {
        overview: { source: "fallback", asOf: "-" },
        life: { source: "fallback", asOf: "-" },
        commercial: { source: "fallback", asOf: "-" },
        population: { source: "fallback", asOf: "-" },
      },
    };

    const result = await loadBackendData(localData);

    expect(result.sourceMode).toBe("mixed");
    expect(result.sourceModeError).toContain("airQuality: 갱신 지연");
    expect(result.meta.overview.source).toBe("에어코리아");
    expect(result.meta.life.source).toBe("시설 원천");
    expect(result.meta.commercial.source).toBe("상가 원천");
    expect(result.meta.population.source).toBe("행정안전부");
  });

  it("최초 DB 시설도 모든 페이지를 합쳐 편향된 첫 페이지로 교체하지 않는다", async () => {
    const basePayloads = {
      datasets: { success: true, data: [] },
      stores: { success: true, data: [] },
      airQuality: { success: true, data: [] },
      population: { success: true, data: [] },
      status: { success: true, data: [] },
    };
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const value = String(url);
      if (value.includes("/facilities")) {
        const secondPage = value.includes("page=1");
        return { ok: true, json: async () => ({
          success: true,
          data: [{ id: secondPage ? 2 : 1, category: secondPage ? "WIFI" : "EV_CHARGER" }],
          meta: { pagination: { hasNext: !secondPage } },
        }) };
      }
      const key = value.includes("datasets/status") ? "status"
        : value.includes("/datasets") ? "datasets"
          : value.includes("/stores") ? "stores"
            : value.includes("air-quality") ? "airQuality" : "population";
      return { ok: true, json: async () => basePayloads[key] };
    }));

    const result = await loadBackendData({
      metrics: [], facilities: [], population: [],
      meta: {
        overview: { source: "fallback", asOf: "-" },
        life: { source: "fallback", asOf: "-" },
        commercial: { source: "fallback", asOf: "-" },
        population: { source: "fallback", asOf: "-" },
      },
    });

    expect(result.facilities.map((item) => item.category)).toEqual(["충전소", "와이파이"]);
  });
});
