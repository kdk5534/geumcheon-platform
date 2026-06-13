// 집계구 분석 페이지: 비교기준 필터 + 권역 목록 + 레이더·비교·접근성 ECharts 차트

import { state, GEO_METRICS } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import {
  currentGeoDistrict,
  currentCommercialIndustryData,
  getIndustryDistrictSnapshot,
  defaultGeoRecommendation
} from "../core/selectors.js";
import { loadECharts, createChart, disposeChart, CHART_PALETTE, CHART_COLORS } from "../core/charts.js";
import { icon } from "../core/icons.js";

// 모듈-레벨 차트 인스턴스
let chartRadar = null;
let chartComparison = null;
let chartAccess = null;
let isMounted = false;

// ─── CSS 주입 ─────────────────────────────────────────────────

function injectCss() {
  if (!document.getElementById("css-page-geo")) {
    const link = document.createElement("link");
    link.id = "css-page-geo";
    link.rel = "stylesheet";
    link.href = "./css/pages/geo.css";
    document.head.appendChild(link);
  }
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  isMounted = true;
  injectCss();
  container.innerHTML = buildHtml();
  renderAll();
  bindEvents(container);

  try {
    await loadECharts();
  } catch (e) {
    console.error("ECharts 로드 실패:", e);
    return;
  }
  if (!isMounted) return;

  initAllCharts();
}

export function unmount() {
  isMounted = false;
  disposeChart(chartRadar);      chartRadar = null;
  disposeChart(chartComparison); chartComparison = null;
  disposeChart(chartAccess);     chartAccess = null;
}

// ─── HTML 구조 ────────────────────────────────────────────────

function buildHtml() {
  const metricOptions = GEO_METRICS.map((m) =>
    `<option value="${escapeHtml(m)}"${state.geoMetric === m ? " selected" : ""}>${escapeHtml(m)}</option>`
  ).join("");

  return `
    <div class="geo-page">
      <div class="page-header">
        <div class="page-header-copy">
          <p class="eyebrow">집계구 분석</p>
          <h2>금천구 생활권 비교</h2>
          <p class="page-header-sub">행정동·집계구 단위 생활·교통·안전 접근성 지표를 비교·분석합니다.</p>
        </div>
        <a class="page-back" href="#/home">◀ 홈으로</a>
      </div>

      <div class="geo-filter-bar">
        <label class="geo-filter-label" for="geo-metric-select">비교 기준</label>
        <select id="geo-metric-select" class="geo-metric-select" aria-label="비교 기준 선택">
          ${metricOptions}
        </select>
      </div>

      <div id="geo-summary" class="geo-summary-row" aria-live="polite"></div>

      <div class="geo-main-grid">
        <div class="geo-district-panel">
          <div class="geo-district-panel-header" id="districtListHelp">
            권역 선택 (키보드: ↑↓ 이동, Enter 선택)
          </div>
          <div class="geo-district-list" id="districtList" role="list" aria-label="권역 목록"></div>
        </div>
        <div class="geo-detail-panels">
          <div id="geoSpotlight"></div>
          <div id="geoComparison"></div>
        </div>
      </div>

      <div class="geo-bottom-row">
        <div id="geoRadius"></div>
        <div class="geo-card">
          <h3 class="geo-card-title">생활 접근성 지수</h3>
          <div id="geo-access-chart" class="geo-echart geo-echart--access" aria-label="접근성 지수 가로 막대차트"></div>
        </div>
      </div>
    </div>
  `;
}

// ─── 전체 렌더 ────────────────────────────────────────────────

function renderAll() {
  if (!state.data) return;
  renderGeoSummary();
  renderGeoDistricts();
  renderGeoSpotlight();
  renderGeoComparison();
  renderGeoRadius();
}

function initAllCharts() {
  initRadarChart();
  initComparisonChart();
  initAccessChart();
}

// ─── 요약 KPI ────────────────────────────────────────────────

