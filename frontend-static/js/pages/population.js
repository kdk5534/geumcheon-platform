// 인구 분석 페이지: 행정동 선택 + 인구 피라미드 + 행정동별 인구 막대 + KPI

import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import { loadECharts, createChart, disposeChart, CHART_PALETTE, CHART_COLORS } from "../core/charts.js";
import { icon } from "../core/icons.js";

const AGE_BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"];

// 모듈-레벨 차트 인스턴스
let chartPyramid = null;
let chartBar = null;
let isMounted = false;

// ─── CSS 주입 ─────────────────────────────────────────────────

function injectCss() {
  if (!document.getElementById("css-page-population")) {
    const link = document.createElement("link");
    link.id = "css-page-population";
    link.rel = "stylesheet";
    link.href = "./css/pages/population.css";
    document.head.appendChild(link);
  }
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  isMounted = true;
  injectCss();
  container.innerHTML = buildHtml();
  renderKpi();
  bindEvents(container);

  try {
    await loadECharts();
  } catch (e) {
    console.error("ECharts 로드 실패:", e);
    return;
  }
  if (!isMounted) return;

  initCharts();
}

export function unmount() {
  isMounted = false;
  disposeChart(chartPyramid); chartPyramid = null;
  disposeChart(chartBar);     chartBar = null;
}

// ─── HTML 구조 ────────────────────────────────────────────────

function buildHtml() {
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  const selectedDistrict = state.populationDistrict || (population[0]?.areaName ?? "가산동");

  const districtBtns = population.map((p) => `
    <button
      class="pop-filter-btn${selectedDistrict === p.areaName ? " is-active" : ""}"
      data-district="${escapeHtml(p.areaName)}"
      aria-pressed="${selectedDistrict === p.areaName}"
    >${escapeHtml(p.areaName)}</button>
  `).join("");

  return `
    <div class="pop-page">
      <div class="page-header">
        <div class="page-header-copy">
          <p class="eyebrow">인구 분석</p>
          <h2>금천구 인구 현황</h2>
        </div>
        <a class="page-back" href="#/home">◀ 홈으로</a>
      </div>

      <div class="pop-filter-bar" role="group" aria-label="행정동 선택">
        <span class="pop-filter-label">행정동</span>
        ${districtBtns}
        <span class="pop-filter-hint">인구 피라미드는 선택 동 기준</span>
      </div>

      <div id="pop-kpi-row" class="pop-kpi-row" aria-live="polite"></div>

      <div class="pop-charts-grid">
        <div class="pop-chart-card">
          <div class="pop-chart-header">
            <h3>연령별 인구 피라미드</h3>
            <span id="pop-pyramid-badge" class="pop-district-badge">${escapeHtml(selectedDistrict)}</span>
          </div>
          <div id="pop-chart-pyramid" class="pop-echart pop-echart--pyramid" aria-label="인구 피라미드"></div>
        </div>

        <div class="pop-chart-card">
          <div class="pop-chart-header">
            <h3>행정동별 총인구 비교</h3>
            <span class="pop-district-badge">전체</span>
          </div>
          <div id="pop-chart-bar" class="pop-echart" aria-label="행정동별 인구 막대차트"></div>
          ${renderDataStamp("population", "주민등록인구 Mock")}
        </div>
      </div>
    </div>
  `;
}

// ─── KPI ─────────────────────────────────────────────────────

function renderKpi() {
  const el = document.getElementById("pop-kpi-row");
  if (!el) return;

  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  if (population.length === 0) {
    el.innerHTML = `<p style="color:var(--muted);grid-column:1/-1">인구 데이터를 불러오는 중입니다.</p>`;
    return;
  }

  const selected = population.find((p) => p.areaName === (state.populationDistrict || population[0]?.areaName));
  const totalAll = population.reduce((s, p) => s + Number(p.total || 0), 0);
  const totalMale = population.reduce((s, p) => s + Number(p.male || 0), 0);
  const totalFemale = population.reduce((s, p) => s + Number(p.female || 0), 0);
  const sexRatio = totalMale > 0 ? Math.round((totalMale / totalFemale) * 100) : 0;

  el.innerHTML = `
    <article class="pop-kpi-card">
      <div class="pop-kpi-icon" style="background:var(--green-wash);color:var(--green)">${icon("users", { size: 16 })}</div>
      <p>금천구 총인구</p>
      <strong>${Number(totalAll).toLocaleString()}<span>명</span></strong>
    </article>
    <article class="pop-kpi-card">
      <div class="pop-kpi-icon" style="background:var(--blue-wash);color:var(--blue)">${icon("activity", { size: 16 })}</div>
      <p>남성 인구</p>
      <strong>${Number(totalMale).toLocaleString()}<span>명</span></strong>
    </article>
    <article class="pop-kpi-card">
      <div class="pop-kpi-icon" style="background:var(--amber-wash);color:var(--amber)">${icon("activity", { size: 16 })}</div>
      <p>여성 인구</p>
      <strong>${Number(totalFemale).toLocaleString()}<span>명</span></strong>
    </article>
    <article class="pop-kpi-card">
      <div class="pop-kpi-icon" style="background:var(--teal-wash);color:var(--teal)">${icon("trending-up", { size: 16 })}</div>
      <p>성비 (여성=100)</p>
      <strong>${sexRatio}<span></span></strong>
    </article>
  `;
}

