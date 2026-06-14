// 홈 대시보드: 지도 중심 3단 대시보드 + KPI 타일 + 미니 차트 + 공지 패널

import { state } from "../core/state.js";
import { escapeHtml, revealOnScroll } from "../core/dom.js";
import { getSectionMeta, sourceModeText } from "../core/meta.js";
import { loadECharts, createChart, disposeChart, makeGradient, CHART_PALETTE, CHART_COLORS, BASE_OPTION } from "../core/charts.js";
import { icon } from "../core/icons.js";

// ─── 상수 ─────────────────────────────────────────────────────

const GEUMCHEON_CENTER = [37.4565, 126.8954];
const CHOROPLETH_METRICS = ["생활", "교통", "안전", "인구"];

/** metric 인덱스별 아이콘·테마 (기존 호환) */
const METRIC_CONFIG = [
  { iconName: "activity",  color: "#146b4a", bgColor: "#e6f1ed", tip: "실시간 환경·기상 지표 (기상청 금천구 관측)" },
  { iconName: "filter",    color: "#b56b17", bgColor: "#fef3e2", tip: "상권·유동인구 현황 (유동인구 분석 기준)" },
  { iconName: "alert",     color: "#bd493c", bgColor: "#fdeeed", tip: "안전·재난 경보 발령 건수 (행안부 집계)" },
  { iconName: "bar-chart", color: "#245b9e", bgColor: "#e6edf8", tip: "주민등록 인구 통계 (행정안전부 기준)" },
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
let homeChoropleth    = null;
let homeMarkerLayers  = {};
let homeAllMarkers    = [];
let homeChoroplethMetric = "생활";

let clockInterval = null;
let isMounted = false;

// ─── CSS / Leaflet 동적 로드 ─────────────────────────────────

function injectCss() {
  if (!document.getElementById("css-page-home")) {
    const link = document.createElement("link");
    link.id = "css-page-home";
    link.rel = "stylesheet";
    link.href = "./css/pages/home.css";
    document.head.appendChild(link);
  }
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-js");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet 로드 실패")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Leaflet 로드 실패"));
    document.head.appendChild(script);
  });
}

function loadGeoJson() {
  return fetch("./assets/data/geumcheon-dong.geojson").then((r) => {
    if (!r.ok) throw new Error("GeoJSON 로드 실패");
    return r.json();
  });
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  isMounted = true;
  injectCss();
  container.innerHTML = buildDashHtml();
  bindSearch(container);
  renderKpiTiles();
  renderEnvWidgets();
  renderHeroStats();
  bindMapMetricToggle(container);

  // Leaflet 지도 (비동기)
  try {
    await loadLeaflet();
    if (!isMounted) return;
    initHomeMap();

    const geojson = await loadGeoJson();
    if (!isMounted) return;
    initHomeChoropleth(geojson);
    renderHomeMapLegend();
  } catch (e) {
    const pane = document.getElementById("home-map-pane");
    if (pane && isMounted) {
      pane.innerHTML = `<div class="home-map-error">지도를 불러올 수 없습니다.<br>인터넷 연결을 확인해 주세요.</div>`;
    }
  }

  // ECharts (비동기)
  try {
    await loadECharts();
    if (!isMounted) return;
    renderRightDonut();
    renderRightPop();
    renderMetrics();
    renderSparklines();
    animateMetricValues();
    renderInsightCharts();
  } catch {}

  renderPopularDatasets(container);
  revealOnScroll(container);
  startClock();
}

export function unmount() {
  isMounted = false;

  // 시계 정리
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }

  // Leaflet 정리
  if (homeMap) {
    homeMap.remove();
    homeMap = null;
  }
  homeChoropleth   = null;
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

// ─── 실시간 시계 ──────────────────────────────────────────────