function renderGeoSummary() {
  const el = document.getElementById("geo-summary");
  if (!el) return;

  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  if (districts.length === 0) {
    el.innerHTML = `<p class="geo-empty">집계구 데이터가 없습니다.</p>`;
    return;
  }

  const bestDistrict = districts.reduce((best, cur) =>
    Number(cur.scores?.[state.geoMetric] || 0) > Number(best.scores?.[state.geoMetric] || 0) ? cur : best
  , districts[0]);

  const avgScore = Math.round(
    districts.reduce((sum, d) => sum + Number(d.scores?.[state.geoMetric] || 0), 0) / districts.length
  );

  if (!currentGeoDistrict()) {
    state.geoDistrict = bestDistrict?.name || districts[0]?.name || "가산동";
  }

  el.innerHTML = `
    <article class="geo-summary-kpi">
      <div class="geo-kpi-icon" style="background:#e6edf8;color:#245b9e">${icon("filter", { size: 15 })}</div>
      <span>비교 기준</span>
      <strong>${escapeHtml(state.geoMetric)}</strong>
    </article>
    <article class="geo-summary-kpi">
      <div class="geo-kpi-icon" style="background:#e4f2f4;color:#197982">${icon("activity", { size: 15 })}</div>
      <span>권역 평균 점수</span>
      <strong>${avgScore}점</strong>
    </article>
    <article class="geo-summary-kpi">
      <div class="geo-kpi-icon" style="background:#e6f1ed;color:#146b4a">${icon("trending-up", { size: 15 })}</div>
      <span>최고 권역</span>
      <strong>${escapeHtml(bestDistrict?.name || "-")}</strong>
    </article>
  `;
}

// ─── 권역 목록 ────────────────────────────────────────────────

function renderGeoDistricts() {
  const el = document.getElementById("districtList");
  if (!el) return;

  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  const metric = state.geoMetric;
  const ranked = [...districts].sort((a, b) =>
    Number(b.scores?.[metric] || 0) - Number(a.scores?.[metric] || 0)
  );
  const topScore = Math.max(...ranked.map((d) => Number(d.scores?.[metric] || 0)), 1);
  const activeDistrict = currentGeoDistrict();
  const industryData = currentCommercialIndustryData();

  el.innerHTML = ranked.map((district, index) => {
    const score = Number(district.scores?.[metric] || 0);
    const width = Math.max(8, Math.round((score / topScore) * 100));
    const snapshot = getIndustryDistrictSnapshot(industryData, district.name);
    const isLeader = snapshot?.rank === 1;
    const isActive = activeDistrict?.name === district.name;
    const ariaLabel = [district.name, `${score}점`, district.zone || "", isLeader ? `${state.industry} 업종 1위` : ""].filter(Boolean).join(" · ");

    return `
      <article
        class="district-card${index === 0 ? " is-leading" : ""}${isActive ? " is-active" : ""}${isLeader ? " is-industry-leading" : ""}"
        data-district-name="${escapeHtml(district.name)}"
        tabindex="0"
        role="button"
        aria-pressed="${isActive}"
        aria-label="${escapeHtml(ariaLabel)}"
        aria-describedby="districtListHelp"
      >
        <div class="district-head">
          <div>
            <p>${escapeHtml(district.zone || district.name)}</p>
            <strong>${escapeHtml(district.name)}</strong>
          </div>
          <div class="district-head-meta">
            <span>${score}점</span>
            ${isLeader ? `<small>${escapeHtml(state.industry)} 1위</small>` : ""}
          </div>
        </div>
        <div class="district-bar" aria-hidden="true">
          <div class="district-bar-fill" style="width:${width}%"></div>
        </div>
        <dl class="district-meta">
          <div><dt>생활시설</dt><dd>${escapeHtml(district.facilities)}</dd></div>
          <div><dt>교통</dt><dd>${escapeHtml(district.transit)}</dd></div>
          <div><dt>안전</dt><dd>${escapeHtml(district.safety)}</dd></div>
        </dl>
        <p>${escapeHtml(district.note)}</p>
      </article>
    `;
  }).join("");
}

// ─── 스포트라이트 ────────────────────────────────────────────

