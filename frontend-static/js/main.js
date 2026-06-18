// 앱 진입점: 라우터 초기화, 공통 데이터 로드, 각 페이지 모듈 연결

import { state } from "./core/state.js";
import { loadLocalData, loadBackendData, loadApiSources, loadApiLogsRaw } from "./core/api.js";
import { init as initRouter } from "./core/router.js";
import { icon } from "./core/icons.js";
import * as homePage from "./pages/home.js";
import * as realtimePage from "./pages/realtime.js";
import * as indicatorsPage from "./pages/indicators.js";
import * as catalogPage from "./pages/catalog.js";
import * as mapPage from "./pages/map.js";
import * as commercialPage from "./pages/commercial.js";
import * as geoPage from "./pages/geo.js";
import * as apiStatusPage from "./pages/api-status.js";
import * as apiLogsPage from "./pages/api-logs.js";
import * as adminPage from "./pages/admin.js";
import * as populationPage from "./pages/population.js";
import * as aboutPage from "./pages/about.js";

// ─── 네비 아이콘 주입 ────────────────────────────────────────

(function initNavIcons() {
  const NAV_ICONS = {
    home:        "home",
    realtime:    "activity",
    indicators:  "bar-chart",
    catalog:     "database",
    map:         "map",
    commercial:  "shopping-bag",
    geo:         "filter",
    population:  "users",
    about:       "info",
    api:         "server",
    "api-logs":  "list",
    admin:       "settings"
  };
  document.querySelectorAll(".nav a[data-route]").forEach((link) => {
    const routeKey = link.dataset.route;
    const iconName = NAV_ICONS[routeKey];
    if (!iconName) return;
    const svg = icon(iconName, { size: 15 });
    link.insertAdjacentHTML("afterbegin", `<span class="nav-icon" aria-hidden="true">${svg}</span>`);
  });
}());

// ─── 유틸리티 바 날짜 표시 ───────────────────────────────────

(function initUtilDate() {
  const el = document.getElementById("util-date");
  if (!el) return;
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short"
  });
  el.textContent = fmt.format(now);
}());

// ─── 모바일 네비 햄버거 토글 ─────────────────────────────────

(function initNavToggle() {
  const toggle = document.getElementById("nav-toggle");
  const nav    = document.getElementById("main-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
  });

  // 메뉴 외부 클릭 시 닫기
  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  // 라우트 이동 시 메뉴 닫기
  nav.addEventListener("click", () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  });
}());

// ─── 라우터 초기화 ────────────────────────────────────────────

const viewContainer = document.getElementById("view");

initRouter(viewContainer, {
  home:        homePage,
  realtime:    realtimePage,
  indicators:  indicatorsPage,
  catalog:     catalogPage,
  map:         mapPage,
  commercial:  commercialPage,
  geo:         geoPage,
  population:  populationPage,
  about:       aboutPage,
  api:         apiStatusPage,
  "api-logs":  apiLogsPage,
  admin:       adminPage
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

  // 2. API 소스/로그 로드
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
  refreshPopulationIfVisible();
}

/** 현재 홈 페이지가 마운트된 상태면 KPI와 히어로를 갱신한다. */
function refreshHomeIfVisible() {
  if (!document.getElementById("home-metrics")) return;
  homePage.renderKpiTiles();
  homePage.renderMetrics();
  homePage.renderStatsStrip();
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

/** 현재 인구 분석 페이지가 마운트된 상태면 페이지 전체를 갱신한다. */
function refreshPopulationIfVisible() {
  if (document.getElementById("pop-chart-bar")) {
    populationPage.refresh();
  }
}
