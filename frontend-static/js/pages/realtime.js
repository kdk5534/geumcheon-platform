// 실시간 도시현황 페이지: 재난·교통·환경·안전 실시간 모니터링 대시보드

import { loadECharts, createChart, disposeChart, BASE_OPTION, CHART_PALETTE, CHART_COLORS } from '../core/charts.js';
import { escapeHtml } from '../core/dom.js';

const CSS_ID = 'css-realtime';
const DATA_URL = './assets/data/realtime.json';

let isMounted = false;
let leafletLoaded = false;
let rtMap = null;
let rtChart = null;
let refreshTimer = null;

const LEVEL_LABEL = { critical: '위급', warning: '주의', normal: '정상' };
const LEVEL_COLOR = { critical: 'var(--red)', warning: 'var(--amber)', normal: 'var(--teal)' };
const CATEGORY_ICON = {
  화재: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z"/></svg>`,
  교통: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V6a2 2 0 014 0v2M13 8V6a2 2 0 014 0v2M7 20v2M17 20v2"/></svg>`,
  환경: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
  안전: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-4 9-8 10-4-1-8-5-8-10V6z"/></svg>`,
};

// ─── Leaflet 로더 (map.js 패턴) ─────────────────────────────────
function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }
    const ex = document.getElementById('leaflet-css');
    if (!ex) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (document.getElementById('leaflet-js')) {
      const waiting = setInterval(() => { if (window.L) { clearInterval(waiting); resolve(); } }, 50);
      return;
    }
    const s = document.createElement('script');
    s.id = 'leaflet-js';
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Leaflet 로드 실패'));
    document.head.appendChild(s);
  });
}

// ─── CSS 동적 주입 ───────────────────────────────────────────────
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement('link');
  link.id = CSS_ID;
  link.rel = 'stylesheet';
  link.href = './css/pages/realtime.css';
  document.head.appendChild(link);
}

// ─── 데이터 로드 ────────────────────────────────────────────────
async function loadData() {
  const r = await fetch(DATA_URL);
  return r.json();
}

// ─── 렌더: 요약 KPI 타일 ────────────────────────────────────────
function renderSummary(summary) {
  const items = [
    { key: 'critical', label: '위급', icon: '🚨' },
    { key: 'warning',  label: '주의', icon: '⚠️' },
    { key: 'normal',   label: '정상', icon: '✅' },
  ];
  return `<div class="rt-summary-grid">
    ${items.map(i => `
      <div class="rt-summary-card rt-level-${i.key}">
        <span class="rt-summary-icon">${i.icon}</span>
        <span class="rt-summary-count">${summary[i.key]}</span>
        <span class="rt-summary-label">${i.label}</span>
      </div>
    `).join('')}
  </div>`;
}

// ─── 렌더: 이벤트 목록 테이블 ───────────────────────────────────
function renderEvents(events) {
  return `
  <div class="rt-events-header">
    <h3 class="rt-section-title">최근 발생 목록</h3>
  </div>
  <div class="rt-events-list">
    ${events.map(ev => `
      <div class="rt-event-row rt-level-${ev.level}">
        <div class="rt-event-meta">
          <span class="rt-event-time">${escapeHtml(ev.time)}</span>
          <span class="rt-event-category">${CATEGORY_ICON[ev.category] || ''} ${escapeHtml(ev.category)}</span>
          <span class="rt-event-status rt-status-${ev.level}">${escapeHtml(ev.status)}</span>
        </div>
        <div class="rt-event-body">
          <span class="rt-event-location">📍 ${escapeHtml(ev.location)}</span>
          <p class="rt-event-detail">${escapeHtml(ev.detail)}</p>
        </div>
      </div>
    `).join('')}
  </div>`;
}

// ─── 렌더: 실시간 환경 지표 바 ─────────────────────────────────
function renderIndicators(indicators) {
  const entries = Object.entries(indicators);
  return `<div class="rt-env-grid">
    ${entries.map(([k, v]) => `
      <div class="rt-env-card rt-status-${v.status}">
        <span class="rt-env-label">${escapeHtml(v.label || k)}</span>
        <span class="rt-env-value">${escapeHtml(String(v.value))}<small>${escapeHtml(v.unit)}</small></span>
        <span class="rt-env-dot rt-dot-${v.status}"></span>
      </div>
    `).join('')}
  </div>`;
}

