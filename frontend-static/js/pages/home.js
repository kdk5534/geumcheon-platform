// 홈 대시보드: 지도 중심 3단 대시보드 + KPI 타일 + 미니 차트 + 공지 패널

import { state } from "../core/state.js";
import { createDataState } from "../core/data-state.js";
import { escapeHtml, revealOnScroll } from "../core/dom.js";
import { getSectionMeta, renderDataStamp, sourceModeText } from "../core/meta.js";
import { loadECharts, createChart, disposeChart, makeGradient, CHART_PALETTE, CHART_COLORS, BASE_OPTION } from "../core/charts.js";
import { icon } from "../core/icons.js";
import { injectPageCss, loadLeaflet, createBaseTileLayer } from "../core/assets.js";
import {
  calcCommercialTotal,
  buildCommercialFallback,
  buildDashHtml,
  buildPopulationFallback,
} from "./home-templates.js";
import { loadHomePopularDatasets, loadHomeRealtimeSummary } from "./home-data.js";

// ─── 상수 ─────────────────────────────────────────────────────

const GEUMCHEON_CENTER = [37.4565, 126.8954];

/** metric 인덱스별 아이콘·테마 (기존 호환) */
const METRIC_CONFIG = [
  { iconName: "activity",  color: "#0c7fb8", bgColor: "#ddf0fc", tip: "최근 환경·기상 지표 (기상청 금천구 관측)" },
  { iconName: "filter",    color: "#b56b17", bgColor: "#fef3e2", tip: "상권·유동인구 현황 (유동인구 분석 기준)" },
  { iconName: "alert",     color: "#bd493c", bgColor: "#fdeeed", tip: "안전·재난 경보 발령 건수 (행안부 집계)" },
  { iconName: "bar-chart", color: "#0d93cf", bgColor: "#d9f0fb", tip: "주민등록 인구 통계 (행정안전부 기준)" },
];

// ─── 모듈-레벨 상태 ───────────────────────────────────────────

const sparklines = [];
let insightChartLeft  = null;
let insightChartRight = null;
let insightChartGeo   = null;
let rightChartDonut   = null;
let rightChartPop     = null;

// 홈 전용 지도 상태
let homeMap           = null;
let homeMarkerLayers  = {};
let homeAllMarkers    = [];

let isMounted = false;
let pageController = null;

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  pageController?.abort();
  pageController = new AbortController();
  const { signal } = pageController;
  isMounted = true;
  await injectPageCss("css-page-home", "./css/pages/home.css");
  if (!isMounted) return;
  container.innerHTML = buildDashHtml();
  bindSearch(container);
  renderKpiTiles();
  renderEnvWidgets();
  renderHeroStats();
  renderHeroMode();
  renderHomeDataState();
  renderMetrics();

  // Leaflet 지도 — 필수. 실패 시에만 에러 메시지 표시.
  try {
    await loadLeaflet();
    if (!isMounted) return;
    initHomeMap();
  } catch (e) {
    const pane = document.getElementById("home-map-pane");
    if (pane && isMounted) {
      pane.innerHTML = `<div class="home-map-error">
        <span class="home-map-error-icon">🗺️</span>
        <span class="home-map-error-title">금천구 생활지도</span>
        <span class="home-map-error-desc">지도를 불러오는 중입니다.<br>인터넷 연결을 확인하거나 잠시 후 새로고침하세요.</span>
        <a href="#/nearby" style="margin-top:8px;font-size:12px;color:#7dd3fa;text-decoration:underline">생활지도 바로가기 →</a>
      </div>`;
    }
  }

  // ECharts (비동기)
  try {
    await loadECharts();
    if (!isMounted) return;
    renderRightDonut();
    renderRightPop();
    renderSparklines();
    animateMetricValues();
    renderInsightCharts();
  } catch {}

  renderPopularDatasets(container, signal);
  revealOnScroll(container);
  renderRealtimeSummary(signal);
}

export function unmount() {
  isMounted = false;
  pageController?.abort();
  pageController = null;

  // Leaflet 정리
  if (homeMap) {
    homeMap.remove();
    homeMap = null;
  }
  homeMarkerLayers = {};
  homeAllMarkers   = [];

  // ECharts 정리
  disposeSparklines();
  disposeChart(insightChartLeft);  insightChartLeft  = null;
  disposeChart(insightChartRight); insightChartRight = null;
  disposeChart(insightChartGeo);   insightChartGeo   = null;
  disposeChart(rightChartDonut);   rightChartDonut   = null;
  disposeChart(rightChartPop);     rightChartPop     = null;
}

