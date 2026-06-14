// 인구 분석 페이지: 행정동 선택 + 인구 피라미드 + 행정동별 인구 막대 + KPI

import { state } from "../core/state.js";
import { escapeHtml, revealOnScroll } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import { loadECharts, createChart, disposeChart, makeGradient, CHART_PALETTE, CHART_COLORS, BASE_OPTION } from "../core/charts.js";
import { icon } from "../core/icons.js";

const AGE_BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"];

// 모듈-레벨 차트 인스턴스
let chartPyramid = null;
let chartBar     = null;
let chartAge     = null; // 3동 연령구조 비교
let isMounted    = false;

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
  revealOnScroll(container);
}

export function unmount() {
  isMounted = false;
  disposeChart(chartPyramid); chartPyramid = null;
  disposeChart(chartBar);     chartBar     = null;
  disposeChart(chartAge);     chartAge     = null;
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

  const totalPop     = population.reduce((s, p) => s + Number(p.total || 0), 0);
  const ELDERLY_BANDS = ["60~69세", "70세 이상"];
  const YOUTH_BANDS   = ["0~9세", "10~19세"];
  let elderlyCount = 0, youthCount = 0, totalAgeCount = 0;
  population.forEach((p) => {
    (p.byAge || []).forEach((b) => {
      const n = Number(b.count || 0);
      if (ELDERLY_BANDS.includes(b.band)) elderlyCount += n;
      if (YOUTH_BANDS.includes(b.band))   youthCount   += n;
      totalAgeCount += n;
    });
  });
  const elderlyRatio = totalAgeCount ? Math.round(elderlyCount / totalAgeCount * 100 * 10) / 10 : 0;

  return `
    <div class="pop-page">
      <div class="page-banner" style="--banner-from:#0d2a45;--banner-to:#0d93cf">
        <div class="page-banner-icon">${icon("users", { size: 26 })}</div>
        <div class="page-banner-copy">
          <p class="page-banner-eyebrow">인구 분석</p>
          <h2 class="page-banner-title">금천구 인구 현황</h2>
          <p class="page-banner-desc">행정동별 인구 피라미드와 연령대·성별 분포를 시각화합니다.</p>
        </div>
        <div class="page-banner-stats">
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${totalPop ? (totalPop / 10000).toFixed(1) + "만" : "—"}</span>
            <span class="page-banner-stat-label">총인구</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${population.length || "—"}</span>
            <span class="page-banner-stat-label">행정동</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${elderlyRatio ? elderlyRatio + "%" : "—"}</span>
            <span class="page-banner-stat-label">고령화율</span>
          </div>
        </div>
        <a class="page-banner-back" href="#/home">◀ 홈으로</a>
      </div>

      <div class="pop-filter-bar" role="group" aria-label="행정동 선택">
        <span class="pop-filter-label">행정동</span>
        ${districtBtns}
        <span class="pop-filter-hint">인구 피라미드는 선택 동 기준</span>
      </div>

      <div id="pop-kpi-row" class="pop-kpi-row" aria-live="polite"></div>

      <div class="pop-charts-grid">
        <div class="pop-chart-card reveal">
          <div class="pop-chart-header">
            <h3>연령별 인구 피라미드</h3>
            <span id="pop-pyramid-badge" class="pop-district-badge">${escapeHtml(selectedDistrict)}</span>
          </div>
          <div id="pop-chart-pyramid" class="pop-echart pop-echart--pyramid" aria-label="인구 피라미드"></div>
        </div>

        <div class="pop-chart-card reveal">
          <div class="pop-chart-header">
            <h3>행정동별 총인구 비교</h3>
            <span class="pop-district-badge">전체</span>
          </div>
          <div id="pop-chart-bar" class="pop-echart" aria-label="행정동별 인구 막대차트"></div>
          ${renderDataStamp("population", "주민등록인구 Mock")}
        </div>
      </div>

      <!-- 3동 연령구조 비교 (풀폭) -->
      <div class="pop-chart-card pop-chart-card--wide reveal" style="margin-top:var(--space-5)">
        <div class="pop-chart-header">
          <h3>3개 행정동 연령구조 비교</h3>
          <span class="pop-district-badge">전체 동</span>
        </div>
        <div id="pop-chart-age" class="pop-echart pop-echart--age" aria-label="3동 연령구조 비교 막대차트"></div>
      </div>

      <!-- 행정동별 인구 통계 테이블 -->
      <div class="pop-table-wrap reveal" style="margin-top:var(--space-5)">
        <div class="pop-table-header">
          <h3>행정동별 인구 통계</h3>
          <span class="pop-district-badge">2026.06 기준</span>
        </div>
        ${buildPopTable()}
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

  // 선택 동 기준 고령화지수 / 유소년비
  const allByAge = population.reduce((acc, p) => {
    (p.byAge || []).forEach((a) => {
      if (!acc[a.ageBand]) acc[a.ageBand] = { male: 0, female: 0 };
      acc[a.ageBand].male   += Number(a.male   || 0);
      acc[a.ageBand].female += Number(a.female || 0);
    });
    return acc;
  }, {});

  const ELDERLY_BANDS  = ["60~69세", "70세 이상"];
  const YOUTH_BANDS    = ["0~9세", "10~19세"];
  const elderlyPop = ELDERLY_BANDS.reduce((s, b) => s + (allByAge[b]?.male || 0) + (allByAge[b]?.female || 0), 0);
  const youthPop   = YOUTH_BANDS.reduce(  (s, b) => s + (allByAge[b]?.male || 0) + (allByAge[b]?.female || 0), 0);
  const agingIdx   = totalAll > 0 ? (elderlyPop / totalAll * 100).toFixed(1) : "—";
  const youthRatio = totalAll > 0 ? (youthPop  / totalAll * 100).toFixed(1) : "—";

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
      <div class="pop-kpi-icon" style="background:var(--teal-wash);color:var(--teal)">${icon("activity", { size: 16 })}</div>
      <p>여성 인구</p>
      <strong>${Number(totalFemale).toLocaleString()}<span>명</span></strong>
    </article>
    <article class="pop-kpi-card">
      <div class="pop-kpi-icon" style="background:var(--amber-wash);color:var(--amber)">${icon("trending-up", { size: 16 })}</div>
      <p>성비 (여성=100)</p>
      <strong>${sexRatio}<span></span></strong>
    </article>
    <article class="pop-kpi-card">
      <div class="pop-kpi-icon" style="background:var(--red-wash);color:var(--red)">${icon("alert", { size: 16 })}</div>
      <p>고령 인구 비율</p>
      <strong>${agingIdx}<span>%</span></strong>
    </article>
    <article class="pop-kpi-card">
      <div class="pop-kpi-icon" style="background:var(--violet-wash);color:var(--violet)">${icon("users", { size: 16 })}</div>
      <p>유소년 인구 비율</p>
      <strong>${youthRatio}<span>%</span></strong>
    </article>
  `;
}

