// 백엔드 API 호출 유틸: 데이터를 가져와 반환하되 state에 직접 쓰지 않는다

import { BACKEND_API_BASE, API_TIMEOUT_MS, normalizeCategory, toCategoryCode } from "./state.js";
import { sourceModeText, updateOverviewMeta } from "./meta.js";

/**
 * 타임아웃 기능을 포함한 fetch 래퍼.
 * 응답이 ok가 아닐 경우 에러를 던진다.
 */
export async function fetchWithTimeout(url, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/** ./assets/data/mock-data.json 에서 로컬 데이터를 로드한다. */
export async function loadLocalData() {
  const response = await fetch("./assets/data/mock-data.json");
  return response.json();
}

/**
 * API 소스 목록을 백엔드 또는 번들 JSON에서 로드한다.
 * 실패 시 빈 배열을 반환한다.
 */
export async function loadApiSources() {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/api/public/api-sources`);
    if (response.ok) {
      const payload = await response.json();
      if (payload?.success && Array.isArray(payload.data)) {
        return payload.data;
      }
    }
  } catch {
    // 아래 번들 데이터로 폴백
  }

  try {
    const response = await fetch("./assets/data/api-sources.json");
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * API 로그를 백엔드 또는 번들 JSON에서 로드한다.
 * mergeApiLogEdits는 페이지 모듈에서 처리하므로 원시 데이터를 반환한다.
 */
export async function loadApiLogsRaw() {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/api/public/api-logs`);
    if (response.ok) {
      const payload = await response.json();
      if (payload?.success && Array.isArray(payload.data)) {
        return { source: "backend", data: payload.data };
      }
    }
  } catch {
    // 아래 번들 데이터로 폴백
  }

  try {
    const response = await fetch("./assets/data/api-logs.json");
    const data = await response.json();
    return { source: "local", data: Array.isArray(data) ? data : [] };
  } catch {
    return { source: "local", data: [] };
  }
}

/**
 * 로컬 데이터를 기반으로 백엔드 데이터를 병합해 최종 데이터 객체를 반환한다.
 * 실패 시 localData에 sourceMode:"local" 정보를 추가해 반환한다.
 */
export async function loadBackendData(localData) {
  try {
    const requests = [
      ["datasets", fetchWithTimeout(`${BACKEND_API_BASE}/api/public/datasets`)],
      ["facilities", fetchWithTimeout(`${BACKEND_API_BASE}/api/public/facilities?size=1000`)],
      ["stores", fetchWithTimeout(`${BACKEND_API_BASE}/api/public/stores?size=1000`)],
      ["airQuality", fetchWithTimeout(`${BACKEND_API_BASE}/api/public/air-quality`)],
      ["population", fetchWithTimeout(`${BACKEND_API_BASE}/api/public/population`)]
    ];
    const settled = await Promise.allSettled(requests.map(([, promise]) => promise.then((response) => response.json())));
    const payloads = {};
    const errors = [];

    settled.forEach((result, index) => {
      const [key] = requests[index];
      if (result.status === "fulfilled" && result.value?.success) {
        payloads[key] = result.value;
        return;
      }

      const reason = result.status === "rejected"
        ? (result.reason?.message || "request failed")
        : "response reported failure";
      errors.push(`${key}: ${reason}`);
    });

    if (Object.keys(payloads).length === 0) {
      throw new Error(errors.join(" / ") || "Backend unavailable");
    }

    const datasets = payloads.datasets?.data || [];
    // 백엔드 카테고리 코드(BIKE/CCTV/PARKING/hospital 등)를 한글 표준으로 정규화한다.
    const normalizeFacilities = (arr) =>
      arr.map((f) => ({ ...f, category: normalizeCategory(f.category) }));
    const facilities = Array.isArray(payloads.facilities?.data) && payloads.facilities.data.length > 0
      ? normalizeFacilities(payloads.facilities.data)
      : normalizeFacilities(localData.facilities || []);
    const stores = Array.isArray(payloads.stores?.data) ? payloads.stores.data : [];
    const airQuality = Array.isArray(payloads.airQuality?.data) ? payloads.airQuality.data : [];
    const populationFromBackend = Array.isArray(payloads.population?.data) && payloads.population.data.length > 0;
    const population = populationFromBackend ? payloads.population.data : localData.population;
    const storeCount = stores.length;
    const latestAirQuality = airQuality.find((item) => String(item?.districtName || "").includes("금천")) || airQuality[0] || null;
    const successfulSources = Object.keys(payloads);
    const sourceMode = successfulSources.length === requests.length ? "db" : "mixed";
    const sourceText = sourceModeText(sourceMode);

    const baseMeta = updateOverviewMeta(
      localData.meta,
      sourceMode === "db" ? "금천구 DB 데이터" : "금천구 혼합 데이터"
    );
    const meta = populationFromBackend
      ? { ...baseMeta, population: { source: "행정안전부 주민등록인구", asOf: formatKrTimestamp(payloads.population.timestamp) } }
      : baseMeta;

    return {
      ...localData,
      meta,
      sourceMode,
      sourceModeText: sourceText,
      sourceModeError: errors.length ? errors.join(" / ") : undefined,
      metrics: withBackendMetric(localData.metrics, datasets, storeCount, latestAirQuality),
      facilities,
      population
    };
  } catch (error) {
    return {
      ...localData,
      meta: updateOverviewMeta(localData.meta, "금천구 로컬 샘플"),
      sourceMode: "local",
      sourceModeText: "로컬 샘플",
      sourceModeError: error?.message || "Backend unavailable"
    };
  }
}

