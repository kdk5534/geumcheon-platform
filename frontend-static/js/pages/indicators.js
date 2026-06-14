// 분야별 지표 대시보드: 인구·경제·복지·보건·환경·교통·안전을 탭으로 통합 제공

import { loadECharts, createChart, disposeChart, BASE_OPTION, CHART_COLORS } from '../core/charts.js';
import { escapeHtml } from '../core/dom.js';

const CSS_ID = 'css-indicators';
const DATA_URL = './assets/data/indicators.json';

let isMounted = false;
let currentChart = null;
let currentDomainKey = '';

// ─── CSS 동적 주입 ───────────────────────────────────────────────
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement('link');
  link.id = CSS_ID;
  link.rel = 'stylesheet';
  link.href = './css/pages/indicators.css';
  document.head.appendChild(link);
}

// ─── 데이터 로드 ────────────────────────────────────────────────
async function loadData() {
  const r = await fetch(DATA_URL);
  return r.json();
}

// ─── 탭 버튼 렌더 ───────────────────────────────────────────────
function renderTabs(domains, activeKey) {
  return domains.map(d => `
    <button class="ind-tab${d.key === activeKey ? ' is-active' : ''}"
            data-domain="${escapeHtml(d.key)}"
            style="${d.key === activeKey ? `--tab-color:${d.color}` : ''}">
      ${escapeHtml(d.label)}
    </button>
  `).join('');
}

// ─── KPI 타일 그리드 ────────────────────────────────────────────
function renderKpis(domain) {
  return `<div class="ind-kpi-grid">
    ${domain.kpis.map(k => `
      <div class="ind-kpi-card">
        <span class="ind-kpi-label">${escapeHtml(k.label)}</span>
        <span class="ind-kpi-value" style="color:${domain.color}">${escapeHtml(k.value)}</span>
        <span class="ind-kpi-unit">${escapeHtml(k.unit)}</span>
        <span class="ind-kpi-change ind-change-${k.changeDir}">${escapeHtml(k.change)}</span>
      </div>
    `).join('')}
  </div>`;
}

// ─── 데이터 테이블 ──────────────────────────────────────────────
function renderTable(domain) {
  const { columns, rows } = domain.table;
  return `
  <div class="ind-table-wrap">
    <table class="ind-table">
      <thead>
        <tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// ─── 차트 렌더 (콤보: 막대 + 라인) ─────────────────────────────
async function renderChart(domain) {
  if (!isMounted) return;
  if (currentChart) { disposeChart(currentChart); currentChart = null; }

  await loadECharts();
  if (!isMounted) return;

  const chartEl = document.getElementById('ind-chart');
  if (!chartEl) return;

  const { categories, series } = domain.chart;
  const yAxes = [
    { type: 'value', axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: CHART_COLORS.line } } },
    { type: 'value', splitLine: { show: false }, axisLabel: { fontSize: 11, formatter: (v) => v } },
  ];

  const colors = [domain.color, '#bd1d77', '#245b9e', '#6556a3', '#b56b17'];

  const echartseries = series.map((s, i) => ({
    name: s.name,
    type: s.type,
    yAxisIndex: s.yAxisIndex || 0,
    data: s.data,
    smooth: s.type === 'line',
    symbol: s.type === 'line' ? 'circle' : 'none',
    symbolSize: 5,
    barMaxWidth: 32,
    itemStyle: { color: colors[i % colors.length] },
    lineStyle: s.type === 'line' ? { color: colors[i % colors.length], width: 2 } : undefined,
    areaStyle: undefined,
  }));

  const option = {
    ...BASE_OPTION,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { top: 4, textStyle: { fontSize: 11 }, data: series.map(s => s.name) },
    grid: { left: 16, right: 16, bottom: 40, top: 44, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontSize: 10, rotate: categories.length > 8 ? 30 : 0 },
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
    },
    yAxis: yAxes,
    series: echartseries,
  };

  currentChart = createChart(chartEl, option);
}

// ─── 분야 패널 렌더 ─────────────────────────────────────────────
function renderDomainPanel(domain) {
  const linkHtml = domain.link
    ? `<a class="ind-detail-link" href="${escapeHtml(domain.link)}">상세 분석 보기 →</a>`
    : '';

  document.getElementById('ind-kpis').innerHTML = renderKpis(domain);
  document.getElementById('ind-chart-title').textContent = domain.chart.title;
  document.getElementById('ind-chart').innerHTML = '';
  document.getElementById('ind-table').innerHTML = renderTable(domain);
  document.getElementById('ind-link').innerHTML = linkHtml;

  // 탭 활성 상태 갱신
  document.querySelectorAll('.ind-tab').forEach(btn => {
    const isActive = btn.dataset.domain === domain.key;
    btn.classList.toggle('is-active', isActive);
    if (isActive) btn.style.setProperty('--tab-color', domain.color);
    else btn.style.removeProperty('--tab-color');
  });

  renderChart(domain);
}

// ─── mount ──────────────────────────────────────────────────────
export async function mount(container) {
  isMounted = true;
  injectCss();

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-header-title">분야별 지표</h2>
      <p class="page-header-sub">인구·경제·복지·보건·환경·교통·안전 분야별 핵심 지표를 한 화면에서 확인하세요.</p>
    </div>
    <div class="ind-loading" id="ind-loading">데이터를 불러오는 중입니다...</div>
  `;

  try {
    const data = await loadData();
    if (!isMounted) return;

    const first = data.domains[0];
    currentDomainKey = first.key;

    container.innerHTML = `
      <div class="page-header">
        <h2 class="page-header-title">분야별 지표</h2>
        <p class="page-header-sub">인구·경제·복지·보건·환경·교통·안전 분야별 핵심 지표를 한 화면에서 확인하세요.</p>
        <p class="page-header-updated">기준일: ${escapeHtml(data.updatedAt)}</p>
      </div>
      <div class="ind-tab-bar" id="ind-tab-bar" role="tablist">
        ${renderTabs(data.domains, currentDomainKey)}
      </div>
      <div class="ind-panel">
        <div id="ind-kpis"></div>
        <div class="ind-chart-card">
          <div class="ind-chart-head">
            <h3 class="ind-chart-title" id="ind-chart-title"></h3>
            <span id="ind-link"></span>
          </div>
          <div id="ind-chart" style="height:280px"></div>
        </div>
        <div id="ind-table"></div>
      </div>
    `;

    // 탭 클릭 이벤트
    document.getElementById('ind-tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('.ind-tab');
      if (!btn) return;
      const domain = data.domains.find(d => d.key === btn.dataset.domain);
      if (!domain || domain.key === currentDomainKey) return;
      currentDomainKey = domain.key;
      renderDomainPanel(domain);
    });

    // 첫 분야 렌더
    renderDomainPanel(first);

  } catch (err) {
    console.error('[indicators] 데이터 로드 오류:', err);
    const loading = document.getElementById('ind-loading');
    if (loading) loading.textContent = '데이터를 불러오지 못했습니다.';
  }
}

// ─── unmount ─────────────────────────────────────────────────────
export function unmount() {
  isMounted = false;
  if (currentChart) { disposeChart(currentChart); currentChart = null; }
}