function startClock() {
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function tick() {
    const el = document.getElementById("home-clock-time");
    const dateEl = document.getElementById("home-clock-date");
    if (!el) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    el.textContent = `${hh}:${mm}:${ss}`;

    if (dateEl) {
      const M  = now.getMonth() + 1;
      const D  = now.getDate();
      const wd = DAYS[now.getDay()];
      dateEl.textContent = `${M}월 ${D}일 (${wd})`;
    }
  }

  tick();
  clockInterval = setInterval(tick, 1000);
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

function renderKpiTiles() {
  const grid = document.getElementById("home-kpi-grid");
  if (!grid) return;

  const pop        = state.data?.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
  const facilities = state.data?.facilities?.length || 0;
  const commercial = state.data?.commercial;
  const commercialTotal = commercial
    ? Object.values(commercial).reduce((s, cat) => {
        const byDong = cat?.byDong;
        return s + (byDong ? byDong.reduce((t, d) => t + (d.count ?? 0), 0) : Number(cat.total || 0));
      }, 0)
    : 0;
  const districts  = state.data?.districts || [];
  const avgScore   = districts.length
    ? Math.round(
        districts.reduce((s, d) => {
          const sc  = d.scores || {};
          const vals = Object.values(sc).filter((v) => v > 0);
          return s + (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
        }, 0) / districts.length * 10
      ) / 10
    : 0;
  const sources = Array.isArray(state.apiSources) ? state.apiSources.length : 6;
  const ready   = Array.isArray(state.apiSources)
    ? state.apiSources.filter((s) => s.status === "ready").length
    : 0;

  const tiles = [
    { label: "금천구 총인구",    value: pop ? (pop / 10000).toFixed(1) + "만명" : "—", accent: "#146b4a", bg: "#e6f1ed", iconName: "users" },
    { label: "등록 생활시설",    value: facilities ? facilities + "건"          : "—", accent: "#197982", bg: "#e4f2f4", iconName: "pin" },
    { label: "상권 점포",        value: commercialTotal ? Number(commercialTotal).toLocaleString() + "개" : "—", accent: "#b56b17", bg: "#fef3e2", iconName: "bar-chart" },
    { label: "평균 접근성 지수", value: avgScore ? avgScore + "점"              : "—", accent: "#245b9e", bg: "#e6edf8", iconName: "activity" },
    { label: "데이터 소스",      value: sources + "종",                               accent: "#6556a3", bg: "#ece8f6", iconName: "database" },
    { label: "수집 정상",        value: ready > 0 ? ready + "종" : "대기",            accent: "#146b4a", bg: "#e6f1ed", iconName: "check" },
  ];

  grid.innerHTML = tiles.map((t) => `
    <div class="home-kpi-tile" style="--kpi-accent:${t.accent};--kpi-bg:${t.bg}">
      <div class="home-kpi-icon" aria-hidden="true">${icon(t.iconName, { size: 14 })}</div>
      <div class="home-kpi-body">
        <span class="home-kpi-label">${escapeHtml(t.label)}</span>
        <span class="home-kpi-value">${escapeHtml(t.value)}</span>
      </div>
    </div>
  `).join("");
}

// ─── 홈 지도 초기화 ──────────────────────────────────────────

function initHomeMap() {
  const mapEl = document.getElementById("home-map-pane");
  if (!mapEl || !window.L) return;

  const L = window.L;
  homeMap = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView(GEUMCHEON_CENTER, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(homeMap);

  // 시설 마커 레이어
  ["병원", "약국", "주차장", "안전"].forEach((cat) => {
    homeMarkerLayers[cat] = L.layerGroup().addTo(homeMap);
  });

  buildHomeMarkers();
}

function getHomeDistrictValue(name) {
  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  if (homeChoroplethMetric === "인구") {
    const pop = Array.isArray(state.data?.population) ? state.data.population : [];
    const found = pop.find((p) => p.areaName === name);
    return found ? Number(found.total) : 0;
  }
  const d = districts.find((d) => d.name === name);
  return d ? Number(d.scores?.[homeChoroplethMetric] || 0) : 0;
}

function choroplethColor(value, metric) {
  if (metric === "인구") {
    if (value >= 55000) return "#0a4a34";
    if (value >= 45000) return "#146b4a";
    if (value >= 35000) return "#2a9068";
    return "#6fc4a0";
  }
  if (value >= 85) return "#0a4a34";
  if (value >= 75) return "#146b4a";
  if (value >= 65) return "#2a9068";
  if (value >= 55) return "#6fc4a0";
  return "#b8dfd1";
}

function initHomeChoropleth(geojson) {
  if (!window.L || !homeMap) return;

  if (homeChoropleth) { homeChoropleth.remove(); homeChoropleth = null; }

  homeChoropleth = window.L.geoJSON(geojson, {
    style: (feature) => {
      const name  = feature.properties?.name || "";
      const value = getHomeDistrictValue(name);
      return {
        fillColor:   choroplethColor(value, homeChoroplethMetric),
        fillOpacity: 0.5,
        color:       "#ffffff",
        weight:      2,
        opacity:     0.9,
      };
    },
    onEachFeature: (feature, layer) => {
      const name  = feature.properties?.name || "";
      const value = getHomeDistrictValue(name);
      const label = homeChoroplethMetric === "인구"
        ? `${name}<br><strong>${Number(value).toLocaleString()}명</strong>`
        : `${name}<br><strong>${value}점</strong> (${homeChoroplethMetric})`;
      layer.bindTooltip(label, { sticky: true, className: "map-tooltip" });
      layer.on({
        mouseover: (e) => { e.target.setStyle({ fillOpacity: 0.72, weight: 3 }); e.target.bringToFront(); },
        mouseout:  (e) => { homeChoropleth?.resetStyle(e.target); },
        click:     (e) => { homeMap?.fitBounds(e.target.getBounds(), { padding: [30, 30] }); },
      });
    },
  }).addTo(homeMap);

  Object.values(homeMarkerLayers).forEach((l) => l.bringToFront());
}

function updateHomeChoropleth() {
  if (!homeChoropleth) return;
  homeChoropleth.setStyle((feature) => {
    const name  = feature.properties?.name || "";
    const value = getHomeDistrictValue(name);
    return {
      fillColor:   choroplethColor(value, homeChoroplethMetric),
      fillOpacity: 0.5,
      color:       "#ffffff",
      weight:      2,
      opacity:     0.9,
    };
  });
  homeChoropleth.eachLayer((layer) => {
    const name  = layer.feature?.properties?.name || "";
    const value = getHomeDistrictValue(name);
    const label = homeChoroplethMetric === "인구"
      ? `${name}<br><strong>${Number(value).toLocaleString()}명</strong>`
      : `${name}<br><strong>${value}점</strong> (${homeChoroplethMetric})`;
    layer.setTooltipContent(label);
  });
  renderHomeMapLegend();
}

function renderHomeMapLegend() {
  const el = document.getElementById("home-map-legend");
  if (!el) return;

  const steps = homeChoroplethMetric === "인구"
    ? [{ color: "#0a4a34", label: "55,000명↑" }, { color: "#146b4a", label: "45,000명↑" },
       { color: "#2a9068", label: "35,000명↑" }, { color: "#6fc4a0", label: "35,000명↓" }]
    : [{ color: "#0a4a34", label: "85점↑" }, { color: "#146b4a", label: "75점↑" },
       { color: "#2a9068", label: "65점↑" }, { color: "#6fc4a0", label: "55점↑" },
       { color: "#b8dfd1", label: "55점↓" }];

  el.innerHTML = `
    <div class="home-map-legend-title">${escapeHtml(homeChoroplethMetric)} 지수</div>
    ${steps.map((s) => `
      <div class="home-map-legend-item">
        <span class="home-map-legend-swatch" style="background:${s.color}"></span>
        <span>${escapeHtml(s.label)}</span>
      </div>
    `).join("")}
  `;
}

function buildHomeMarkers() {
  if (!window.L || !homeMap) return;
  const L = window.L;
  const catColor = { "병원": "#197982", "약국": "#146b4a", "주차장": "#b56b17", "안전": "#bd493c" };
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

// ─── 지표 토글 바인딩 ─────────────────────────────────────────

function bindMapMetricToggle(container) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".home-map-metric-btn");
    if (!btn) return;
    homeChoroplethMetric = btn.dataset.metric;
    container.querySelectorAll(".home-map-metric-btn").forEach((b) => {
      const active = b.dataset.metric === homeChoroplethMetric;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    updateHomeChoropleth();
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

  rightChartDonut = createChart(el, {
    ...BASE_OPTION,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (p) =>
        `<div style="font-size:11px"><strong>${p.name}</strong>` +
        `<div style="color:#65736d">${Number(p.value).toLocaleString()}개 (${p.percent}%)</div></div>`,
    },
    legend: {
      orient: "vertical",
      right: 4,
      top: "middle",
      itemWidth: 7,
      itemHeight: 7,
      textStyle: { color: CHART_COLORS.text, fontSize: 10, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    series: [{
      type: "pie",
      radius: ["40%", "66%"],
      center: ["38%", "50%"],
      data: categories,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 11, fontWeight: "bold" } },
      itemStyle: { borderWidth: 2, borderColor: "rgba(255,255,255,0.8)" },
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

function animateMetricValues() {
  if (!state.data?.metrics) return;
  document.querySelectorAll(".metric-value[data-target]").forEach((el) => {
    const target = parseFloat(el.dataset.target);
    if (isNaN(target) || target === 0) return;
    const suffix = el.dataset.suffix || "";
    const isDecimal = !Number.isInteger(target);
    const duration = 1000;
    let startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      el.textContent = isDecimal ? current.toFixed(1) + suffix : Math.floor(current).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
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
          <span class="metric-badge">${escapeHtml(metric.badge)}</span>
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
  const sourceText = sourceModeText(state.data.sourceMode);
  const { asOf } = getSectionMeta("overview");
  if (eyebrow) eyebrow.textContent = `${asOf} 기준 · ${sourceText}`;
  if (badge) {
    const hint = state.data.sourceModeError ? " · 일부 지연" : "";
    badge.textContent = `${sourceText}${hint}`;
  }
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
  const duration = 900;
  wrap.querySelectorAll("[data-counter]").forEach((el) => {
    const target = parseInt(el.dataset.counter, 10);
    if (!target || target === 0) return;
    const suffix = el.dataset.suffix || "";
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function renderStatsStrip() {
  if (!state.data) return;
  const pop = state.data.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
  const commercial = state.data.commercial;
  const commercialTotal = commercial
    ? Object.values(commercial).reduce((s, cat) => s + Number(cat.total || 0), 0)
    : 0;
  const facilities = state.data.facilities?.length || 0;
  const sources    = (Array.isArray(state.apiSources) ? state.apiSources.length : 0) || 6;

  const animate = (el, target, suffix = "") => {
    if (!el || !target) return;
    const duration = 1200;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const popEl = document.getElementById("strip-population");
  const comEl = document.getElementById("strip-commercial");
  const facEl = document.getElementById("strip-facilities");
  const srcEl = document.getElementById("strip-sources");
  if (pop > 0)             { popEl && (popEl.textContent = "0명"); animate(popEl, pop, "명"); }
  if (commercialTotal > 0) { comEl && (comEl.textContent = "0");   animate(comEl, commercialTotal, ""); }
  if (facilities > 0)      { facEl && (facEl.textContent = "0건"); animate(facEl, facilities, "건"); }
  if (sources > 0)         { srcEl && (srcEl.textContent = "0종"); animate(srcEl, sources, "종"); }
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
    categories.push(ind);
    values.push(byDong.reduce((s, d) => s + (d.count ?? 0), 0));
  });
  if (!categories.length) return;
  insightChartLeft = createChart(el, {
    ...BASE_OPTION,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params) => {
        const p = params[0]; if (!p) return "";
        return `<div style="font-size:12px"><strong>${p.name}</strong><div style="color:#65736d">${Number(p.value).toLocaleString()}개 점포</div></div>`;
      }
    },
    grid: { top: 4, bottom: 4, left: 52, right: 36 },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", data: categories, axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily } },
    series: [{ type: "bar", data: values, barMaxWidth: 16,
      itemStyle: { color: (params) => CHART_PALETTE[params.dataIndex % CHART_PALETTE.length], borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: "right", color: CHART_COLORS.text, fontSize: 10,
               formatter: (p) => Number(p.value).toLocaleString() }
    }],
    animation: true
  });
}

function renderInsightPopulation() {
  const el = document.getElementById("insight-population-chart");
  if (!el) return;
  const population = state.data?.population;
  if (!population?.length) return;
  const names  = population.map((d) => d.areaName);
  const totals = population.map((d) => d.total ?? 0);
  insightChartRight = createChart(el, {
    ...BASE_OPTION,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params) => {
        const p = params[0]; if (!p) return "";
        return `<div style="font-size:12px"><strong>${p.name}</strong><div style="color:#65736d">총 ${Number(p.value).toLocaleString()}명</div></div>`;
      }
    },
    grid: { top: 4, bottom: 28, left: 8, right: 8 },
    xAxis: { type: "category", data: names, axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false }, axisLabel: { color: CHART_COLORS.text, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily } },
    yAxis: { type: "value", show: false },
    series: [{ type: "bar", data: totals, barMaxWidth: 48,
      itemStyle: { color: (params) => CHART_PALETTE[params.dataIndex % CHART_PALETTE.length], borderRadius: [6, 6, 0, 0] },
      label: { show: true, position: "top", formatter: (p) => (p.value / 10000).toFixed(1) + "만",
               color: CHART_COLORS.text, fontSize: 11 }
    }],
    animation: true
  });
}

function renderInsightGeo() {
  const el = document.getElementById("insight-geo-chart");
  if (!el) return;
  const districts = state.data?.districts;
  if (!districts?.length) return;
  const names  = districts.map((d) => d.name);
  const scores = districts.map((d) => {
    const s = d.scores || {};
    const vals = [s["생활"] || 0, s["교통"] || 0, s["안전"] || 0].filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
  });
  insightChartGeo = createChart(el, {
    ...BASE_OPTION,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params) => {
        const p = params[0]; if (!p) return "";
        return `<div style="font-size:12px"><strong>${p.name}</strong><div style="color:#65736d">접근성 ${p.value}점</div></div>`;
      }
    },
    grid: { top: 4, bottom: 28, left: 8, right: 8 },
    xAxis: { type: "category", data: names, axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false }, axisLabel: { color: CHART_COLORS.text, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily } },
    yAxis: { type: "value", show: false, max: 100 },
    series: [{ type: "bar", data: scores, barMaxWidth: 48,
      itemStyle: { color: (params) => makeGradient(CHART_PALETTE[params.dataIndex % CHART_PALETTE.length]), borderRadius: [6, 6, 0, 0] },
      label: { show: true, position: "top", formatter: (p) => p.value + "점", color: CHART_COLORS.text, fontSize: 11 }
    }],
    animation: true
  });
}

// ─── 검색 ─────────────────────────────────────────────────────

function bindSearch(container) {
  const form  = container.querySelector(".home-search-form");
  const input = container.querySelector(".home-search-input");
  if (!form || !input) return;

  const ROUTE_MAP = {
    "상황판": "home", "홈": "home", "대시보드": "home",
    "카탈로그": "catalog", "데이터카탈로그": "catalog", "데이터셋": "catalog",
    "생활지도": "map", "지도": "map", "시설": "map",
    "상권": "commercial", "상권분석": "commercial", "카페": "commercial", "음식점": "commercial",
    "집계구": "geo", "집계": "geo", "권역": "geo",
    "인구": "population", "인구분석": "population",
    "api": "api", "api상태": "api", "수집": "api",
    "로그": "api-logs", "api로그": "api-logs",
    "관리자": "admin", "admin": "admin"
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

// ─── HTML 템플릿 ──────────────────────────────────────────────

function buildDashHtml() {
  const { asOf } = getSectionMeta("overview");
  const sourceText = state.data ? sourceModeText(state.data.sourceMode) : "로드 중";
  const facilityCount = Array.isArray(state.data?.facilities) ? state.data.facilities.length : 0;
  const metricBtns = CHOROPLETH_METRICS.map((m) => `
    <button class="home-map-metric-btn${m === homeChoroplethMetric ? " is-active" : ""}"
            data-metric="${escapeHtml(m)}"
            aria-pressed="${m === homeChoroplethMetric}">${escapeHtml(m)}</button>
  `).join("");

  return `
<div class="home-dash">

  <!-- ─ 상단 타이틀 띠 ─ -->
  <header class="home-dash-header">
    <div class="home-dash-brand">
      <p class="home-dash-eyebrow" id="home-eyebrow">${escapeHtml(asOf)} 기준 · ${escapeHtml(sourceText)}</p>
      <h1 class="home-dash-title-text">금천구 도시·생활 데이터플랫폼</h1>
    </div>

    <form class="home-search-form home-dash-search" role="search" aria-label="화면 검색">
      <label class="sr-only" for="home-search-input">화면 검색</label>
      <div class="home-search-wrap">
        <span class="home-search-icon" aria-hidden="true">${icon("search", { size: 15 })}</span>
        <input id="home-search-input" class="home-search-input" type="search"
               placeholder="화면 검색 (상권, 지도, 인구…)"
               autocomplete="off" spellcheck="false">
        <button class="home-search-btn" type="submit">이동</button>
      </div>
    </form>

    <div class="home-dash-badges">
      <span class="home-mode-badge" id="home-mode-badge" aria-label="현재 데이터 모드">${escapeHtml(sourceText)}</span>
      <a class="home-dash-badge-link" href="#/api">${icon("activity", { size: 11 })} API 현황</a>
    </div>
  </header>

  <!-- ─ 대시보드 본문 3단 그리드 ─ -->
  <div class="home-dash-body" aria-label="금천구 현황 대시보드">

    <!-- 좌: KPI 패널 -->
    <aside class="home-dash-left">

      <div class="home-clock-widget">
        <div class="home-clock-time" id="home-clock-time">--:--:--</div>
        <div class="home-clock-date" id="home-clock-date">날짜</div>
        <div class="home-clock-label">금천구 데이터플랫폼 · 실시간</div>
      </div>

      <div class="home-panel-hdr-label">실시간 환경</div>
      <div class="home-env-widgets" id="home-env-widgets"></div>

      <div class="home-panel-hdr-label" style="margin-top:var(--space-4)">주요 지표</div>
      <div class="home-kpi-grid" id="home-kpi-grid">
        ${Array(6).fill(`<div class="home-kpi-tile skeleton" style="height:52px"></div>`).join("")}
      </div>

      <div class="home-panel-hdr-label" style="margin-top:var(--space-4)">서비스 현황</div>
      <div class="home-hero-stats" id="home-hero-stats">
        <div class="home-stat-card"><span>데이터 소스</span><strong>—</strong></div>
        <div class="home-stat-card"><span>수집 정상</span><strong class="pending">대기</strong></div>
        <div class="home-stat-card"><span>등록 시설</span><strong>—</strong></div>
        <div class="home-stat-card"><span>가산동 인구</span><strong>—</strong></div>
      </div>
    </aside>

    <!-- 중앙: Leaflet 지도 -->
    <div class="home-dash-center">
      <div class="home-map-metric-bar" role="group" aria-label="지도 지표 선택">
        <span class="home-map-metric-label">지역 지표</span>
        ${metricBtns}
        <span class="home-map-metric-spacer"></span>
        <span class="home-map-metric-info">행정동 3개 · 시설 ${facilityCount || "—"}건</span>
      </div>
      <div id="home-map-pane" class="home-map-pane" role="region" aria-label="금천구 데이터 지도">
        <div id="home-map-legend" class="home-map-legend" aria-label="단계구분도 범례"></div>
      </div>
    </div>

    <!-- 우: 미니 차트 + 공지 패널 -->
    <aside class="home-dash-right">
      <div class="home-right-panel">
        <div class="home-right-panel-hdr">
          <span>상권 현황</span>
          <a class="home-right-link" href="#/commercial">상세 →</a>
        </div>
        <div id="home-right-donut" class="home-right-chart"></div>
      </div>

      <div class="home-right-panel">
        <div class="home-right-panel-hdr">
          <span>행정동 인구</span>
          <a class="home-right-link" href="#/population">상세 →</a>
        </div>
        <div id="home-right-pop" class="home-right-chart"></div>
      </div>

      <div class="home-right-panel home-right-panel--notice">
        <div class="home-right-panel-hdr">
          <span>최신 공지</span>
          <a class="home-right-link" href="#">더보기</a>
        </div>
        ${buildMiniNotices()}
      </div>
    </aside>
  </div>

  <!-- ─ 하단 섹션 ─ -->

  <div class="home-section-label" style="margin-top:var(--space-6)">
    <h2>실시간 주요 지표</h2>
    <span>API 수집 기준</span>
  </div>
  <section class="metric-grid" id="home-metrics" aria-label="주요 지표">
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
  </section>

  <div class="home-insight-row home-insight-row--3" aria-label="데이터 인사이트">
    <div class="home-insight-card">
      <div class="home-insight-header">
        <div class="home-insight-icon amber">${icon("bar-chart", { size: 18 })}</div>
        <div>
          <p class="home-insight-label">상권 현황</p>
          <p class="home-insight-sub">업종별 금천구 점포 수</p>
        </div>
        <a class="home-insight-link" href="#/commercial">자세히 ${icon("arrow-right", { size: 14 })}</a>
      </div>
      <div class="home-insight-chart" id="insight-commercial-chart"></div>
    </div>
    <div class="home-insight-card">
      <div class="home-insight-header">
        <div class="home-insight-icon green">${icon("users", { size: 18 })}</div>
        <div>
          <p class="home-insight-label">인구 현황</p>
          <p class="home-insight-sub">행정동별 총인구</p>
        </div>
        <a class="home-insight-link" href="#/population">자세히 ${icon("arrow-right", { size: 14 })}</a>
      </div>
      <div class="home-insight-chart" id="insight-population-chart"></div>
    </div>
    <div class="home-insight-card">
      <div class="home-insight-header">
        <div class="home-insight-icon teal">${icon("map", { size: 18 })}</div>
        <div>
          <p class="home-insight-label">집계구 접근성</p>
          <p class="home-insight-sub">행정동별 평균 접근성 지수</p>
        </div>
        <a class="home-insight-link" href="#/geo">자세히 ${icon("arrow-right", { size: 14 })}</a>
      </div>
      <div class="home-insight-chart" id="insight-geo-chart"></div>
    </div>
  </div>

  ${buildDongTable()}

  ${buildReportSection()}

  ${buildDataStatusSection()}

  <div class="home-section-label" style="margin-top:var(--space-8)">
    <h2>인기 데이터셋</h2>
    <a class="home-section-more" href="#/catalog" aria-label="데이터 카탈로그 전체보기">전체 카탈로그 →</a>
  </div>
  <div id="home-popular-datasets" class="home-popular-grid" aria-label="인기 데이터셋">
    ${buildPopularDatasetsSkeleton()}
  </div>

  <div class="home-topics-header">
    <h2>분석 화면</h2>
    <p>아래 카드를 클릭해 세부 분석 화면으로 이동하세요.</p>
  </div>
  <nav class="topic-grid" aria-label="주요 분석 화면 바로가기">
    ${buildTopicCards()}
  </nav>
</div>
  `;
}

function buildMiniNotices() {
  const notices = [
    { type: "공지", title: "2026년 2분기 상권 데이터 업데이트 완료", date: "06.13" },
    { type: "안내", title: "금천구 집계구 GIS 데이터 신규 추가",      date: "06.01" },
    { type: "새소식", title: "행안부 주민등록 API 연동 시범 운영",      date: "05.15" },
  ];
  const cls = { "공지": "notice-badge--green", "안내": "notice-badge--blue", "새소식": "notice-badge--amber" };
  return `<ul class="home-mini-notice-list">
    ${notices.map((n) => `
      <li class="home-mini-notice-item">
        <span class="home-notice-badge ${cls[n.type] || ""}">${escapeHtml(n.type)}</span>
        <span class="home-mini-notice-title">${escapeHtml(n.title)}</span>
        <time class="home-mini-notice-date">${escapeHtml(n.date)}</time>
      </li>
    `).join("")}
  </ul>`;
}

function buildPopularDatasetsSkeleton() {
  return Array(4).fill(`<div class="skeleton" style="height:100px;border-radius:var(--radius-xl)"></div>`).join("");
}

async function renderPopularDatasets(container) {
  try {
    const res = await fetch("./assets/data/datasets.json");
    if (!res.ok) return;
    const data = await res.json();
    const top = [...(data.datasets || [])].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 4);
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
        <a class="home-popular-card" href="#/catalog" aria-label="${escapeHtml(d.title)} 데이터셋 보기">
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

function buildReportSection() {
  const commercial = state.data?.commercial;
  const commercialTotal = commercial
    ? Object.values(commercial).reduce((s, cat) => {
        const byDong = cat?.byDong;
        return s + (byDong ? byDong.reduce((t, d) => t + (d.count ?? 0), 0) : Number(cat.total || 0));
      }, 0)
    : 0;
  const pop      = state.data?.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
  const facilities = state.data?.facilities?.length || 0;
  const districts  = state.data?.districts;
  const avgScore   = districts?.length
    ? Math.round(districts.reduce((s, d) => {
        const sc = d.scores || {};
        const vals = Object.values(sc).filter((v) => v > 0);
        return s + (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
      }, 0) / districts.length * 10) / 10
    : 0;

  const cards = [
    { grad: "var(--grad-green)",  iconName: "users",     stat: pop ? (pop / 10000).toFixed(1) + "만명" : "24.6만명",
      statLabel: "주민등록 인구",   title: "인구 현황",    desc: "연령대·성별·행정동별 인구 구조 분석",              link: "#/population", linkLabel: "인구 분석 보기" },
    { grad: "var(--grad-amber)",  iconName: "bar-chart", stat: commercialTotal ? Number(commercialTotal).toLocaleString() + "개" : "692개",
      statLabel: "등록 점포 수",    title: "상권 분석",    desc: "업종별 점포 수·행정동 경쟁 밀도 비교",             link: "#/commercial", linkLabel: "상권 분석 보기" },
    { grad: "var(--grad-blue)",   iconName: "pin",       stat: avgScore ? avgScore + "점" : "68.4점",
      statLabel: "평균 접근성 지수", title: "집계구 접근성", desc: "생활·교통·안전 접근성 지수 권역별 비교",           link: "#/geo",        linkLabel: "집계구 분석 보기" },
    { grad: "var(--grad-teal)",   iconName: "database",  stat: facilities ? facilities + "건" : "214건",
      statLabel: "등록 생활시설",   title: "공공데이터",   desc: "금천구·서울시·행정기관 24종 데이터셋 열람",         link: "#/catalog",    linkLabel: "카탈로그 보기" },
  ];

  const html = cards.map((c) => `
    <a class="home-report-card reveal" href="${escapeHtml(c.link)}" aria-label="${escapeHtml(c.title)} 분석 화면으로 이동">
      <div class="home-report-thumb" style="background:${c.grad}">
        <div class="home-report-icon">${icon(c.iconName, { size: 24 })}</div>
        <div class="home-report-stat">${escapeHtml(c.stat)}<span>${escapeHtml(c.statLabel)}</span></div>
      </div>
      <div class="home-report-body">
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.desc)}</p>
        <span class="home-report-link">${escapeHtml(c.linkLabel)} ${icon("arrow-right", { size: 12 })}</span>
      </div>
    </a>
  `).join("");

  return `
    <div class="home-section-label reveal" style="margin-top:var(--space-8)">
      <h2>분석 리포트</h2>
      <span>금천구 핵심 데이터 요약</span>
    </div>
    <div class="home-report-row" aria-label="분석 리포트 카드">${html}</div>
  `;
}

function buildDongTable() {
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  const districts  = Array.isArray(state.data?.districts)  ? state.data.districts  : [];

  const DONGS = ["가산동", "독산동", "시흥동"];
  const rows = DONGS.map((name) => {
    const pop  = population.find((p) => p.areaName === name);
    const dist = districts.find((d) => d.name === name);
    const total   = pop   ? Number(pop.total).toLocaleString()  : "—";
    const life    = dist?.scores?.생활  ?? "—";
    const traffic = dist?.scores?.교통  ?? "—";
    const safety  = dist?.scores?.안전  ?? "—";
    const fac     = dist?.facilities || "—";
    const zone    = dist?.zone       || "—";
    const scoreClass = (v) => Number(v) >= 85 ? "hi" : Number(v) >= 75 ? "mid" : "lo";
    return `
      <tr>
        <td class="home-dt-dong">${escapeHtml(name)}</td>
        <td><span class="home-dt-badge">${escapeHtml(zone)}</span></td>
        <td class="home-dt-num">${escapeHtml(total)}명</td>
        <td class="home-dt-score home-dt-score--${scoreClass(life)}">${escapeHtml(String(life))}</td>
        <td class="home-dt-score home-dt-score--${scoreClass(traffic)}">${escapeHtml(String(traffic))}</td>
        <td class="home-dt-score home-dt-score--${scoreClass(safety)}">${escapeHtml(String(safety))}</td>
        <td class="home-dt-num">${escapeHtml(fac)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="home-section-label reveal" style="margin-top:var(--space-6)">
      <h2>행정동별 현황 비교</h2>
      <span>2026년 6월 기준</span>
    </div>
    <div class="home-dong-table-wrap reveal" aria-label="행정동별 현황 비교">
      <table class="home-dong-table">
        <thead>
          <tr>
            <th>행정동</th>
            <th>특성</th>
            <th>인구</th>
            <th>생활 접근성</th>
            <th>교통 접근성</th>
            <th>안전 접근성</th>
            <th>시설 수</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildDataStatusSection() {
  const datasets = [
    { label: "기상 관측", source: "기상청 초단기 API",   updated: "2026.06.13 16:00", status: "ready" },
    { label: "시설 정보", source: "금천구 생활시설 DB",  updated: "2026.06.13 00:00", status: "ready" },
    { label: "상권 정보", source: "상가업소정보 API",    updated: "2026.06.02 15:40", status: "mock"  },
    { label: "인구 통계", source: "행안부 주민등록 API", updated: "2026.06.01 00:00", status: "mock"  },
    { label: "집계구 GIS", source: "행안부 집계구 API",  updated: "2026.06.01 00:00", status: "mock"  },
    { label: "API 로그",  source: "내부 수집 로그 DB",   updated: "2026.06.13 16:00", status: "ready" },
  ];
  const statusBadge = (s) => {
    if (s === "ready") return `<span class="home-ds-badge home-ds-badge--green">${icon("check", { size: 10 })} 정상</span>`;
    if (s === "mock")  return `<span class="home-ds-badge home-ds-badge--amber">${icon("database", { size: 10 })} Mock</span>`;
    return `<span class="home-ds-badge home-ds-badge--muted">대기</span>`;
  };
  const rows = datasets.map((d) => `
    <div class="home-ds-row">
      <div class="home-ds-label">${escapeHtml(d.label)}</div>
      <div class="home-ds-source">${escapeHtml(d.source)}</div>
      <div class="home-ds-updated">${escapeHtml(d.updated)}</div>
      <div class="home-ds-status">${statusBadge(d.status)}</div>
    </div>
  `).join("");
  return `
    <div class="home-section-label">
      <h2>데이터 수집 현황</h2>
      <span>API 연결 및 최신 수집 일시</span>
    </div>
    <div class="home-ds-table" aria-label="데이터 수집 현황">
      <div class="home-ds-head"><div>데이터셋</div><div>출처</div><div>최근 업데이트</div><div>상태</div></div>
      ${rows}
    </div>
  `;
}

function buildTopicCards() {
  const topics = [
    { route: "catalog",    iconName: "database",  iconClass: "green",  title: "데이터 카탈로그", desc: "금천구·서울시·국가기관의 공공데이터 24종을 검색·분류·열람합니다.", label: "카탈로그 보기" },
    { route: "map",        iconName: "map",       iconClass: "teal",   title: "생활지도",        desc: "시설 위치와 행정동 경계를 지도 위에서 확인합니다. 권역별 비교 지원.",   label: "시설 지도 보기" },
    { route: "commercial", iconName: "bar-chart", iconClass: "amber",  title: "상권분석",        desc: "업종별 점포 수와 행정동 경쟁 밀도를 막대차트로 비교합니다.",           label: "상권 분석 보기" },
    { route: "geo",        iconName: "pin",       iconClass: "blue",   title: "집계구 분석",     desc: "행정동·집계구 단위로 생활·교통·안전 접근성 지표를 비교합니다.",          label: "집계구 분석 보기" },
    { route: "population", iconName: "users",     iconClass: "teal",   title: "인구 분석",       desc: "행정동별 인구 피라미드와 연령대 분포를 시각화합니다.",                  label: "인구 분석 보기" },
    { route: "api",        iconName: "activity",  iconClass: "violet", title: "API 수집 현황",   desc: "공공데이터 API 연결 상태와 수집 이력을 확인합니다.",                   label: "API 현황 보기" },
    { route: "api-logs",   iconName: "list",      iconClass: "blue",   title: "수집 로그",       desc: "API 수집 실행 내역을 필터링하고 검색합니다.",                         label: "로그 보기" },
    { route: "admin",      iconName: "settings",  iconClass: "navy",   title: "관리자",          desc: "데이터셋 메타데이터를 관리하고 CSV/Excel 파일을 업로드합니다.",          label: "관리 화면 열기" },
  ];
  const ACCENT_MAP = {
    catalog: "#146b4a", map: "#197982", commercial: "#b56b17",
    geo: "#245b9e", population: "#197982", api: "#6556a3",
    "api-logs": "#245b9e", admin: "#21342f"
  };
  return topics.map((topic) => {
    const accent = ACCENT_MAP[topic.route] || "#146b4a";
    return `
    <a class="topic-card" href="#/${escapeHtml(topic.route)}"
       aria-label="${escapeHtml(topic.title)} 화면으로 이동"
       style="--card-accent:${accent}">
      <div class="topic-icon ${topic.iconClass}" aria-hidden="true">${icon(topic.iconName, { size: 22 })}</div>
      <h3>${escapeHtml(topic.title)}</h3>
      <p>${escapeHtml(topic.desc)}</p>
      <span class="topic-link">${escapeHtml(topic.label)} ${icon("arrow-right", { size: 13 })}</span>
    </a>
  `;
  }).join("");
}
