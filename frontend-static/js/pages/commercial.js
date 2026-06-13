// 상권분석 페이지: 업종 필터 + KPI 카드 + ECharts 가로 막대·도넛·라인 차트

import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import { currentCommercialIndustryData } from "../core/selectors.js";
import { loadECharts, createChart, disposeChart, CHART_PALETTE, CHART_COLORS } from "../core/charts.js";
import { icon } from "../core/icons.js";

const INDUSTRIES = ["카페", "음식점", "편의점", "학원"];

// 모듈-레벨 차트 인스턴스 (unmount 시 dispose)
let chartBar = null;
let chartDonut = null;
let chartLine = null;
let isMounted = false;

// ─── CSS 주입 ─────────────────────────────────────────────────

function injectCss() {
  if (!document.getElementById("css-page-commercial")) {
    const link = document.createElement("link");
    link.id = "css-page-commercial";
    link.rel = "stylesheet";
    link.href = "./css/pages/commercial.css";
    document.head.appendChild(link);
  }
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  isMounted = true;
  injectCss();
  container.innerHTML = buildHtml();
  bindEvents(container);

  renderKpi();

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
  disposeChart(chartBar);   chartBar = null;
  disposeChart(chartDonut); chartDonut = null;
  disposeChart(chartLine);  chartLine = null;
}

// ─── HTML 구조 ────────────────────────────────────────────────

function buildHtml() {
  const filterBtns = INDUSTRIES.map((ind) => `
    <button
      class="cml-filter-btn${state.industry === ind ? " is-active" : ""}"
      data-industry="${escapeHtml(ind)}"
      aria-pressed="${state.industry === ind}"
    >${escapeHtml(ind)}</button>
  `).join("");

  return `
    <div class="cml-page">
      <div class="page-header">
        <div class="page-header-copy">
          <p class="eyebrow">상권분석</p>
          <h2>금천구 상권 현황</h2>
        </div>
        <a class="page-back" href="#/home">◀ 홈으로</a>
      </div>

      <div class="cml-filter-bar" role="group" aria-label="업종 선택">
        <span class="cml-filter-label">업종</span>
        ${filterBtns}
      </div>

      <div id="cml-kpi-row" class="cml-kpi-row" aria-live="polite"></div>

      <div class="cml-charts-grid">
        <div class="cml-chart-card">
          <div class="cml-chart-header">
            <h3>행정동별 분포</h3>
            <span id="cml-bar-badge" class="cml-industry-badge">${escapeHtml(state.industry)}</span>
          </div>
          <div id="cml-chart-bar" class="cml-echart" aria-label="행정동별 점포 수 막대차트"></div>
        </div>

        <div class="cml-chart-card">
          <div class="cml-chart-header">
            <h3>업종 구성 비율</h3>
            <span class="cml-industry-badge">전체</span>
          </div>
          <div id="cml-chart-donut" class="cml-echart" aria-label="업종 구성 도넛차트"></div>
        </div>

        <div class="cml-chart-card cml-chart-card--wide">
          <div class="cml-chart-header">
            <h3>월별 점포 수 추이</h3>
            <span id="cml-line-badge" class="cml-industry-badge">${escapeHtml(state.industry)}</span>
          </div>
          <div id="cml-chart-line" class="cml-echart cml-echart--tall" aria-label="월별 점포 수 추이 라인차트"></div>
          ${renderDataStamp("commercial", `${state.industry} 업종`)}
        </div>
      </div>
    </div>
  `;
}

// ─── KPI ─────────────────────────────────────────────────────

function renderKpi() {
  const el = document.getElementById("cml-kpi-row");
  if (!el) return;
  const item = currentCommercialIndustryData();

  if (!item) {
    el.innerHTML = `<p style="color:var(--muted);grid-column:1/-1">데이터를 불러오는 중입니다.</p>`;
    return;
  }

  const densityColors = { "높음": "var(--amber)", "매우 높음": "var(--red)", "보통": "var(--green)", "낮음": "var(--blue)" };
  const densityColor = densityColors[item.density] || "var(--muted)";

  el.innerHTML = `
    <article class="cml-kpi-card">
      <div class="cml-kpi-icon" style="background:#e6f1ed;color:#146b4a">${icon("bar-chart", { size: 16 })}</div>
      <p>전체 점포</p>
      <strong>${Number(item.total).toLocaleString()}<span>개</span></strong>
    </article>
    <article class="cml-kpi-card">
      <div class="cml-kpi-icon" style="background:#e6edf8;color:#245b9e">${icon("pin", { size: 16 })}</div>
      <p>500m 반경</p>
      <strong>${Number(item.radius).toLocaleString()}<span>개</span></strong>
    </article>
    <article class="cml-kpi-card">
      <div class="cml-kpi-icon" style="background:#fef3e2;color:#b56b17">${icon("trending-up", { size: 16 })}</div>
      <p>경쟁 밀도</p>
      <strong style="color:${densityColor}">${escapeHtml(item.density)}</strong>
    </article>
  `;
}

