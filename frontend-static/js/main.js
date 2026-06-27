// 앱 진입점: 라우터 초기화, 공통 데이터 로드, 각 페이지 모듈 연결

import { state } from "./core/state.js";
import { loadLocalData, loadBackendData, loadApiSources, loadApiLogsRaw } from "./core/api.js";
import { init as initRouter, navigate as routerNavigate } from "./core/router.js";
import { icon } from "./core/icons.js";
import { initShellUi, updateDataHealth } from "./core/shell-ui.js";
import { initI18n, applyTranslations } from "./core/i18n.js";
import * as homePage from "./pages/home.js";
import * as realtimePage from "./pages/realtime.js";
import * as safetyPage from "./pages/safety.js";
import * as indicatorsPage from "./pages/indicators.js";
import * as catalogPage from "./pages/catalog.js";
import * as mapPage from "./pages/map.js";
import * as commercialPage from "./pages/commercial.js";
import * as geoPage from "./pages/geo.js";
import * as dongPage from "./pages/dong.js";
import * as topicsPage from "./pages/topics.js";
import * as populationPage from "./pages/population.js";
import * as welfarePage from "./pages/welfare.js";
import * as aboutPage from "./pages/about.js";

document.title = "금천 데이터플랫폼";

function lazyPage(loader) {
  let module = null;
  let mountSequence = 0;
  return {
    async mount(container) {
      const sequence = ++mountSequence;
      module ||= await loader();
      if (sequence !== mountSequence) return;
      return module.mount(container);
    },
    unmount() {
      mountSequence += 1;
      module?.unmount?.();
    },
  };
}

const apiStatusPage = lazyPage(() => import("./pages/api-status.js"));
const apiLogsPage = lazyPage(() => import("./pages/api-logs.js"));
const adminPage = lazyPage(() => import("./pages/admin.js"));

await initI18n();
initShellUi();
applyTranslations();

// ─── 테마 초기화 + 다크모드 토글 ───────────────────────────────

(function initTheme() {
  const THEME_KEY = "geumcheon-theme";
  const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const SUN_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("util-theme-toggle");
    if (!btn) return;
    if (theme === "dark") {
      btn.innerHTML = SUN_SVG;
      btn.setAttribute("aria-label", "라이트 모드로 전환");
    } else {
      btn.innerHTML = MOON_SVG;
      btn.setAttribute("aria-label", "다크 모드로 전환");
    }
  }

  // 저장된 테마로 즉시 적용 (FOUC 방지)
  const requestedTheme = new URL(location.href).searchParams.get("theme");
  const saved = ["light", "dark"].includes(requestedTheme) ? requestedTheme : (localStorage.getItem(THEME_KEY) || "light");
  applyTheme(saved);

  // 토글 핸들러 — 전환 후 현재 페이지를 remount하여 차트·지도를 새 토큰으로 재생성한다
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#util-theme-toggle")) return;
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
    const url = new URL(location.href);
    if (next === "light") url.searchParams.delete("theme");
    else url.searchParams.set("theme", next);
    history.replaceState(null, "", url);
    routerNavigate();
  });
}());

// ─── 네비 아이콘 주입 ────────────────────────────────────────

(function initNavIcons() {
  const NAV_ICONS = {
    home:       "home",
    population: "users",
    commercial: "bar-chart",
    welfare:    "activity",
    safety:     "shield",
    catalog:    "database"
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
  safety:      safetyPage,
  indicators:  indicatorsPage,
  catalog:     catalogPage,
  map:         mapPage,
  dong:        dongPage,
  commercial:  commercialPage,
  topics:      topicsPage,
  geo:         geoPage,
  population:  populationPage,
  welfare:     welfarePage,
  about:       aboutPage,
  api:         apiStatusPage,
  "api-logs":  apiLogsPage,
  admin:       adminPage
}, "home");

// ─── 공통 데이터 로드 ─────────────────────────────────────────

document.documentElement.dataset.appDataState = "loading";
bootData()
  .catch((error) => {
    document.documentElement.dataset.appDataState = "error";
    console.error("데이터 초기화 실패:", error?.message);
  })
  .finally(() => {
    if (document.documentElement.dataset.appDataState !== "error") {
      document.documentElement.dataset.appDataState = "ready";
    }
    updateDataHealth();
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
  refreshMapIfVisible();
  refreshPopulationIfVisible();
  refreshDongIfVisible();
  refreshTopicsIfVisible();
  refreshPulseBar();

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
  refreshDongIfVisible();
  refreshTopicsIfVisible();
  refreshPulseBar();
}

/** PULSE BAR 수치를 state.data 기반으로 채운다. */
function refreshPulseBar() {
  const d = state.data;
  if (!d) return;

  function set(id, val) {
    const el = document.getElementById(id);
    if (el && val != null) el.textContent = val;
  }

  // metrics 배열에서 label로 값 조회
  const metrics = Array.isArray(d.metrics) ? d.metrics : [];
  const byLabel = {};
  metrics.forEach(m => { if (m.label) byLabel[m.label] = m.value; });

  set("pulse-temp",    byLabel["기온"]      ?? null);
  set("pulse-air",     byLabel["미세먼지"]  ?? null);
  set("pulse-traffic", byLabel["교통 알림"] ?? null);
  set("pulse-stores",  byLabel["상권 점포"] ?? null);

  // 인구: population 배열 합산
  const pop = Array.isArray(d.population) ? d.population : [];
  if (pop.length > 0) {
    const total = pop.reduce((sum, row) => sum + (row.total ?? row.populationTotal ?? 0), 0);
    if (total > 0) set("pulse-pop", total.toLocaleString("ko-KR") + "명");
  }
}

/** 현재 홈 페이지가 마운트된 상태면 KPI와 히어로를 갱신한다. */
function refreshHomeIfVisible() {
  if (!document.getElementById("home-metrics")) return;
  homePage.renderKpiTiles();
  homePage.renderMetrics();
  homePage.renderStatsStrip();
  homePage.renderHeroMode();
  homePage.renderHomeDataState();
  homePage.refreshStaticData();
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

/** 현재 우리 동 허브가 마운트된 상태면 선택·비교 요약을 갱신한다. */
function refreshDongIfVisible() {
  if (document.querySelector(".dong-page")) {
    dongPage.refresh();
  }
}

/** 현재 분야별 허브가 마운트된 상태면 질문 카드와 데이터 상태를 갱신한다. */
function refreshTopicsIfVisible() {
  if (document.querySelector(".topics-page")) {
    topicsPage.refresh();
  }
}