// ─── 환경 지표 미니 위젯 (좌 패널) ──────────────────────────

function renderEnvWidgets() {
  const el = document.getElementById("home-env-widgets");
  if (!el) return;

  const metrics = state.data?.metrics;
  if (!metrics?.length) { el.innerHTML = ""; return; }

  const ENV = [
    { label: metrics[0]?.label || "기온",     value: metrics[0]?.value || "—", icon: "☀", color: "#b56b17" },
    { label: metrics[1]?.label || "미세먼지", value: metrics[1]?.value || "—", icon: "💨", color: "#245b9e" },
    { label: metrics[2]?.label || "교통 알림", value: metrics[2]?.value || "—", icon: "🚦", color: "#bd493c" },
  ];

  el.innerHTML = ENV.map((e) => `
    <div class="home-env-item">
      <span class="home-env-icon" aria-hidden="true">${e.icon}</span>
      <div class="home-env-body">
        <span class="home-env-label">${escapeHtml(e.label)}</span>
        <span class="home-env-val" style="color:${e.color}">${escapeHtml(e.value)}</span>
      </div>
    </div>
  `).join("");
}

// ─── KPI 타일 (6개 빽빽한 타일) ─────────────────────────────

export function renderKpiTiles() {
  const grid = document.getElementById("home-kpi-grid");
  if (!grid) return;

  const pop             = state.data?.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
  const facilities      = state.data?.facilities?.length || 0;
  const commercialTotal = calcCommercialTotal();
  const districts       = state.data?.districts || [];
  const avgScore   = districts.length
    ? Math.round(
        districts.reduce((s, d) => {
          const sc  = d.scores || {};
          const vals = Object.values(sc).filter((v) => v > 0);
          return s + (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
        }, 0) / districts.length * 10
      ) / 10
    : 0;
  const tiles = [
    { label: "금천구 총인구", value: pop ? pop.toLocaleString() + "명" : "—", section: "population", change: "행정동별 구성 비교", accent: "#0c7fb8", bg: "#ddf0fc", iconName: "users" },
    { label: "등록 생활시설", value: facilities ? facilities + "건" : "—", section: "life", change: "현재 공간 범위 시설 행", accent: "#0d93cf", bg: "#d9f0fb", iconName: "pin" },
    { label: "상권 점포", value: commercialTotal ? Number(commercialTotal).toLocaleString() + "개" : "—", section: "commercial", change: "업종·행정동별 비교", accent: "#3f7180", bg: "#e8f1f3", iconName: "bar-chart" },
    { label: "평균 접근성 지수", value: avgScore ? avgScore + "점" : "—", section: "geo", change: "생활·교통·안전 평균", accent: "#245b9e", bg: "#e6edf8", iconName: "activity" },
  ];

  grid.innerHTML = tiles.map((t) => {
    const meta = getSectionMeta(t.section);
    const status = homeKpiStatus(meta.status);
    return `
    <article class="home-kpi-tile" style="--kpi-accent:${t.accent};--kpi-bg:${t.bg}">
      <div class="home-kpi-icon" aria-hidden="true">${icon(t.iconName, { size: 14 })}</div>
      <div class="home-kpi-body">
        <span class="home-kpi-label">${escapeHtml(t.label)} · ${escapeHtml(status)}</span>
        <span class="home-kpi-value">${escapeHtml(t.value)}</span>
        <span class="home-kpi-change">${escapeHtml(t.change)}</span>
        <span class="home-kpi-source">${escapeHtml(meta.asOf)} · ${escapeHtml(meta.source)}</span>
      </div>
    </article>`;
  }).join("");
}

export function refreshStaticData() {
  renderEnvWidgets();
  renderHeroStats();
  if (!window.echarts) {
    const commercial = document.getElementById("home-right-donut");
    const population = document.getElementById("home-right-pop");
    if (commercial) commercial.innerHTML = buildCommercialFallback();
    if (population) population.innerHTML = buildPopulationFallback();
  }
}

function homeKpiStatus(status) {
  if (status === "AVAILABLE") return "정상";
  if (status === "STALE") return "갱신 지연";
  if (status === "EXPIRED") return "보존기간 초과";
  if (state.data?.sourceMode === "db") return "운영 데이터";
  if (state.data?.sourceMode === "mixed") return "일부 지연";
  return "샘플";
}

// ─── 홈 지도 초기화 ──────────────────────────────────────────

function initHomeMap() {
  const mapEl = document.getElementById("home-map-pane");
  if (!mapEl || !window.L) return;

  const L = window.L;
  homeMap = L.map(mapEl, {
    zoomControl: true,
    attributionControl: true,
    minZoom: 12,
    maxBounds: [[37.405, 126.82], [37.515, 126.96]],
    maxBoundsViscosity: 0.72,
  }).setView(GEUMCHEON_CENTER, 14);

  createBaseTileLayer(L).addTo(homeMap);

  // 시설 마커 레이어
  ["병원", "약국", "주차장", "안전"].forEach((cat) => {
    homeMarkerLayers[cat] = L.featureGroup().addTo(homeMap);
  });

  buildHomeMarkers();

  // 그리드 레이아웃이 확정된 뒤 Leaflet이 컨테이너 크기를 재계산하도록 한다.
  // (flex: 1 컨테이너에서 L.map() 실행 시 높이가 0으로 잡히는 문제 방지)
  requestAnimationFrame(() => {
    if (homeMap) homeMap.invalidateSize();
  });
}

function buildHomeMarkers() {
  if (!window.L || !homeMap) return;
  const L = window.L;
  const catColor = { "병원": "#0d93cf", "약국": "#0c7fb8", "주차장": "#b56b17", "안전": "#bd493c" };
  const catInit  = { "병원": "병", "약국": "약", "주차장": "P", "안전": "안" };

  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities : [];
  facilities.forEach((f) => {
    const lat = Number(f.latitude);
    const lng = Number(f.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const cat   = f.category || "기타";
    const color = catColor[cat] || "#3d6f99";
    const init  = catInit[cat]  || "F";
    const layer = homeMarkerLayers[cat];
    if (!layer) return;

    const mkIcon = L.divIcon({
      className: "",
      html: `<div class="map-marker-pin" style="background:${color}" title="${escapeHtml(f.name)}">${escapeHtml(init)}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16]
    });
    const popup = [
      `<strong>${escapeHtml(f.name)}</strong>`,
      `<span class="popup-cat">${escapeHtml(cat)}</span>`,
      f.address ? `<small>${escapeHtml(f.address)}</small>` : ""
    ].filter(Boolean).join("<br>");

    layer.addLayer(L.marker([lat, lng], { icon: mkIcon }).bindPopup(popup));
    homeAllMarkers.push({ marker: L.marker([lat, lng]), f, cat });
  });
}

// ─── 우 패널 미니 차트 ────────────────────────────────────────

function renderRightDonut() {
  const el = document.getElementById("home-right-donut");
  if (!el || !window.echarts) return;

  const commercial = state.data?.commercial;
  let categories;

  if (commercial) {
    categories = Object.keys(commercial).map((k) => {
      const byDong = commercial[k]?.byDong;
      const total  = byDong ? byDong.reduce((s, d) => s + (d.count ?? 0), 0) : (commercial[k].total || 0);
      return { name: k, value: total };
    }).filter((c) => c.value > 0);
  } else {
    categories = [
      { name: "음식점", value: 387 }, { name: "카페", value: 142 },
      { name: "학원",   value: 95  }, { name: "편의점", value: 68 },
    ];
  }

  categories.sort((a, b) => a.value - b.value);
  el.innerHTML = "";
  rightChartDonut = createChart(el, {
    ...BASE_OPTION,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (p) =>
        `<div style="font-size:11px"><strong>${p[0].name}</strong>` +
        `<div style="color:#65736d">${Number(p[0].value).toLocaleString()}개</div></div>`,
    },
    grid: { top: 4, bottom: 4, left: 8, right: 36, containLabel: true },
    xAxis: { type: "value", show: false, min: 0 },
    yAxis: {
      type: "category",
      data: categories.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 10, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    series: [{
      type: "bar",
      data: categories.map((item) => item.value),
      barMaxWidth: 16,
      label: { show: true, position: "right", color: CHART_COLORS.text, fontSize: 9,
        formatter: (p) => Number(p.value).toLocaleString() },
      itemStyle: { color: CHART_PALETTE[0], borderRadius: [0, 3, 3, 0] },
    }],
    animation: true,
  });
}

function renderRightPop() {
  const el = document.getElementById("home-right-pop");
  if (!el || !window.echarts) return;

  const population = state.data?.population;
  if (!population?.length) return;

  const names  = population.map((d) => d.areaName);
  const totals = population.map((d) => d.total ?? 0);

  el.innerHTML = "";
  rightChartPop = createChart(el, {
    ...BASE_OPTION,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const p = params[0];
        return `<div style="font-size:11px"><strong>${p.name}</strong>` +
          `<div style="color:#65736d">총 ${Number(p.value).toLocaleString()}명</div></div>`;
      },
    },
    grid: { top: 4, bottom: 24, left: 4, right: 4 },
    xAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 10, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    yAxis: { type: "value", show: false },
    series: [{
      type: "bar",
      data: totals,
      barMaxWidth: 36,
      itemStyle: {
        color: (params) => makeGradient(CHART_PALETTE[params.dataIndex % CHART_PALETTE.length]),
        borderRadius: [4, 4, 0, 0],
      },
      label: {
        show: true, position: "top",
        formatter: (p) => (p.value / 10000).toFixed(1) + "만",
        color: CHART_COLORS.text, fontSize: 10,
      },
    }],
    animation: true,
  });
}

// ─── 기존 KPI 카드 (하단 섹션) ────────────────────────────────

function disposeSparklines() {
  sparklines.forEach((c) => { try { c.dispose(); } catch {} });
  sparklines.length = 0;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 카운터 숫자 애니메이션 공통 유틸
function animateCounter(el, target, { suffix = "", duration = 1000, decimal = false } = {}) {
  if (!el || !target) return;
  let startTime = null;
  const step = (ts) => {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = eased * target;
    el.textContent = decimal
      ? current.toFixed(1) + suffix
      : Math.floor(current).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function animateMetricValues() {
  if (!state.data?.metrics) return;
  document.querySelectorAll(".metric-value[data-target]").forEach((el) => {
    const target = parseFloat(el.dataset.target);
    if (isNaN(target) || target === 0) return;
    animateCounter(el, target, {
      suffix:   el.dataset.suffix || "",
      duration: 1000,
      decimal:  !Number.isInteger(target),
    });
  });
}

export function renderMetrics() {
  const grid = document.getElementById("home-metrics");
  if (!grid) return;

  if (!state.data?.metrics) {
    grid.innerHTML = Array.from({ length: 4 }).map(() => `<div class="metric-card skeleton-card"></div>`).join("");
    return;
  }

  grid.innerHTML = state.data.metrics.map((metric, idx) => {
    const cfg     = METRIC_CONFIG[idx] || METRIC_CONFIG[0];
    const trendDir = getTrendDirection(metric.trend);
    const match   = String(metric.value).match(/^([\d,]+(?:\.\d+)?)(.*)/);
    const rawNum  = match ? match[1].replace(/,/g, "") : "";
    const numVal  = match ? parseFloat(rawNum) : NaN;
    const suffix  = match ? match[2].trim() : "";
    const hasCounter = !isNaN(numVal) && numVal > 1;
    const badgeLabel = metric.badge === "실시간" ? "최근" : metric.badge;

    return `
    <article class="metric-card" style="--metric-accent:${cfg.color}">
      <div class="metric-card-header">
        <sl-tooltip content="${escapeHtml(cfg.tip)}" placement="bottom">
          <div class="metric-icon-wrap" style="background:${cfg.bgColor};color:${cfg.color}">
            ${icon(cfg.iconName, { size: 18 })}
          </div>
        </sl-tooltip>
        <div class="metric-card-meta">
          <span class="metric-label">${escapeHtml(metric.label)}</span>
          <span class="metric-badge">${escapeHtml(badgeLabel)}</span>
        </div>
      </div>
      <div class="metric-value${hasCounter ? "" : " metric-value--text"}"
           ${hasCounter ? `data-target="${numVal}" data-suffix="${escapeHtml(suffix)}"` : ""}>
        ${hasCounter ? "0" + escapeHtml(suffix) : escapeHtml(metric.value)}
      </div>
      ${metric.trend ? `<div class="metric-sparkline" data-metric-idx="${idx}"></div>` : ""}
      <div class="metric-footer">
        <p class="metric-note">${escapeHtml(metric.note)}</p>
        ${trendDir ? `<span class="metric-trend metric-trend--${trendDir.dir}">${trendDir.label}</span>` : ""}
      </div>
    </article>
    `;
  }).join("");

  requestAnimationFrame(() => animateMetricValues());
}

function getTrendDirection(trend) {
  if (!trend?.length || trend.length < 2) return null;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const diff = last - prev;
  if (Math.abs(diff) < 0.001) return null;
  return diff > 0
    ? { dir: "up",   label: `▲ ${Math.abs(diff % 1 === 0 ? diff : diff.toFixed(1))}` }
    : { dir: "down", label: `▼ ${Math.abs(diff % 1 === 0 ? diff : diff.toFixed(1))}` };
}

function renderSparklines() {
  disposeSparklines();
  if (!state.data?.metrics) return;
  state.data.metrics.forEach((metric, idx) => {
    if (!metric.trend?.length) return;
    const el = document.querySelector(`.metric-sparkline[data-metric-idx="${idx}"]`);
    if (!el) return;
    const cfg      = METRIC_CONFIG[idx] || METRIC_CONFIG[0];
    const values   = metric.trend.map((t) => t.value ?? t);
    const lineColor = cfg.color;
    const areaTop  = hexToRgba(lineColor, 0.18);
    const areaBot  = hexToRgba(lineColor, 0);
    el.classList.add("is-chart-ready");
    const chart    = window.echarts.init(el, null, { renderer: "svg" });
    chart.setOption({
      backgroundColor: "transparent",
      grid: { top: 2, bottom: 2, left: 2, right: 2 },
      xAxis: { type: "category", show: false, data: values.map((_, i) => i) },
      yAxis: { type: "value", show: false, min: "dataMin", max: "dataMax" },
      series: [{
        type: "line", data: values, smooth: true, symbol: "none",
        lineStyle: { color: lineColor, width: 1.8 },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: areaTop }, { offset: 1, color: areaBot }] }
        }
      }],
      animation: false
    });
    sparklines.push(chart);
  });
}

export function refreshSparklines() { renderSparklines(); }

export function renderHeroMode() {
  const badge   = document.getElementById("home-mode-badge");
  const eyebrow = document.getElementById("home-eyebrow");
  if (!state.data) return;
  const tone = getHomeStateTone();
  const sourceText = sourceModeText(state.data.sourceMode);
  const { asOf } = getSectionMeta("overview");
  if (eyebrow) eyebrow.textContent = `${asOf} 기준 · ${sourceText}`;
  if (badge) {
    const hint = state.data.sourceModeError ? " · 일부 지연" : "";
    badge.className = `home-mode-badge home-mode-badge--${tone}`;
    badge.textContent = `${sourceText}${hint}`;
  }
}

function getHomeStateTone() {
  return getHomeDataState().tone;
}

function getHomeDataState() {
  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities.length : 0;
  return createDataState({
    hasData: facilities > 0,
    sourceMode: state.data?.sourceMode,
    error: state.data?.sourceModeError,
    sourceName: state.data?.meta?.overview?.source,
    collectedAt: state.data?.meta?.overview?.asOf,
  });
}

function getHomeStateMeta() {
  const dataState = getHomeDataState();
  const details = getHomeStateMetaDetails();
  return { ...details, tone: dataState.tone, label: dataState.label };
}

function getHomeStateMetaDetails() {
  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities.length : 0;

  if (!facilities) {
    return {
      tone: "muted",
      label: "데이터 대기",
      title: "표시 가능한 생활 시설 데이터가 아직 없습니다.",
      note: "초기 적재 또는 연결 상태를 확인한 뒤 홈 대시보드 요약을 갱신합니다.",
    };
  }

  if (state.data?.sourceModeError && state.data?.sourceMode === "mixed") {
    return {
      tone: "warn",
      label: "일부 지연",
      title: "원천 응답 일부가 지연되어 혼합 데이터로 화면을 유지하고 있습니다.",
      note: "핵심 요약은 계속 제공되지만 일부 패널은 직전 기준 시각 데이터를 보여줄 수 있습니다.",
    };
  }

  if (state.data?.sourceModeError && !state.data?.sourceMode) {
    return {
      tone: "err",
      label: "연결 오류",
      title: "데이터 연결 오류가 있어 홈 화면을 정상적으로 갱신하지 못했습니다.",
      note: "잠시 후 다시 시도하거나 데이터 원본 연결 상태를 점검해 주세요.",
    };
  }

  if (state.data?.sourceMode === "db") {
    return {
      tone: "ok",
      label: "운영 데이터",
      title: "오늘의 금천 화면이 DB 기반 최신 데이터로 구성되었습니다.",
      note: "주요 KPI와 시설 요약, 지도 패널이 같은 기준 시각을 사용합니다.",
    };
  }

  if (state.data?.sourceMode === "mixed") {
    return {
      tone: "warn",
      label: "혼합 데이터",
      title: "일부 섹션은 최신 응답, 일부 섹션은 캐시된 데이터를 함께 사용하고 있습니다.",
      note: "섹션별 기준 시각을 함께 표시해 해석 혼선을 줄였습니다.",
    };
  }

  return {
    tone: "info",
    label: "샘플 데이터",
    title: "홈 대시보드가 로컬 샘플 데이터로 동작 중입니다.",
    note: "UI 구조와 탐색 흐름 검증에는 충분하지만 수치는 운영 데이터와 다를 수 있습니다.",
  };
}

export function renderHomeDataState() {
  const el = document.getElementById("home-data-state");
  if (!el) return;

  const meta = getHomeStateMeta();
  el.innerHTML = `
    <div class="home-data-state-card">
      <div class="home-data-state-head">
        <span class="home-state-pill home-state-pill--${meta.tone}">${escapeHtml(meta.label)}</span>
        <span class="home-data-state-title">${escapeHtml(meta.title)}</span>
      </div>
      <p class="home-data-state-note">${escapeHtml(meta.note)}</p>
      ${renderDataStamp("overview", "오늘의 금천")}
    </div>
  `;
}

function renderHeroStats() {
  const wrap = document.getElementById("home-hero-stats");
  if (!wrap) return;

  const sources    = Array.isArray(state.apiSources) ? state.apiSources : [];
  const total      = sources.length || 6;
  const ready      = sources.filter((s) => s.status === "ready").length;
  const pop        = state.data?.population?.[0]?.total;
  const facilities = state.data?.facilities?.length;

  wrap.innerHTML = `
    <div class="home-stat-card">
      <span>데이터 소스</span>
      <strong data-counter="${total}" data-suffix="종">${total}종</strong>
    </div>
    <div class="home-stat-card">
      <span>수집 정상</span>
      <strong class="${ready > 0 ? "ok" : "pending"}"${ready > 0 ? ` data-counter="${ready}" data-suffix="종"` : ""}>${ready > 0 ? ready + "종" : "대기"}</strong>
    </div>
    <div class="home-stat-card">
      <span>등록 시설</span>
      <strong${facilities != null ? ` data-counter="${facilities}" data-suffix="건"` : ""}>${facilities != null ? facilities + "건" : "—"}</strong>
    </div>
    <div class="home-stat-card">
      <span>가산동 인구</span>
      <strong${pop ? ` data-counter="${pop}" data-suffix="명"` : ""}>${pop ? pop.toLocaleString() + "명" : "—"}</strong>
    </div>
  `;
  animateHeroCounters(wrap);
}

function animateHeroCounters(wrap) {
  wrap.querySelectorAll("[data-counter]").forEach((el) => {
    const target = parseInt(el.dataset.counter, 10);
    if (!target || target === 0) return;
    animateCounter(el, target, { suffix: el.dataset.suffix || "", duration: 900 });
  });
}

export function renderStatsStrip() {
  if (!state.data) return;
  const pop             = state.data.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
  const commercialTotal = calcCommercialTotal();
  const facilities      = state.data.facilities?.length || 0;
  const sources         = (Array.isArray(state.apiSources) ? state.apiSources.length : 0) || 6;

  const popEl = document.getElementById("strip-population");
  const comEl = document.getElementById("strip-commercial");
  const facEl = document.getElementById("strip-facilities");
  const srcEl = document.getElementById("strip-sources");
  if (pop > 0)             { popEl && (popEl.textContent = "0명"); animateCounter(popEl, pop,             { suffix: "명", duration: 1200 }); }
  if (commercialTotal > 0) { comEl && (comEl.textContent = "0");   animateCounter(comEl, commercialTotal, { suffix: "",   duration: 1200 }); }
  if (facilities > 0)      { facEl && (facEl.textContent = "0건"); animateCounter(facEl, facilities,      { suffix: "건", duration: 1200 }); }
  if (sources > 0)         { srcEl && (srcEl.textContent = "0종"); animateCounter(srcEl, sources,         { suffix: "종", duration: 1200 }); }
}

function renderInsightCharts() {
  if (!state.data || !window.echarts) return;
  renderInsightCommercial();
  renderInsightPopulation();
  renderInsightGeo();
}

function renderInsightCommercial() {
  const el = document.getElementById("insight-commercial-chart");
  if (!el) return;
  const commercial = state.data.commercial;
  if (!commercial) return;
  const categories = [], values = [];
  Object.keys(commercial).forEach((ind) => {
    const byDong = commercial[ind]?.byDong;
    if (!byDong?.length) return;
    const total = byDong.reduce((s, d) => s + (d.count ?? 0), 0);
    categories.push(ind);
    values.push(total);
  });
  if (!categories.length) return;
  insightChartLeft = createChart(el, {
    ...BASE_OPTION,
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params) => {
        const bar  = params.find((p) => p.seriesType === "bar");
        if (!bar) return "";
        return `<div style="font-size:12px"><strong>${bar.name}</strong>` +
          `<div style="color:#65736d">${Number(bar.value).toLocaleString()}개</div></div>`;
      }
    },
    legend: { show: false },
    grid: { top: 8, bottom: 28, left: 8, right: 8 },
    xAxis: {
      type: "category", data: categories,
      axisLine: { lineStyle: { color: CHART_COLORS.line } }, axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 10, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    yAxis: { type: "value", show: false, min: 0 },
    series: [
      { type: "bar", data: values, barMaxWidth: 36,
        itemStyle: { color: (params) => CHART_PALETTE[params.dataIndex % CHART_PALETTE.length], borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: "top", color: CHART_COLORS.text, fontSize: 9,
                 formatter: (p) => Number(p.value).toLocaleString() } },
    ],
    animation: true,
  });
}

function renderInsightPopulation() {
  const el = document.getElementById("insight-population-chart");
  if (!el) return;
  const population = state.data?.population;
  if (!population?.length) return;
  const names  = population.map((d) => d.areaName);
  const totals = population.map((d) => d.total ?? 0);
  const ELDERLY = ["60~69세", "70세 이상"];
  const elderlyRates = population.map((d) => {
    const byAge = d.byAge || [];
    const elderly = byAge.filter((b) => ELDERLY.includes(b.ageBand))
      .reduce((s, b) => s + (b.male || 0) + (b.female || 0), 0);
    return d.total ? +(elderly / d.total * 100).toFixed(1) : 0;
  });

  insightChartRight = createChart(el, {
    ...BASE_OPTION,
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params) => {
        const bar  = params.find((p) => p.seriesType === "bar");
        const line = params.find((p) => p.seriesType === "line");
        if (!bar) return "";
        return `<div style="font-size:12px"><strong>${bar.name}</strong>` +
          `<div style="color:#65736d">총 ${Number(bar.value).toLocaleString()}명` +
          (line ? ` · <span style="color:#3f7180">고령 ${line.value}%</span>` : "") + `</div></div>`;
      }
    },
    legend: { show: false },
    grid: { top: 8, bottom: 28, left: 8, right: 40 },
    xAxis: {
      type: "category", data: names,
      axisLine: { lineStyle: { color: CHART_COLORS.line } }, axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    yAxis: [
      { type: "value", show: false },
      { type: "value", show: true, max: 30, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: CHART_COLORS.text, fontSize: 9, formatter: "{value}%", fontFamily: BASE_OPTION.textStyle.fontFamily } },
    ],
    series: [
      { type: "bar", data: totals, yAxisIndex: 0, barMaxWidth: 56,
        itemStyle: { color: (params) => makeGradient(CHART_PALETTE[params.dataIndex % CHART_PALETTE.length]), borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: "top", formatter: (p) => (p.value / 10000).toFixed(1) + "만",
                 color: CHART_COLORS.text, fontSize: 11 } },
      { type: "line", data: elderlyRates, yAxisIndex: 1, smooth: true,
        lineStyle: { color: "#3f7180", width: 2 }, symbol: "circle", symbolSize: 5,
        itemStyle: { color: "#3f7180" } },
    ],
    animation: true,
  });
}

function renderInsightGeo() {
  const el = document.getElementById("insight-geo-chart");
  if (!el) return;
  const districts = state.data?.districts;
  if (!districts?.length) return;
  const names  = districts.map((d) => d.name);
  const lifeScores    = districts.map((d) => d.scores?.생활  || 0);
  const trafficScores = districts.map((d) => d.scores?.교통  || 0);
  const safetyScores  = districts.map((d) => d.scores?.안전  || 0);

  insightChartGeo = createChart(el, {
    ...BASE_OPTION,
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params) => {
        const name = escapeHtml(params[0]?.name || "");
        const parts = params.map((p) => `<span style="color:${p.color}">■</span> ${escapeHtml(p.seriesName)}: <strong>${p.value}</strong>점`).join("<br>");
        return `<div style="font-size:11px"><strong>${name}</strong><br>${parts}</div>`;
      }
    },
    legend: {
      bottom: 0, itemWidth: 8, itemHeight: 8,
      textStyle: { color: CHART_COLORS.text, fontSize: 10, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    grid: { top: 8, bottom: 36, left: 8, right: 8 },
    xAxis: {
      type: "category", data: names,
      axisLine: { lineStyle: { color: CHART_COLORS.line } }, axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    yAxis: { type: "value", show: false, max: 100 },
    series: [
      { name: "생활", type: "bar", data: lifeScores, stack: "score", barMaxWidth: 36,
        itemStyle: { color: "#0c7fb8" },
        label: { show: false } },
      { name: "교통", type: "bar", data: trafficScores, stack: "score",
        itemStyle: { color: "#0d93cf" },
        label: { show: false } },
      { name: "안전", type: "bar", data: safetyScores, stack: "score",
        itemStyle: { color: "#245b9e", borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: "top", fontSize: 10, color: CHART_COLORS.text,
                 formatter: (p) => {
                   const d = districts[p.dataIndex];
                   const sc = d?.scores || {};
                   const avg = Math.round(([sc.생활, sc.교통, sc.안전].filter(Boolean).reduce((a, b) => a + b, 0)) / 3);
                   return avg + "점";
                 } } },
    ],
    animation: true,
  });
}

// ─── 검색 ─────────────────────────────────────────────────────

function bindSearch(container) {
  const form  = container.querySelector(".home-search-form");
  const input = container.querySelector(".home-search-input");
  if (!form || !input) return;

  const ROUTE_MAP = {
    "상황판": "home", "홈": "home", "오늘": "home", "오늘의금천": "home",
    "카탈로그": "datasets", "데이터카탈로그": "datasets", "데이터셋": "datasets", "데이터찾기": "datasets",
    "생활지도": "nearby", "내주변": "nearby", "지도": "nearby", "시설": "nearby",
    "상권": "topics?topic=economy", "상권분석": "topics?topic=economy", "카페": "topics?topic=economy", "음식점": "topics?topic=economy",
    "집계구": "dong", "집계": "dong", "권역": "dong", "우리동": "dong",
    "인구": "dong?section=population", "인구분석": "dong?section=population",
    "분야별": "topics", "실시간": "topics?topic=safety", "안전": "topics?topic=safety"
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = input.value.trim().toLowerCase().replace(/\s+/g, "");
    if (!query) return;
    const key = Object.keys(ROUTE_MAP).find((k) =>
      k.toLowerCase() === query || k.toLowerCase().includes(query) || query.includes(k.toLowerCase())
    );
    if (key) {
      location.hash = `#/${ROUTE_MAP[key]}`;
    } else {
      input.classList.add("is-error");
      input.setCustomValidity("일치하는 화면을 찾지 못했습니다.");
      input.reportValidity();
      setTimeout(() => { input.setCustomValidity(""); input.classList.remove("is-error"); }, 2000);
    }
    input.value = "";
  });

  input.addEventListener("input", () => {
    input.setCustomValidity("");
    input.classList.remove("is-error");
  });
}

// ─── 인기 데이터셋 렌더 ────────────────────────────────────────

async function renderPopularDatasets(container, signal) {
  try {
    const top = await loadHomePopularDatasets({ signal });
    if (!isMounted) return;
    const grid = container.querySelector("#home-popular-datasets");
    if (!grid || !top.length) return;
    const CAT_COLORS = {
      교통물류: { bg: "var(--teal-wash)",   fg: "var(--teal)" },
      환경기상: { bg: "var(--blue-wash)",   fg: "var(--blue)" },
      사회복지: { bg: "var(--green-wash)",  fg: "var(--green)" },
      공공행정: { bg: "var(--navy-wash)",   fg: "var(--navy)" },
      보건의료: { bg: "var(--amber-wash)",  fg: "var(--amber)" },
      문화관광: { bg: "var(--violet-wash)", fg: "var(--violet)" },
      산업고용: { bg: "var(--blue-wash)",   fg: "var(--blue)" },
      재난안전: { bg: "var(--red-wash)",    fg: "var(--red)" },
    };
    grid.innerHTML = top.map((d) => {
      const color = CAT_COLORS[d.category] || { bg: "var(--wash)", fg: "var(--muted)" };
      const views = Number(d.views || 0).toLocaleString();
      const types = (d.types || []).slice(0, 3).join(" · ");
      return `
        <a class="home-popular-card" href="#/datasets" aria-label="${escapeHtml(d.title)} 데이터셋 보기">
          <span class="home-popular-cat" style="background:${color.bg};color:${color.fg}">${escapeHtml(d.category)}</span>
          <strong class="home-popular-title">${escapeHtml(d.title)}</strong>
          <p class="home-popular-org">${escapeHtml(d.org)}</p>
          <div class="home-popular-meta">
            <span>${escapeHtml(types)}</span>
            <span>${icon("list", { size: 11 })} ${views}회</span>
          </div>
        </a>
      `;
    }).join("");
  } catch { /* 스켈레톤 유지 */ }
}

// ─── 실시간 현황 요약 (우 패널 상단) ─────────────────────────

async function renderRealtimeSummary(signal) {
  try {
    const s = await loadHomeRealtimeSummary({ signal });
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? "—";
    };
    set("rt-critical", s.critical ?? 0);
    set("rt-warning",  s.warning  ?? 0);
    set("rt-normal",   s.normal   ?? 0);
  } catch { /* 데이터 없으면 — 유지 */ }
}