// ─── ECharts 초기화 ───────────────────────────────────────────

function initCharts() {
  const pyramidEl = document.getElementById("pop-chart-pyramid");
  const barEl     = document.getElementById("pop-chart-bar");
  if (!pyramidEl || !barEl) return;

  chartPyramid = createChart(pyramidEl, buildPyramidOption());
  chartBar     = createChart(barEl,     buildBarOption());
}

// ─── 차트 옵션 빌더 ───────────────────────────────────────────

function buildPyramidOption() {
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  const selected   = population.find((p) => p.areaName === (state.populationDistrict || population[0]?.areaName));
  const byAge      = selected?.byAge ?? [];

  const males   = AGE_BANDS.map((b) => { const r = byAge.find((a) => a.ageBand === b); return -(Number(r?.male   || 0)); });
  const females = AGE_BANDS.map((b) => { const r = byAge.find((a) => a.ageBand === b); return   Number(r?.female || 0);  });

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const male   = Math.abs(params[0]?.value ?? 0);
        const female = params[1]?.value ?? 0;
        return `${params[0].axisValue}<br>남성: ${Number(male).toLocaleString()}명<br>여성: ${Number(female).toLocaleString()}명`;
      },
    },
    legend: {
      data: ["남성", "여성"],
      bottom: 0,
      textStyle: { color: CHART_COLORS.ink, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 16, right: 16, top: 8, bottom: 32, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { formatter: (v) => `${Math.abs(Math.round(v / 100)) * 100}`, color: CHART_COLORS.text, fontSize: 10 },
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: AGE_BANDS,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.ink, fontSize: 11 },
    },
    series: [
      {
        name: "남성",
        type: "bar",
        stack: "pyramid",
        data: males,
        itemStyle: { color: CHART_PALETTE[2], borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 28,
        label: { show: false },
      },
      {
        name: "여성",
        type: "bar",
        stack: "pyramid",
        data: females,
        itemStyle: { color: CHART_PALETTE[0], borderRadius: [4, 0, 0, 4] },
        barMaxWidth: 28,
        label: { show: false },
      },
    ],
  };
}

function buildBarOption() {
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  const names      = population.map((p) => p.areaName);
  const totals     = population.map((p) => Number(p.total || 0));
  const males      = population.map((p) => Number(p.male || 0));
  const females    = population.map((p) => Number(p.female || 0));

  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      data: ["총인구", "남성", "여성"],
      right: 0, top: 0,
      textStyle: { color: CHART_COLORS.ink, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 16, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.ink, fontSize: 12 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11,
                   formatter: (v) => v >= 1000 ? `${v / 1000}k` : v },
      axisLine: { show: false },
    },
    series: [
      {
        name: "총인구",
        type: "bar",
        data: totals,
        itemStyle: { color: CHART_PALETTE[0], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
        label: { show: true, position: "top", color: CHART_COLORS.text, fontSize: 10,
                 formatter: (p) => Number(p.value).toLocaleString() },
      },
      {
        name: "남성",
        type: "bar",
        data: males,
        itemStyle: { color: CHART_PALETTE[2], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 28,
        label: { show: false },
      },
      {
        name: "여성",
        type: "bar",
        data: females,
        itemStyle: { color: CHART_PALETTE[1], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 28,
        label: { show: false },
      },
    ],
  };
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".pop-filter-btn");
    if (!btn) return;

    state.populationDistrict = btn.dataset.district;
    container.querySelectorAll(".pop-filter-btn").forEach((b) => {
      const isActive = b.dataset.district === state.populationDistrict;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-pressed", String(isActive));
    });

    const badge = document.getElementById("pop-pyramid-badge");
    if (badge) badge.textContent = state.populationDistrict;

    renderKpi();
    if (chartPyramid) chartPyramid.setOption(buildPyramidOption());
  });
}