// ─── 차트: 시간별 발생 추이 라인 ────────────────────────────────
async function renderTrendChart(container, trend) {
  await loadECharts();
  const hours = trend.map(t => t.hour);
  const option = {
    ...BASE_OPTION,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['화재', '교통', '환경', '안전'], top: 4, textStyle: { fontSize: 11 } },
    grid: { left: 28, right: 16, bottom: 36, top: 40, containLabel: true },
    xAxis: { type: 'category', data: hours, axisLabel: { fontSize: 11 }, axisLine: { lineStyle: { color: CHART_COLORS.line } } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: CHART_COLORS.line } } },
    series: [
      { name: '화재', type: 'line', smooth: true, data: trend.map(t => t.fire), symbol: 'circle', symbolSize: 5 },
      { name: '교통', type: 'line', smooth: true, data: trend.map(t => t.accident), symbol: 'circle', symbolSize: 5 },
      { name: '환경', type: 'line', smooth: true, data: trend.map(t => t.environment), symbol: 'circle', symbolSize: 5 },
      { name: '안전', type: 'line', smooth: true, data: trend.map(t => t.safety), symbol: 'circle', symbolSize: 5 },
    ],
    color: [CHART_PALETTE[5], CHART_PALETTE[1], CHART_PALETTE[0], CHART_PALETTE[3]],
  };
  rtChart = createChart(container, option);
}

// ─── 지도 초기화 ────────────────────────────────────────────────
async function initMap(data) {
  await loadLeaflet();
  if (!isMounted) return;

  const mapEl = document.getElementById('rt-map');
  if (!mapEl || rtMap) return;

  rtMap = window.L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView([37.4565, 126.8954], 13);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(rtMap);

  // 이벤트 마커 추가 (location 텍스트 기반 금천구 근사 위치)
  const coords = {
    '가산동': [37.4812, 126.8846],
    '독산동': [37.4621, 126.8959],
    '시흥동': [37.4430, 126.9012],
  };
  const levelColors = { critical: '#e84040', warning: '#de7b12', normal: '#0d93cf' };

  data.events.forEach(ev => {
    const dong = Object.keys(coords).find(d => ev.location.includes(d)) || '가산동';
    const [lat, lng] = coords[dong];
    const jitterLat = lat + (Math.random() - 0.5) * 0.01;
    const jitterLng = lng + (Math.random() - 0.5) * 0.01;
    const color = levelColors[ev.level] || '#0d93cf';
    const icon = window.L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    window.L.marker([jitterLat, jitterLng], { icon })
      .addTo(rtMap)
      .bindPopup(`<b>${ev.category}</b><br>${ev.location}<br><small>${ev.time} · ${ev.status}</small>`);
  });
}

// ─── 업데이트 시각 포맷 ─────────────────────────────────────────
function formatUpdatedAt(iso) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 기준`;
  } catch { return ''; }
}

// ─── mount ──────────────────────────────────────────────────────
export async function mount(container) {
  isMounted = true;
  injectCss();

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-header-title">실시간 도시현황</h2>
      <p class="page-header-sub">금천구 재난·교통·환경·안전 현황을 실시간으로 모니터링합니다.</p>
    </div>
    <div class="rt-body">
      <div class="rt-map-panel">
        <div class="rt-map-toolbar">
          <span class="rt-live-badge">● LIVE</span>
          <span class="rt-updated" id="rt-updated">로딩 중...</span>
        </div>
        <div id="rt-map" class="rt-map-container" aria-label="실시간 도시현황 지도"></div>
        <div class="rt-map-legend">
          <span class="rt-legend-dot" style="background:#e84040"></span>위급&nbsp;&nbsp;
          <span class="rt-legend-dot" style="background:#de7b12"></span>주의&nbsp;&nbsp;
          <span class="rt-legend-dot" style="background:#0d93cf"></span>정상
        </div>
      </div>
      <div class="rt-side-panel">
        <div id="rt-indicators"></div>
        <div id="rt-summary"></div>
        <div class="rt-chart-card">
          <h3 class="rt-section-title">시간대별 발생 추이 (오늘)</h3>
          <div id="rt-trend-chart" style="height:200px"></div>
        </div>
        <div id="rt-events"></div>
      </div>
    </div>
  `;

  try {
    const data = await loadData();
    if (!isMounted) return;

    document.getElementById('rt-updated').textContent = formatUpdatedAt(data.updatedAt);
    document.getElementById('rt-indicators').innerHTML = renderIndicators(data.indicators);
    document.getElementById('rt-summary').innerHTML = renderSummary(data.summary);
    document.getElementById('rt-events').innerHTML = renderEvents(data.events);

    const trendEl = document.getElementById('rt-trend-chart');
    if (trendEl) await renderTrendChart(trendEl, data.hourlyTrend);

    await initMap(data);
  } catch (err) {
    console.error('[realtime] 데이터 로드 오류:', err);
  }
}

// ─── unmount ─────────────────────────────────────────────────────
export function unmount() {
  isMounted = false;
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  if (rtChart) { disposeChart(rtChart); rtChart = null; }
  if (rtMap) { rtMap.remove(); rtMap = null; }
}