// ─── ECharts 초기화 ───────────────────────────────────────────

function initCharts() {
  const barEl   = document.getElementById("cml-chart-bar");
  const donutEl = document.getElementById("cml-chart-donut");
  const lineEl  = document.getElementById("cml-chart-line");
  if (!barEl || !donutEl || !lineEl) return;

  chartBar   = createChart(barEl,   buildBarOption());
  chartDonut = createChart(donutEl, buildDonutOption());
  chartLine  = createChart(lineEl,  buildLineOption());
}

// ─── 차트 옵션 빌더 ───────────────────────────────────────────

function buildBarOption() {
  const item   = currentCommercialIndustryData();
  const byDong = item?.byDong ?? [];
  const names  = byDong.map((d) => d.name);
  const values = byDong.map((d) => Number(d.count || 0));

  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 16, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.ink, fontSize: 12 },
    },
    series: [{
      type: "bar",
      data: values,
      itemStyle: {
        color: (params) => CHART_PALETTE[params.dataIndex % CHART_PALETTE.length],
        borderRadius: [0, 4, 4, 0]
      },
      label: { show: true, position: "right", color: CHART_COLORS.text, fontSize: 11,
               formatter: (p) => Number(p.value).toLocaleString() },
      barMaxWidth: 40,
    }],
  };
}

function buildDonutOption() {
  const commercial = state.data?.commercial ?? {};
  const data = INDUSTRIES.map((ind) => ({
    name: ind,
    value: Number(commercial[ind]?.total ?? 0),
  }));

  return {
    tooltip: { trigger: "item", formatter: "{b}: {c}개 ({d}%)" },
    legend: { orient: "vertical", right: 8, top: "center",
              textStyle: { color: CHART_COLORS.ink, fontSize: 12 }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: "pie",
      radius: ["48%", "72%"],
      center: ["38%", "50%"],
      data,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold" } },
      itemStyle: { borderRadius: 4, borderColor: CHART_COLORS.surface, borderWidth: 2 },
    }],
  };
}

function buildLineOption() {
  const item  = currentCommercialIndustryData();
  const trend = item?.trend ?? [];
  const months = trend.map((t) => t.month.replace("-", ".").slice(2)); // "25.07" 형식
  const values = trend.map((t) => Number(t.count));

  return {
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const p = params[0];
        return `${p.axisValue}<br><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CHART_PALETTE[0]};margin-right:4px"></span>${Number(p.value).toLocaleString()}개`;
      }
    },
    grid: { left: 16, right: 24, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: months,
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11 },
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11,
                   formatter: (v) => Number(v).toLocaleString() },
      scale: true,
    },
    series: [{
      type: "line",
      data: values,
      smooth: 0.4,
      symbol: "circle",
      symbolSize: 7,
      lineStyle: { color: CHART_PALETTE[0], width: 2.5 },
      itemStyle: { color: CHART_PALETTE[0], borderWidth: 2, borderColor: "#fff" },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: "rgba(20,107,74,0.2)" }, { offset: 1, color: "rgba(20,107,74,0)" }] } },
    }],
  };
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".cml-filter-btn");
    if (!btn) return;

    state.industry = btn.dataset.industry;
    container.querySelectorAll(".cml-filter-btn").forEach((b) => {
      const isActive = b.dataset.industry === state.industry;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-pressed", String(isActive));
    });

    // 배지 갱신
    const barBadge  = document.getElementById("cml-bar-badge");
    const lineBadge = document.getElementById("cml-line-badge");
    if (barBadge)  barBadge.textContent  = state.industry;
    if (lineBadge) lineBadge.textContent = state.industry;

    renderKpi();

    // ECharts가 아직 로드되지 않았으면 건너뜀 (initCharts에서 최신 state 반영)
    if (chartBar)  chartBar.setOption(buildBarOption());
    if (chartLine) chartLine.setOption(buildLineOption());
  });
}