/**
 * bbox 기준 목록을 백엔드에서 가져오는 공통 헬퍼.
 * 성공 시 배열(0건 포함), 네트워크/파싱 실패 시 null을 반환한다.
 * 호출부에서 null=실패, []=빈 결과로 구분해 처리한다.
 *
 * @param {string} path API 경로 (예: "/api/public/facilities")
 * @param {{ minLat?:number, minLng?:number, maxLat?:number, maxLng?:number, category?:string, page?:number, size?:number }} opts
 * @returns {Promise<Array|null>}
 */
async function loadItemsInBbox(path, { minLat, minLng, maxLat, maxLng, category, page = 0, size = 200 } = {}) {
  const params = new URLSearchParams({ page, size });
  // undefined/null인 bbox 파라미터는 추가하지 않는다 (String("undefined")가 서버 400을 유발)
  if (minLat != null) params.set("minLat", minLat);
  if (minLng != null) params.set("minLng", minLng);
  if (maxLat != null) params.set("maxLat", maxLat);
  if (maxLng != null) params.set("maxLng", maxLng);
  // 한글 라벨을 백엔드 코드로 역변환한다 (BIKE/CCTV/PARKING 등).
  if (category && category !== "전체") params.set("category", toCategoryCode(category));
  try {
    const response = await fetchWithTimeout(`${BACKEND_API_BASE}${path}?${params}`);
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : null;
  } catch {
    return null;
  }
}

/**
 * 지도 뷰포트 범위(bbox) 기준 시설 목록을 백엔드에서 가져온다.
 * 성공 시 배열(0건 포함), 실패 시 null 반환.
 *
 * @param {{ minLat:number, minLng:number, maxLat:number, maxLng:number, category?:string, page?:number, size?:number }} opts
 * @returns {Promise<Array|null>}
 */
export async function loadFacilitiesInBbox(opts = {}) {
  return loadItemsInBbox("/api/public/facilities", opts);
}

/**
 * 지도 뷰포트 범위(bbox) 기준 상점 목록을 백엔드에서 가져온다.
 * 성공 시 배열(0건 포함), 실패 시 null 반환.
 *
 * @param {{ minLat:number, minLng:number, maxLat:number, maxLng:number, category?:string, page?:number, size?:number }} opts
 * @returns {Promise<Array|null>}
 */
export async function loadStoresInBbox(opts = {}) {
  return loadItemsInBbox("/api/public/stores", opts);
}

/** ISO 8601 타임스탬프를 "YYYY.MM.DD HH:mm" 형식의 한국어 표기로 변환한다. */
function formatKrTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 백엔드 데이터셋·API 수집 결과를 반영해 metrics 배열을 갱신한다. */
export function withBackendMetric(metrics, datasets = [], storeCount = 0, airQuality = null) {
  if (!Array.isArray(datasets) || datasets.length === 0) {
    return metrics.map((metric) => {
      if (metric.label === "상권 점포" && Number(storeCount) > 0) {
        return {
          ...metric,
          value: Number(storeCount).toLocaleString(),
          badge: "API",
          note: "상가업소정보 API 수집 결과"
        };
      }
      if (metric.label === "미세먼지" && airQuality) {
        return {
          ...metric,
          value: airQuality.grade || metric.value,
          badge: "실시간",
          note: `${airQuality.districtName || "서울"} ${airQuality.measuredAt || ""}`.trim()
        };
      }
      return metric;
    });
  }

  return metrics.map((metric) => {
    if (metric.label === "상권 점포" && Number(storeCount) > 0) {
      return {
        ...metric,
        value: Number(storeCount).toLocaleString(),
        badge: "API",
        note: `공공데이터 상가업소 정보 ${Number(storeCount).toLocaleString()}건 수집`
      };
    }

    if (metric.label === "미세먼지" && airQuality) {
      return {
        ...metric,
        value: airQuality.grade || metric.value,
        badge: "실시간",
        note: `${airQuality.districtName || "서울"} ${airQuality.measuredAt || ""}`.trim()
      };
    }

    if (metric.label !== "상권 점포") {
      return metric;
    }

    return {
      ...metric,
      badge: "API",
      note: `백엔드 API 데이터셋 ${datasets.length}종 연결`
    };
  });
}
