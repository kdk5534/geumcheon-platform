// 앱 진입점: 라우터 초기화, 공통 데이터 로드, 각 페이지 모듈 연결

import { state } from "./core/state.js";
import { loadLocalData, loadBackendData, loadApiSources, loadApiLogsRaw } from "./core/api.js";
import { init as initRouter } from "./core/router.js";
import * as homePage from "./pages/home.js";
import * as mapPage from "./pages/map.js";
import * as commercialPage from "./pages/commercial.js";
import * as geoPage from "./pages/geo.js";
import * as apiStatusPage from "./pages/api-status.js";
import * as apiLogsPage from "./pages/api-logs.js";
import * as adminPage from "./pages/admin.js";
import * as populationPage from "./pages/population.js";
import { createStub } from "./pages/stub.js";

// ─── 라우터 초기화 ────────────────────────────────────────────

const viewContainer = document.getElementById("view");

initRouter(viewContainer, {
  home: homePage,
  map: mapPage,
  commercial: commercialPage,
  geo: geoPage,
  population: populationPage,
  api: apiStatusPage,
  "api-logs": apiLogsPage,
  admin: adminPage
}, "home");

// ─── 공통 데이터 로드 ─────────────────────────────────────────

bootData().catch((error) => {
  console.error("데이터 초기화 실패:", error?.message);
});

/**
 * 로컬 데이터를 먼저 렌더하고, 백엔드 데이터를 가져와 갱신한다.
 * 실패해도 로컬 Mock 데이터로 화면을 유지한다.
 */
async function bootData() {
  // 1. 로컬 Mock 데이터를 즉시 렌더
  const localData = await loadLocalData();
  state.data = localData;
  refreshHomeIfVisible();

  // 2. API 소스/로그 로드 (stub 페이지들이 사용할 예정)
  const [apiSourcesRaw, apiLogsRaw] = await Promise.all([
    loadApiSources(),
    loadApiLogsRaw()
  ]);
  state.apiSources = apiSourcesRaw;
  state.apiLogs = apiLogsRaw.data;

  // 3. 백엔드 데이터 병합 (타임아웃 1.5초 이내로 응답 없으면 로컬로 유지)
  state.data = await loadBackendData(localData);
  refreshHomeIfVisible();
  refreshMapIfVisible();
}

/** 현재 홈 페이지가 마운트된 상태면 KPI와 히어로를 갱신한다. */
function refreshHomeIfVisible() {
  if (!document.getElementById("home-metrics")) return;
  homePage.renderMetrics();
  homePage.renderHeroMode();
  // ECharts가 이미 로드된 경우 스파크라인도 함께 갱신
  if (window.echarts && typeof homePage.refreshSparklines === "function") {
    homePage.refreshSparklines();
  }
}

/** 현재 생활지도 페이지가 마운트된 상태면 마커와 목록을 갱신한다. */
function refreshMapIfVisible() {
  if (document.getElementById("map-pane")) {
    mapPage.refresh();
  }
}