function renderGeoSpotlight() {
  const el = document.getElementById("geoSpotlight");
  if (!el) return;

  const district = currentGeoDistrict();
  if (!district) {
    el.innerHTML = `<div class="geo-empty">집계구를 선택하세요.</div>`;
    return;
  }

  const scores = district.scores || {};
  const val = Number(scores[state.geoMetric] || 0);
  const trendLabel = val >= 85 ? "매우 우수" : val >= 75 ? "우수" : val >= 65 ? "보통" : "보완 필요";
  const recommendation = district.recommendation || defaultGeoRecommendation(district);

  el.innerHTML = `
    <article class="geo-spotlight-card">
      <div class="geo-spotlight-head">
        <div>
          <p>${escapeHtml(district.zone || "집계구")}</p>
          <h3>${escapeHtml(district.name)}</h3>
        </div>
        <div class="geo-spotlight-score">
          <strong>${val}점</strong>
          <span>${escapeHtml(trendLabel)}</span>
        </div>
      </div>
      <div id="geo-chart-radar" class="geo-echart" aria-label="권역 레이더 차트"></div>
      <p class="geo-spotlight-note">${escapeHtml(district.note)}</p>
      <div class="geo-spotlight-reco">
        <span>추천 포인트</span>
        <strong>${escapeHtml(recommendation)}</strong>
      </div>
      ${renderDataStamp("geo", `${state.geoMetric} spotlight`)}
    </article>
  `;

  // 차트 컨테이너가 새로 삽입됐으므로 ECharts가 로드된 경우 즉시 재초기화
  if (window.echarts) {
    disposeChart(chartRadar); chartRadar = null;
    initRadarChart();
  }
}

// ─── 권역 비교 ────────────────────────────────────────────────

