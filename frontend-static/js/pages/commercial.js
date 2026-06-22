// 상권분석 페이지: 업종 필터 + KPI 카드 + ECharts 가로 막대·도넛·라인 차트

import { state } from "../core/state.js";
import { escapeHtml, revealOnScroll } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import { currentCommercialIndustryData } from "../core/selectors.js";
import { loadECharts, createChart, disposeChart, CHART_PALETTE, CHART_COLORS, BASE_OPTION } from "../core/charts.js";
import { icon } from "../core/icons.js";
import { injectPageCss } from "../core/assets.js";
import { loadStoreScopeCount } from "../core/api.js";
import { buildCommercialMatrix, csvDataUrl, matrixToCsv } from "../core/visualization.js";

const INDUSTRIES = ["카페", "음식점", "편의점", "학원"];
const COMMERCIAL_DONGS = ["가산동", "독산동", "시흥동"];

// 모듈-레벨 차트 인스턴스 (unmount 시 dispose)
let chartBar   = null;
let chartDonut = null;
let chartLine  = null;
let chartCross = null; // 동×업종 교차 누적 막대
let isMounted  = false;
let commercialScope = "GEUMCHEON";

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  isMounted = true;
  commercialScope = "GEUMCHEON";
  injectPageCss("css-page-commercial", "./css/pages/commercial.css");
  container.innerHTML = buildHtml();
  bindEvents(container);
  refreshScopeCount();

  renderKpi();

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
  disposeChart(chartBar);   chartBar   = null;
  disposeChart(chartDonut); chartDonut = null;
  disposeChart(chartLine);  chartLine  = null;
  disposeChart(chartCross); chartCross = null;
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

  const commercial = state.data?.commercial || {};
  const industryCount = Object.keys(commercial).length;
  const totalStores = Object.values(commercial).reduce((s, cat) => {
    const byDong = cat?.byDong;
    return s + (byDong ? byDong.reduce((t, d) => t + (d.count ?? 0), 0) : Number(cat.total || 0));
  }, 0);
  const byDongAll = {};
  Object.values(commercial).forEach((cat) => {
    (cat?.byDong || []).forEach((d) => {
      byDongAll[d.name] = (byDongAll[d.name] || 0) + (d.count ?? 0);
    });
  });
  const topDong = Object.entries(byDongAll).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return `
    <div class="cml-page">
      <div class="page-banner" style="--banner-from:#5c3a0a;--banner-to:#b56b17">
        <div class="page-banner-icon">${icon("bar-chart", { size: 26 })}</div>
        <div class="page-banner-copy">
          <p class="page-banner-eyebrow">상권분석</p>
          <h2 class="page-banner-title">금천구 상권 현황</h2>
          <p class="page-banner-desc">업종별 점포 분포와 월별 추이를 행정동 단위로 비교합니다.</p>
        </div>
        <div class="page-banner-stats">
          <div class="page-banner-stat">
            <span id="cml-scope-total" class="page-banner-stat-val">${totalStores ? totalStores.toLocaleString() : "—"}</span>
            <span class="page-banner-stat-label">조회 범위 점포</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${industryCount || "—"}</span>
            <span class="page-banner-stat-label">업종 분류</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${escapeHtml(topDong.replace("동", ""))}</span>
            <span class="page-banner-stat-label">최다 점포 동</span>
          </div>
        </div>
        <a class="page-banner-back" href="#/home">◀ 홈으로</a>
      </div>

      <div class="cml-scope-bar" role="group" aria-label="상권 공간 범위 선택">
        <span class="cml-filter-label">공간 범위</span>
        <button class="cml-scope-btn is-active" data-scope="GEUMCHEON" aria-pressed="true">금천구만</button>
        <button class="cml-scope-btn" data-scope="BORDER_AREA" aria-pressed="false">경계 생활권 포함</button>
        <span id="cml-scope-note" class="cml-scope-note">기본값 · 공식 통계는 금천구 내부만 사용</span>
      </div>

      <div class="cml-filter-bar" role="group" aria-label="업종 선택">
        <span class="cml-filter-label">업종</span>
        ${filterBtns}
      </div>

      <div id="cml-kpi-row" class="cml-kpi-row" aria-live="polite"></div>

      <div class="cml-charts-grid">
        <div class="cml-chart-card">
          <div class="cml-chart-header">
            <h3 id="cml-bar-title">어느 동에 ${escapeHtml(state.industry)} 점포가 많나요?</h3>
            <span id="cml-bar-badge" class="cml-industry-badge">${escapeHtml(state.industry)}</span>
          </div>
          <div id="cml-chart-bar" class="cml-echart" aria-label="행정동별 점포 수 막대차트"></div>
          <p class="cml-chart-summary">막대 길이와 값 라벨로 행정동별 점포 수를 비교합니다. 막대축은 0에서 시작합니다.</p>
        </div>

        <div class="cml-chart-card">
          <div class="cml-chart-header">
            <h3>조회한 점포는 어떤 업종으로 구성되나요?</h3>
            <span class="cml-industry-badge">전체</span>
          </div>
          <div id="cml-chart-donut" class="cml-echart" aria-label="업종 구성 도넛차트"></div>
          <p class="cml-chart-summary">색상에 의존하지 않고 아래 데이터 표에서 업종별 정확한 값과 합계를 확인할 수 있습니다.</p>
        </div>

        <div class="cml-chart-card cml-chart-card--wide reveal">
          <div class="cml-chart-header">
            <h3 id="cml-line-title">${escapeHtml(state.industry)} 점포 수는 월별로 어떻게 변했나요?</h3>
            <span id="cml-line-badge" class="cml-industry-badge">${escapeHtml(state.industry)}</span>
          </div>
          <div id="cml-chart-line" class="cml-echart cml-echart--tall" aria-label="월별 점포 수 추이 라인차트"></div>
          <p class="cml-chart-summary">가로축은 월, 세로축은 점포 수입니다. 정확한 값은 각 점의 툴팁과 원자료에서 확인합니다.</p>
          ${renderDataStamp("commercial", `${state.industry} 업종`)}
        </div>

        <div class="cml-chart-card cml-chart-card--wide reveal">
          <div class="cml-chart-header">
            <h3>동마다 업종 구성은 어떻게 다른가요?</h3>
            <span class="cml-industry-badge">전체 업종</span>
          </div>
          <div id="cml-chart-cross" class="cml-echart cml-echart--tall" aria-label="행정동별 업종 교차 막대차트"></div>
          <p class="cml-chart-summary">누적 막대와 동일한 값을 바로 아래 표와 CSV로 제공합니다.</p>
        </div>

        <div class="cml-chart-card cml-chart-card--wide reveal">
          <div class="cml-chart-header">
            <h3>행정동별 업종 현황 데이터</h3>
            <a class="cml-download-link" href="${commercialCsvHref()}" download="geumcheon-commercial-by-dong.csv">CSV 내려받기</a>
          </div>
          ${buildCrossTable()}
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

  // 최다 점포 행정동 계산
  const byDong   = item?.byDong ?? [];
  const topDong  = byDong.length ? byDong.reduce((a, b) => (a.count >= b.count ? a : b)) : null;

  el.innerHTML = `
    <article class="cml-kpi-card">
      <div class="cml-kpi-icon" style="background:var(--amber-wash);color:var(--amber)">${icon("bar-chart", { size: 16 })}</div>
      <p>전체 점포</p>
      <strong>${Number(item.total).toLocaleString()}<span>개</span></strong>
    </article>
    <article class="cml-kpi-card">
      <div class="cml-kpi-icon" style="background:var(--green-wash);color:var(--green)">${icon("pin", { size: 16 })}</div>
      <p>500m 반경</p>
      <strong>${Number(item.radius).toLocaleString()}<span>개</span></strong>
    </article>
    <article class="cml-kpi-card">
      <div class="cml-kpi-icon" style="background:var(--blue-wash);color:var(--blue)">${icon("trending-up", { size: 16 })}</div>
      <p>경쟁 밀도</p>
      <strong style="color:${densityColor}">${escapeHtml(item.density)}</strong>
    </article>
    <article class="cml-kpi-card">
      <div class="cml-kpi-icon" style="background:var(--teal-wash);color:var(--teal)">${icon("map", { size: 16 })}</div>
      <p>최다 점포 동</p>
      <strong style="font-size:var(--text-xl)">${topDong ? escapeHtml(topDong.name) : "—"}</strong>
    </article>
  `;
}

// ─── ECharts 초기화 ───────────────────────────────────────────

function initCharts() {
  const barEl   = document.getElementById("cml-chart-bar");
  const donutEl = document.getElementById("cml-chart-donut");
  const lineEl  = document.getElementById("cml-chart-line");
  const crossEl = document.getElementById("cml-chart-cross");
  if (!barEl || !donutEl || !lineEl) return;

  chartBar   = createChart(barEl,   buildBarOption());
  chartDonut = createChart(donutEl, buildDonutOption());
  chartLine  = createChart(lineEl,  buildLineOption());
  if (crossEl) chartCross = createChart(crossEl, buildCrossOption());
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
  const data = INDUSTRIES.map((ind, i) => ({
    name: ind,
    value: Number(commercial[ind]?.total ?? 0),
    itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
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
      itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
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

/** 행정동 × 업종 데이터 테이블 */
function buildCrossTable() {
  const commercial = state.data?.commercial ?? {};
  const matrix = buildCommercialMatrix(commercial, INDUSTRIES, COMMERCIAL_DONGS);
  const rows = matrix.rows.map((row) => `
    <tr><th scope="row" class="cml-dt-dong">${escapeHtml(row.dong)}</th>
      ${row.values.map((value) => `<td class="cml-dt-val">${value.toLocaleString()}</td>`).join("")}
      <td class="cml-dt-total">${row.total.toLocaleString()}</td></tr>
  `);
  const footCells = matrix.columnTotals.map((total) => `<td class="cml-dt-total">${total.toLocaleString()}</td>`);

  return `
    <div class="cml-table-wrap">
      <table class="cml-table" aria-label="행정동 업종 현황">
        <thead>
          <tr>
            <th>행정동</th>
            ${INDUSTRIES.map((ind) => `<th>${escapeHtml(ind)}</th>`).join("")}
            <th>합계</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
        <tfoot>
          <tr>
            <td class="cml-dt-foot">소계</td>
            ${footCells.join("")}
            <td class="cml-dt-foot cml-dt-total">${matrix.grandTotal.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function commercialCsvHref() {
  const matrix = buildCommercialMatrix(state.data?.commercial ?? {}, INDUSTRIES, COMMERCIAL_DONGS);
  return csvDataUrl(matrixToCsv(matrix));
}

/** 행정동 × 업종 교차 누적 막대 */
function buildCrossOption() {
  const commercial = state.data?.commercial ?? {};
  const DONGS = COMMERCIAL_DONGS;

  const series = INDUSTRIES.map((ind, idx) => {
    const values = DONGS.map((dong) => {
      const byDong = commercial[ind]?.byDong ?? [];
      const found  = byDong.find((d) => d.name === dong);
      return found ? Number(found.count || 0) : 0;
    });
    return {
      name: ind,
      type: "bar",
      stack: "dong",
      data: values,
      itemStyle: { color: CHART_PALETTE[idx % CHART_PALETTE.length] },
      label: {
        show: true,
        position: "inside",
        fontSize: 10,
        color: "#fff",
        formatter: (p) => p.value > 0 ? Number(p.value).toLocaleString() : "",
      },
      barMaxWidth: 56,
    };
  });

  return {
    ...BASE_OPTION,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const dong = escapeHtml(params[0]?.axisValue || "");
        const rows = params.map((p) =>
          `<div style="display:flex;justify-content:space-between;gap:16px">` +
          `<span style="color:#65736d">${escapeHtml(p.seriesName)}</span>` +
          `<strong>${Number(p.value).toLocaleString()}개</strong></div>`
        ).join("");
        const total = params.reduce((s, p) => s + Number(p.value || 0), 0);
        return `<div style="font-size:12px;min-width:160px">` +
          `<div style="font-weight:800;margin-bottom:4px;border-bottom:1px solid #e8edeb;padding-bottom:4px">${dong}</div>` +
          rows +
          `<div style="border-top:1px solid #e8edeb;margin-top:4px;padding-top:4px;font-weight:800">합계 ${Number(total).toLocaleString()}개</div>` +
          `</div>`;
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
      data: DONGS,
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.ink, fontSize: 12, fontFamily: BASE_OPTION.textStyle.fontFamily },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11,
                   formatter: (v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v },
      axisLine: { show: false },
    },
    series,
    animation: true,
  };
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  container.addEventListener("click", (e) => {
    const scopeBtn = e.target.closest(".cml-scope-btn");
    if (scopeBtn) {
      commercialScope = scopeBtn.dataset.scope === "BORDER_AREA" ? "BORDER_AREA" : "GEUMCHEON";
      container.querySelectorAll(".cml-scope-btn").forEach((button) => {
        const active = button.dataset.scope === commercialScope;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      refreshScopeCount();
      return;
    }

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
    const barTitle = document.getElementById("cml-bar-title");
    const lineTitle = document.getElementById("cml-line-title");
    if (barBadge)  barBadge.textContent  = state.industry;
    if (lineBadge) lineBadge.textContent = state.industry;
    if (barTitle) barTitle.textContent = `어느 동에 ${state.industry} 점포가 많나요?`;
    if (lineTitle) lineTitle.textContent = `${state.industry} 점포 수는 월별로 어떻게 변했나요?`;

    renderKpi();

    // ECharts가 아직 로드되지 않았으면 건너뜀 (initCharts에서 최신 state 반영)
    if (chartBar)  chartBar.setOption(buildBarOption());
    if (chartLine) chartLine.setOption(buildLineOption());
  });
}

async function refreshScopeCount() {
  const selectedScope = commercialScope;
  const queryScope = selectedScope === "BORDER_AREA"
    ? "GEUMCHEON,BORDER_AREA"
    : "GEUMCHEON";
  const note = document.getElementById("cml-scope-note");
  if (note) {
    note.textContent = selectedScope === "BORDER_AREA"
      ? "금천구 + 경계 생활권 · 외부 참고자료 제외"
      : "기본값 · 금천구 내부만";
  }

  const summary = await loadStoreScopeCount(queryScope);
  if (!isMounted || commercialScope !== selectedScope || !summary) return;

  const total = document.getElementById("cml-scope-total");
  if (total) total.textContent = Number(summary.count || 0).toLocaleString();
}