// ─── ECharts 초기화 ───────────────────────────────────────────

function initCharts() {
  const pyramidEl = document.getElementById("pop-chart-pyramid");
  const barEl     = document.getElementById("pop-chart-bar");
  const ageEl     = document.getElementById("pop-chart-age");
  if (!pyramidEl || !barEl) return;

  chartPyramid = createChart(pyramidEl, buildPyramidOption());
  chartBar     = createChart(barEl,     buildBarOption());
  if (ageEl) chartAge = createChart(ageEl, buildAgeCompareOption());
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
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        if (!params?.length) return "";
        const area = params[0]?.name || "";
        const rows = params.map((p) =>
          `<div style="display:flex;justify-content:space-between;gap:16px;padding:1px 0">` +
          `<span style="color:#65736d">${p.seriesName}</span>` +
          `<strong>${Number(p.value).toLocaleString()}명</strong>` +
          `</div>`
        ).join("");
        return `<div style="font-size:12px;min-width:160px">` +
          `<div style="font-weight:800;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #e8edeb">${area}</div>` +
          rows + `</div>`;
      },
    },
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

/** 3개 행정동 × 8연령대 그룹 막대 비교 */
function buildAgeCompareOption() {
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  if (!population.length) return {};

  // 각 동별 8연령대 합계(남+여)
  const series = population.map((p, idx) => {
    const values = AGE_BANDS.map((b) => {
      const a = (p.byAge || []).find((x) => x.ageBand === b);
      return a ? (Number(a.male || 0) + Number(a.female || 0)) : 0;
    });
    return {
      name: p.areaName,
      type: "bar",
      data: values,
      barMaxWidth: 28,
      itemStyle: { color: makeGradient(CHART_PALETTE[idx % CHART_PALETTE.length]), borderRadius: [4, 4, 0, 0] },
      label: {
        show: true,
        position: "top",
        fontSize: 9,
        color: CHART_COLORS.text,
        formatter: (p) => (p.value / 1000).toFixed(1) + "k",
      },
    };
  });

  return {
    ...BASE_OPTION,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const ageBand = params[0]?.axisValue || "";
        const rows = params.map((p) =>
          `<div style="display:flex;justify-content:space-between;gap:16px">` +
          `<span style="color:#65736d">${p.seriesName}</span>` +
          `<strong>${Number(p.value).toLocaleString()}명</strong></div>`
        ).join("");
        return `<div style="font-size:12px;min-width:180px">` +
          `<div style="font-weight:800;margin-bottom:4px;border-bottom:1px solid #e8edeb;padding-bottom:4px">${ageBand}</div>` +
          rows + `</div>`;
      },
    },
    legend: {
      right: 0,
      top: 0,
      textStyle: { color: CHART_COLORS.ink, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { top: 32, bottom: 8, left: 8, right: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: AGE_BANDS,
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 10, fontFamily: BASE_OPTION.textStyle.fontFamily,
                   interval: 0, rotate: 20 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 10,
                   formatter: (v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v },
      axisLine: { show: false },
    },
    series,
    animation: true,
  };
}