function renderGeoComparison() {
  const el = document.getElementById("geoComparison");
  if (!el) return;

  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  const district = currentGeoDistrict();
  if (!district || districts.length === 0) {
    el.innerHTML = `<div class="geo-empty">권역 비교 데이터를 불러올 수 없습니다.</div>`;
    return;
  }

  const industryData = currentCommercialIndustryData();
  const industrySnapshot = getIndustryDistrictSnapshot(industryData, district.name);
  const industryMessage = !industrySnapshot
    ? `${escapeHtml(state.industry)} 업종 분포를 불러오지 못했습니다.`
    : industrySnapshot.rank === 1
      ? `${escapeHtml(district.name)}은(는) ${escapeHtml(state.industry)} 업종이 가장 강한 권역입니다.`
      : `${escapeHtml(district.name)}은(는) ${escapeHtml(state.industry)} 업종에서 ${industrySnapshot.rank}위로, 선두권까지 ${industrySnapshot.gapToLeader}개 차이입니다.`;

  const metricRows = GEO_METRICS.map((metric) => {
    const values = districts.map((d) => Number(d.scores?.[metric] || 0));
    const score = Number(district.scores?.[metric] || 0);
    const average = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const leader = Math.max(...values);
    const rank = values.filter((v) => v > score).length + 1;
    return { metric, score, average, leader, rank, gapToLeader: leader - score, gapToAverage: score - average };
  });

  const strongest = [...metricRows].sort((a, b) => b.score - a.score)[0];
  const weakest = [...metricRows].sort((a, b) => b.gapToLeader - a.gapToLeader)[0];
  const currentRow = metricRows.find((r) => r.metric === state.geoMetric) || metricRows[0];

  const industryBars = industrySnapshot
    ? industrySnapshot.ranked.map((row) => {
        const width = Math.max(12, Math.round(
          (Number(row.count || 0) / Math.max(Number(industrySnapshot.leader?.count || 0), 1)) * 100
        ));
        return `
          <div class="geo-industry-row ${row.name === district.name ? "is-active" : ""}">
            <div class="geo-industry-row-head">
              <strong>${escapeHtml(row.name)}</strong>
              <span>${Number(row.count || 0)}개</span>
            </div>
            <div class="geo-industry-track" aria-hidden="true">
              <div class="geo-industry-fill" style="width:${width}%"></div>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="geo-empty">업종 분포를 불러올 수 없습니다.</div>`;

  el.innerHTML = `
    <article class="geo-comparison-card">
      <div class="panel-title">
        <div>
          <p class="eyebrow">권역 비교</p>
          <h3>${escapeHtml(district.name)}의 강점과 보완점</h3>
        </div>
        <span>${escapeHtml(state.geoMetric)} 기준</span>
      </div>

      <div class="geo-comparison-head">
        <div class="geo-comparison-score">
          <span>현재 점수</span>
          <strong>${currentRow.score}점</strong>
          <small>${escapeHtml(String(currentRow.rank))}위 / ${districts.length}개 권역</small>
        </div>
        <div class="geo-comparison-delta">
          <div>
            <span>평균 대비</span>
            <strong class="${currentRow.gapToAverage >= 0 ? "is-positive" : "is-negative"}">${currentRow.gapToAverage >= 0 ? "+" : ""}${currentRow.gapToAverage}점</strong>
          </div>
          <div>
            <span>선두권 대비</span>
            <strong class="${currentRow.gapToLeader <= 0 ? "is-positive" : "is-negative"}">${currentRow.gapToLeader === 0 ? "동률" : `-${currentRow.gapToLeader}점`}</strong>
          </div>
        </div>
      </div>

      <div id="geo-chart-comparison" class="geo-echart geo-echart--comparison" aria-label="권역 비교 그룹 막대 차트"></div>

      <div class="geo-comparison-insight">
        <div><span>가장 강한 항목</span><strong>${escapeHtml(strongest.metric)} ${strongest.score}점</strong></div>
        <div><span>보완 우선 항목</span><strong>${escapeHtml(weakest.metric)} ${weakest.gapToLeader}점 차이</strong></div>
        <div><span>집중 제안</span><strong>${escapeHtml(weakest.metric)}을(를) 먼저 보완하면 상위권 진입 폭이 큽니다.</strong></div>
      </div>

      ${renderDataStamp("geo", `${state.geoMetric} 비교`)}

      <div class="geo-industry-card">
        <div class="panel-title">
          <div>
            <p class="eyebrow">업종 연결</p>
            <h3>${escapeHtml(state.industry)} 기준 권역 적합도</h3>
          </div>
          <span>${escapeHtml(industryData?.density || "분포")}</span>
        </div>
        <div class="geo-industry-summary">
          <div><span>현재 권역</span><strong>${industrySnapshot ? `${industrySnapshot.districtRow.count}개` : "-"}</strong></div>
          <div><span>업종 순위</span><strong>${industrySnapshot ? `${industrySnapshot.rank}위` : "-"}</strong></div>
          <div><span>평균</span><strong>${industrySnapshot ? `${industrySnapshot.average}개` : "-"}</strong></div>
          <div><span>1위 권역</span><strong>${industrySnapshot ? `${industrySnapshot.leader.name} ${industrySnapshot.leader.count}개` : "-"}</strong></div>
        </div>
        <div class="geo-industry-bars">${industryBars}</div>
        <p class="geo-industry-note">${industryMessage}</p>
        ${renderDataStamp("commercial", `${state.industry} 업종`)}
      </div>
    </article>
  `;

  if (window.echarts) {
    disposeChart(chartComparison); chartComparison = null;
    initComparisonChart();
  }
}

// ─── 반경 분석 ────────────────────────────────────────────────

function renderGeoRadius() {
  const el = document.getElementById("geoRadius");
  if (!el) return;

  const district = currentGeoDistrict();
  if (!district) {
    el.innerHTML = `<div class="geo-empty">반경 분석 데이터를 불러올 수 없습니다.</div>`;
    return;
  }

  const radius = district.radius || {};
  const facilityCount = Number(radius.facilityCount || 0);
  const mobilityCount = Number(radius.mobilityCount || 0);
  const safetyCount = Number(radius.safetyCount || 0);
  const highlights = Array.isArray(radius.highlights) ? radius.highlights : [];
  const maxVal = Math.max(facilityCount, mobilityCount, safetyCount, 1);

  el.innerHTML = `
    <article class="geo-radius-card">
      <div class="panel-title">
        <div>
          <p class="eyebrow">반경 분석</p>
          <h3>${escapeHtml(district.name)} ${escapeHtml(radius.range || "500m")} 생활권</h3>
        </div>
        <span>${escapeHtml(radius.commercialLabel || "분석")}</span>
      </div>
      <div class="geo-radius-kpis">
        <div>
          <span>생활시설</span>
          <strong>${facilityCount}개</strong>
          <div class="geo-radius-bar"><div class="geo-radius-fill" style="width:${Math.max(12, Math.round((facilityCount/maxVal)*100))}%"></div></div>
        </div>
        <div>
          <span>교통 거점</span>
          <strong>${mobilityCount}개</strong>
          <div class="geo-radius-bar"><div class="geo-radius-fill alt" style="width:${Math.max(12, Math.round((mobilityCount/maxVal)*100))}%"></div></div>
        </div>
        <div>
          <span>안전 거점</span>
          <strong>${safetyCount}개</strong>
          <div class="geo-radius-bar"><div class="geo-radius-fill warm" style="width:${Math.max(12, Math.round((safetyCount/maxVal)*100))}%"></div></div>
        </div>
      </div>
      <div class="geo-radius-tags">
        ${highlights.map((h) => `<span>${escapeHtml(h)}</span>`).join("")}
      </div>
      <p>${escapeHtml(radius.note || district.note || "")}</p>
      ${renderDataStamp("geo", `${radius.range || "500m"} 반경`)}
    </article>
  `;
}

// ─── ECharts 차트 초기화 ──────────────────────────────────────

function initRadarChart() {
  const el = document.getElementById("geo-chart-radar");
  if (!el || !window.echarts) return;

  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  const district = currentGeoDistrict();
  if (!district) return;

  const avgScores = GEO_METRICS.map((m) => {
    const vals = districts.map((d) => Number(d.scores?.[m] || 0));
    return Math.round(vals.reduce((s, v) => s + v, 0) / Math.max(vals.length, 1));
  });

  const districtScores = GEO_METRICS.map((m) => Number(district.scores?.[m] || 0));

  chartRadar = createChart(el, {
    tooltip: {
      formatter: (params) => {
        if (!params || !params.value) return "";
        const vals = params.value;
        const rows = GEO_METRICS.map((m, i) =>
          `<div style="display:flex;justify-content:space-between;gap:12px;padding:1px 0">` +
          `<span style="color:#65736d">${m}</span>` +
          `<strong>${vals[i] != null ? vals[i] + "점" : "—"}</strong>` +
          `</div>`
        ).join("");
        return (
          `<div style="font-size:12px;min-width:148px">` +
          `<div style="font-weight:800;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #e8edeb">` +
          escapeHtml(params.name) + `</div>` + rows + `</div>`
        );
      },
    },
    legend: {
      data: [escapeHtml(district.name), "구 평균"],
      bottom: 0,
      textStyle: { color: CHART_COLORS.ink, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    radar: {
      indicator: GEO_METRICS.map((m) => ({ name: m, max: 100 })),
      center: ["50%", "48%"],
      radius: "62%",
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisName: { color: CHART_COLORS.ink, fontSize: 12, fontWeight: "bold" },
    },
    series: [{
      type: "radar",
      data: [
        {
          value: districtScores,
          name: escapeHtml(district.name),
          itemStyle: { color: CHART_PALETTE[0] },
          lineStyle: { color: CHART_PALETTE[0], width: 2 },
          areaStyle: { color: "rgba(20,107,74,0.15)" },
          symbol: "circle", symbolSize: 5,
        },
        {
          value: avgScores,
          name: "구 평균",
          itemStyle: { color: CHART_PALETTE[1] },
          lineStyle: { color: CHART_PALETTE[1], width: 2, type: "dashed" },
          areaStyle: { color: "rgba(25,121,130,0.08)" },
          symbol: "circle", symbolSize: 4,
        },
      ],
    }],
  });
}

function initComparisonChart() {
  const el = document.getElementById("geo-chart-comparison");
  if (!el || !window.echarts) return;

  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  const district = currentGeoDistrict();
  if (!district) return;

  const metricRows = GEO_METRICS.map((metric) => {
    const values = districts.map((d) => Number(d.scores?.[metric] || 0));
    const score = Number(district.scores?.[metric] || 0);
    const average = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const leader = Math.max(...values);
    return { metric, score, average, leader };
  });

  chartComparison = createChart(el, {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      data: [escapeHtml(district.name), "구 평균", "최고"],
      right: 0, top: 0,
      textStyle: { color: CHART_COLORS.ink, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 16, right: 16, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: metricRows.map((r) => r.metric),
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.ink, fontSize: 12 },
    },
    yAxis: {
      type: "value",
      min: 50, max: 100,
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11 },
      axisLine: { show: false },
    },
    series: [
      {
        name: escapeHtml(district.name),
        type: "bar",
        data: metricRows.map((r) => r.score),
        itemStyle: { color: CHART_PALETTE[0], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
        label: { show: true, position: "top", color: CHART_COLORS.ink, fontSize: 11,
                 formatter: (p) => p.value },
      },
      {
        name: "구 평균",
        type: "bar",
        data: metricRows.map((r) => r.average),
        itemStyle: { color: CHART_PALETTE[1], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
        label: { show: true, position: "top", color: CHART_COLORS.text, fontSize: 11,
                 formatter: (p) => p.value },
      },
      {
        name: "최고",
        type: "bar",
        data: metricRows.map((r) => r.leader),
        itemStyle: { color: CHART_COLORS.line, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
        label: { show: true, position: "top", color: CHART_COLORS.muted, fontSize: 11,
                 formatter: (p) => p.value },
      },
    ],
  });
}

function initAccessChart() {
  const el = document.getElementById("geo-access-chart");
  if (!el || !window.echarts) return;

  const access = Array.isArray(state.data?.access) ? state.data.access : [];
  if (access.length === 0) return;

  const names  = access.map((a) => a.name);
  const scores = access.map((a) => Number(a.score));
  const colors = scores.map((s) => s >= 80 ? CHART_PALETTE[0] : s >= 70 ? CHART_PALETTE[1] : CHART_PALETTE[4]);

  chartAccess = createChart(el, {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 16, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: CHART_COLORS.line } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.ink, fontSize: 11 },
    },
    series: [{
      type: "bar",
      data: scores.map((s, i) => ({ value: s, itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: "right", color: CHART_COLORS.text, fontSize: 11,
               formatter: (p) => `${p.value}점` },
      barMaxWidth: 32,
    }],
  });
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  container.addEventListener("change", (e) => {
    if (e.target.id === "geo-metric-select") {
      state.geoMetric = e.target.value || "생활";
      renderGeoSummary();
      renderGeoDistricts();
      renderGeoSpotlight();  // 레이더 차트 내부에서 재초기화
      renderGeoRadius();
      renderGeoComparison(); // 비교 차트 내부에서 재초기화
    }
  });

  container.addEventListener("click", (e) => {
    const card = e.target.closest("[data-district-name]");
    if (card) setGeoDistrict(card.dataset.districtName);
  });

  container.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      moveGeoDistrictSelection(e.key);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest("[data-district-name]");
      if (card) { e.preventDefault(); setGeoDistrict(card.dataset.districtName); }
    }
  });
}

function setGeoDistrict(districtName) {
  state.geoDistrict = districtName;
  renderGeoDistricts();
  renderGeoSpotlight();  // 레이더 차트 내부에서 재초기화
  renderGeoRadius();
  renderGeoComparison(); // 비교 차트 내부에서 재초기화
}

function moveGeoDistrictSelection(key) {
  const cards = Array.from(document.querySelectorAll("#districtList [data-district-name]"));
  if (cards.length === 0) return;

  const curIdx = Math.max(cards.findIndex((c) => c.dataset.districtName === state.geoDistrict), 0);
  let nextIdx = curIdx;

  if (key === "Home")                                    nextIdx = 0;
  else if (key === "End")                                nextIdx = cards.length - 1;
  else if (key === "ArrowDown" || key === "ArrowRight")  nextIdx = (curIdx + 1) % cards.length;
  else if (key === "ArrowUp" || key === "ArrowLeft")     nextIdx = (curIdx - 1 + cards.length) % cards.length;

  const nextName = cards[nextIdx]?.dataset.districtName;
  if (!nextName) return;

  setGeoDistrict(nextName);
  window.requestAnimationFrame(() => {
    const next = document.querySelector(`#districtList [data-district-name="${CSS.escape(nextName)}"]`);
    next?.focus();
  });
}