/** 행정동별 인구 통계 테이블 HTML */
function buildPopTable() {
  const population = Array.isArray(state.data?.population) ? state.data.population : [];
  if (!population.length) return `<p style="color:var(--muted)">데이터 없음</p>`;

  const headers = ["행정동", "총인구", "남성", "여성", "성비", "고령인구비", "유소년비"];
  const rows = population.map((p) => {
    const total   = Number(p.total   || 0);
    const male    = Number(p.male    || 0);
    const female  = Number(p.female  || 0);
    const sexRatio = female > 0 ? Math.round(male / female * 100) : 0;
    const byAge   = p.byAge || [];
    const elderly = (["60~69세", "70세 이상"].reduce((s, b) => {
      const a = byAge.find((x) => x.ageBand === b);
      return s + (a ? Number(a.male || 0) + Number(a.female || 0) : 0);
    }, 0));
    const youth = (["0~9세", "10~19세"].reduce((s, b) => {
      const a = byAge.find((x) => x.ageBand === b);
      return s + (a ? Number(a.male || 0) + Number(a.female || 0) : 0);
    }, 0));
    const agingPct = total > 0 ? (elderly / total * 100).toFixed(1) + "%" : "—";
    const youthPct = total > 0 ? (youth   / total * 100).toFixed(1) + "%" : "—";
    return [
      escapeHtml(p.areaName),
      Number(total).toLocaleString() + "명",
      Number(male).toLocaleString() + "명",
      Number(female).toLocaleString() + "명",
      sexRatio,
      agingPct,
      youthPct,
    ];
  });

  return `
    <table class="pop-table">
      <thead>
        <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
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
