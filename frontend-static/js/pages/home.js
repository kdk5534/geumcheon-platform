// 홈 대시보드: 히어로 배너 + 검색 + KPI 카드(아이콘+카운터) + 인사이트 차트 + 주제 진입 카드

import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { getSectionMeta, sourceModeText } from "../core/meta.js";
import { loadECharts, createChart, disposeChart, CHART_PALETTE, CHART_COLORS, BASE_OPTION } from "../core/charts.js";
import { icon } from "../core/icons.js";

// metric 인덱스별 아이콘·테마 컬러 (ECharts에서 쓰므로 실제 hex 값으로 선언)
const METRIC_CONFIG = [
  { iconName: "activity",  color: "#146b4a", bgColor: "#e6f1ed", tip: "실시간 환경·기상 지표 (기상청 금천구 관측)" },
  { iconName: "filter",    color: "#b56b17", bgColor: "#fef3e2", tip: "상권·유동인구 현황 (유동인구 분석 기준)" },
  { iconName: "alert",     color: "#bd493c", bgColor: "#fdeeed", tip: "안전·재난 경보 발령 건수 (행안부 집계)" },
  { iconName: "bar-chart", color: "#245b9e", bgColor: "#e6edf8", tip: "주민등록 인구 통계 (행정안전부 기준)" },
];

// 모듈-레벨 차트 인스턴스
const sparklines = [];
let insightChartLeft  = null;
let insightChartRight = null;
let isMounted = false;

function disposeSparklines() {
  sparklines.forEach((c) => { try { c.dispose(); } catch {} });
  sparklines.length = 0;
}

/** hex 색상 문자열 → rgba 문자열 변환. ECharts 그라데이션에서 CSS 변수 대신 사용. */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function injectCss() {
  if (!document.getElementById("css-page-home")) {
    const link = document.createElement("link");
    link.id = "css-page-home";
    link.rel = "stylesheet";
    link.href = "./css/pages/home.css";
    document.head.appendChild(link);
  }
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  isMounted = true;
  injectCss();
  container.innerHTML = buildHomeHtml();
  bindSearch(container);
  renderMetrics();
  renderStatsStrip();
  renderPopularDatasets(container); // 비동기, ECharts 로딩을 막지 않음

  try {
    await loadECharts();
    if (!isMounted) return;
    if (document.getElementById("home-metrics")) {
      renderSparklines();
      animateMetricValues();
    }
    renderInsightCharts();
  } catch {}
}

export function unmount() {
  isMounted = false;
  disposeSparklines();
  disposeChart(insightChartLeft);  insightChartLeft  = null;
  disposeChart(insightChartRight); insightChartRight = null;
}

// ─── 카운터 애니메이션 ───────────────────────────────────────

/** 숫자가 포함된 .metric-value 요소들을 0부터 올려가며 애니메이션한다. */
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
      el.textContent = isDecimal
        ? current.toFixed(1) + suffix
        : Math.floor(current).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

// ─── 렌더 함수 ────────────────────────────────────────────────

export function renderMetrics() {
  const grid = document.getElementById("home-metrics");
  if (!grid) return;

  if (!state.data?.metrics) {
    grid.innerHTML = Array.from({ length: 4 }).map(() =>
      `<div class="metric-card skeleton-card"></div>`
    ).join("");
    return;
  }

  grid.innerHTML = state.data.metrics.map((metric, idx) => {
    const cfg = METRIC_CONFIG[idx] || METRIC_CONFIG[0];
    const trendDir = getTrendDirection(metric.trend);

    // 숫자 추출 (카운터 애니메이션용): "12,840"→12840/"", "24.2℃"→24.2/"℃"
    const match = String(metric.value).match(/^([\d,]+(?:\.\d+)?)(.*)/);
    const rawNum = match ? match[1].replace(/,/g, "") : "";
    const numVal = match ? parseFloat(rawNum) : NaN;
    const suffix = match ? match[2].trim() : "";
    const hasCounter = !isNaN(numVal) && numVal > 1;

    return `
    <article class="metric-card">
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

  // 렌더 직후 카운터 실행 (ECharts 없어도 숫자 애니메이션은 항상 동작)
  requestAnimationFrame(() => animateMetricValues());
}

/** trend 배열에서 상승/하락 방향을 반환한다. */
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

    const cfg = METRIC_CONFIG[idx] || METRIC_CONFIG[0];
    const values = metric.trend.map((t) => t.value ?? t);
    const lineColor = cfg.color;
    const areaTop = hexToRgba(lineColor, 0.18);
    const areaBot = hexToRgba(lineColor, 0);

    const chart = window.echarts.init(el, null, { renderer: "svg" });
    chart.setOption({
      backgroundColor: "transparent",
      grid: { top: 2, bottom: 2, left: 2, right: 2 },
      xAxis: { type: "category", show: false, data: values.map((_, i) => i) },
      yAxis: { type: "value", show: false, min: "dataMin", max: "dataMax" },
      series: [{
        type: "line",
        data: values,
        smooth: true,
        symbol: "none",
        lineStyle: { color: lineColor, width: 1.8 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: areaTop },
              { offset: 1, color: areaBot }
            ]
          }
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
  renderHeroStats();
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
      <span>대표 동 인구</span>
      <strong${pop ? ` data-counter="${pop}" data-suffix="명"` : ""}>${pop ? pop.toLocaleString() + "명" : "—"}</strong>
    </div>
  `;

  // 카운트 업 애니메이션 실행
  animateHeroCounters(wrap);
}

/** 풀너비 통계 스트립을 state 데이터로 채운다. */
export function renderStatsStrip() {
  if (!state.data) return;

  const pop = state.data.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
  const commercial = state.data.commercial;
  const commercialTotal = commercial
    ? Object.values(commercial).reduce((s, cat) => s + Number(cat.total || 0), 0)
    : 0;
  const facilities = state.data.facilities?.length || 0;
  const sources = (Array.isArray(state.apiSources) ? state.apiSources.length : 0) || 6;

  const animate = (el, target, suffix = "", decimal = false) => {
    if (!el || !target) return;
    const duration = 1200;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = eased * target;
      el.textContent = decimal
        ? val.toFixed(1) + suffix
        : Math.floor(val).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const popEl  = document.getElementById("strip-population");
  const comEl  = document.getElementById("strip-commercial");
  const facEl  = document.getElementById("strip-facilities");
  const srcEl  = document.getElementById("strip-sources");

  if (pop > 0)              { popEl.textContent  = "0명"; animate(popEl,  pop,            "명"); }
  if (commercialTotal > 0)  { comEl.textContent  = "0";   animate(comEl,  commercialTotal, "");  }
  if (facilities > 0)       { facEl.textContent  = "0건"; animate(facEl,  facilities,     "건"); }
  if (sources > 0)          { srcEl.textContent  = "0종"; animate(srcEl,  sources,        "종"); }
}

/** hero stat 카드 숫자를 0에서 목표값으로 ease-out 카운트 업한다. */
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

function renderInsightCharts() {
  if (!state.data || !window.echarts) return;
  renderInsightCommercial();
  renderInsightPopulation();
}

function renderInsightCommercial() {
  const el = document.getElementById("insight-commercial-chart");
  if (!el) return;

  const commercial = state.data.commercial;
  if (!commercial) return;

  const categories = [];
  const values = [];

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
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const p = params[0];
        if (!p) return "";
        return `<div style="font-size:12px"><strong>${p.name}</strong>` +
          `<div style="margin-top:3px;color:#65736d">${Number(p.value).toLocaleString()}개 점포</div></div>`;
      },
    },
    grid: { top: 4, bottom: 4, left: 52, right: 36 },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily }
    },
    series: [{
      type: "bar",
      data: values,
      barMaxWidth: 16,
      itemStyle: {
        color: (params) => CHART_PALETTE[params.dataIndex % CHART_PALETTE.length],
        borderRadius: [0, 4, 4, 0]
      },
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
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const p = params[0];
        if (!p) return "";
        return `<div style="font-size:12px"><strong>${p.name}</strong>` +
          `<div style="margin-top:3px;color:#65736d">총 ${Number(p.value).toLocaleString()}명</div></div>`;
      },
    },
    grid: { top: 4, bottom: 28, left: 8, right: 8 },
    xAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: CHART_COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11, fontFamily: BASE_OPTION.textStyle.fontFamily }
    },
    yAxis: { type: "value", show: false },
    series: [{
      type: "bar",
      data: totals,
      barMaxWidth: 48,
      itemStyle: {
        color: (params) => CHART_PALETTE[params.dataIndex % CHART_PALETTE.length],
        borderRadius: [6, 6, 0, 0]
      },
      label: {
        show: true, position: "top",
        formatter: (p) => (p.value / 10000).toFixed(1) + "만",
        color: CHART_COLORS.text, fontSize: 11
      }
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

    const key = Object.keys(ROUTE_MAP).find((k) => k.toLowerCase() === query || k.toLowerCase().includes(query) || query.includes(k.toLowerCase()));
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

// ─── 템플릿 ───────────────────────────────────────────────────

function buildHomeHtml() {
  const { asOf } = getSectionMeta("overview");
  const sourceText = state.data ? sourceModeText(state.data.sourceMode) : "로드 중";

  return `
    <section class="home-hero" aria-label="금천 데이터플랫폼 소개">
      <div class="home-hero-deco" aria-hidden="true">${buildHeroDeco()}</div>
      <div class="home-hero-inner">
        <div class="home-hero-copy">
          <p class="eyebrow hero-eyebrow" id="home-eyebrow">${escapeHtml(asOf)} 기준 · ${escapeHtml(sourceText)}</p>
          <h1>금천구<br>도시·생활 데이터플랫폼</h1>
          <p>생활시설, 교통, 대기, 상권 지표를 한 화면에서 확인하고<br>
             지도 기반 분석으로 이어지는 구민용 데이터 서비스입니다.</p>

          <form class="home-search-form" role="search" aria-label="화면 검색">
            <label class="sr-only" for="home-search-input">화면 검색</label>
            <div class="home-search-wrap">
              <span class="home-search-icon" aria-hidden="true">${icon("search", { size: 16 })}</span>
              <input
                id="home-search-input"
                class="home-search-input"
                type="search"
                placeholder="화면 검색 (예: 상권, 지도, 인구…)"
                autocomplete="off"
                spellcheck="false">
              <button class="home-search-btn" type="submit">이동</button>
            </div>
          </form>

          <div class="home-hero-badges">
            <span class="home-mode-badge" id="home-mode-badge" aria-label="현재 데이터 모드">${escapeHtml(sourceText)}</span>
            <span class="home-hero-tag">${icon("check", { size: 12 })} WCAG AA 준수</span>
            <span class="home-hero-tag">${icon("refresh-cw", { size: 12 })} 실시간 수집</span>
          </div>
        </div>

        <div class="home-hero-stats" id="home-hero-stats" aria-label="서비스 현황">
          <div class="home-stat-card">
            <span>데이터 소스</span>
            <strong>6종</strong>
          </div>
          <div class="home-stat-card">
            <span>수집 정상</span>
            <strong class="ok">대기</strong>
          </div>
          <div class="home-stat-card">
            <span>등록 시설</span>
            <strong>—</strong>
          </div>
          <div class="home-stat-card">
            <span>대표 동 인구</span>
            <strong>—</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- 풀너비 통계 스트립 -->
    <section class="home-stats-strip" id="home-stats-strip" aria-label="금천구 주요 통계">
      <div class="home-strip-item">
        <div class="home-strip-num" id="strip-population">—</div>
        <div class="home-strip-label">금천구 총인구</div>
      </div>
      <div class="home-strip-item">
        <div class="home-strip-num" id="strip-commercial">—</div>
        <div class="home-strip-label">상권 점포 수</div>
      </div>
      <div class="home-strip-item">
        <div class="home-strip-num" id="strip-facilities">—</div>
        <div class="home-strip-label">등록 생활시설</div>
      </div>
      <div class="home-strip-item">
        <div class="home-strip-num" id="strip-sources">6종</div>
        <div class="home-strip-label">데이터 소스</div>
      </div>
    </section>

    <div class="home-section-label">
      <h2>주요 지표</h2>
      <span>실시간 · Mock 집계</span>
    </div>

    <section class="metric-grid" id="home-metrics" aria-label="주요 지표">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>

    <div class="home-insight-row" aria-label="데이터 인사이트">
      <div class="home-insight-card">
        <div class="home-insight-header">
          <div class="home-insight-icon blue">${icon("bar-chart", { size: 18 })}</div>
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
    </div>

    ${buildDataStatusSection()}

    ${buildNoticesSection()}

    <!-- 인기 데이터셋 (카탈로그 미리보기) -->
    <div class="home-section-label" style="margin-top: var(--space-8)">
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
  `;
}

/** 공지사항 섹션 — 참조 포털의 공지/새소식 영역 */
function buildNoticesSection() {
  const notices = [
    { type: "공지", title: "2026년 2분기 상권 데이터 정기 업데이트 완료", date: "2026.06.13", link: "#" },
    { type: "안내", title: "금천구 집계구 GIS 데이터 신규 추가 (가산동·독산동·시흥동)", date: "2026.06.01", link: "#" },
    { type: "공지", title: "API 수집 서버 점검 안내 (6월 둘째 주 토요일 02:00–04:00)", date: "2026.05.28", link: "#" },
    { type: "새소식", title: "행안부 주민등록 API 연동 시범 운영 시작", date: "2026.05.15", link: "#" },
    { type: "안내", title: "플랫폼 베타 오픈: 금천구 생활 데이터 서비스 개시", date: "2026.04.01", link: "#" },
  ];

  const badgeCls = { "공지": "notice-badge--green", "안내": "notice-badge--blue", "새소식": "notice-badge--amber" };

  const rows = notices.map((n) => `
    <li class="home-notice-item">
      <span class="home-notice-badge ${badgeCls[n.type] || ""}">${escapeHtml(n.type)}</span>
      <a class="home-notice-title" href="${escapeHtml(n.link)}">${escapeHtml(n.title)}</a>
      <time class="home-notice-date" datetime="${escapeHtml(n.date)}">${escapeHtml(n.date)}</time>
    </li>
  `).join("");

  return `
    <div class="home-section-label" style="margin-top: var(--space-8)">
      <h2>공지사항</h2>
      <a class="home-section-more" href="#" aria-label="공지사항 전체보기">전체보기 →</a>
    </div>
    <div class="home-notices" role="region" aria-label="공지사항">
      <ul class="home-notice-list">
        ${rows}
      </ul>
    </div>
  `;
}

/** 데이터 수집 현황 섹션 — 참조 포털의 "최신 데이터/공지" 영역에 해당 */
function buildDataStatusSection() {
  const datasets = [
    { label: "기상 관측", source: "기상청 초단기 API",   updated: "2026.06.13 16:00", status: "ready" },
    { label: "시설 정보", source: "금천구 생활시설 DB",  updated: "2026.06.13 00:00", status: "ready" },
    { label: "상권 정보", source: "상가업소정보 API",    updated: "2026.06.02 15:40", status: "mock"  },
    { label: "인구 통계", source: "행안부 주민등록 API", updated: "2026.06.01 00:00", status: "mock"  },
    { label: "집계구 GIS",source: "행안부 집계구 API",   updated: "2026.06.01 00:00", status: "mock"  },
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
      <div class="home-ds-head">
        <div>데이터셋</div>
        <div>출처</div>
        <div>최근 업데이트</div>
        <div>상태</div>
      </div>
      ${rows}
    </div>
  `;
}

/** 인기 데이터셋 스켈레톤 플레이스홀더 */
function buildPopularDatasetsSkeleton() {
  return Array(4).fill(`<div class="skeleton" style="height:100px;border-radius:var(--radius-xl)"></div>`).join("");
}

/** datasets.json을 로드해 인기 데이터셋 그리드를 렌더한다. */
async function renderPopularDatasets(container) {
  try {
    const res = await fetch("./assets/data/datasets.json");
    if (!res.ok) return;
    const data = await res.json();
    const top = [...(data.datasets || [])]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 4);

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
          <span class="home-popular-cat" style="background:${color.bg};color:${color.fg}">
            ${escapeHtml(d.category)}
          </span>
          <strong class="home-popular-title">${escapeHtml(d.title)}</strong>
          <p class="home-popular-org">${escapeHtml(d.org)}</p>
          <div class="home-popular-meta">
            <span>${escapeHtml(types)}</span>
            <span>${icon("list", { size: 11 })} ${views}회</span>
          </div>
        </a>
      `;
    }).join("");
  } catch {
    /* 로드 실패 시 스켈레톤 유지 */
  }
}

function buildHeroDeco() {
  return `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="hero-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.5" fill="rgba(255,255,255,0.06)"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hero-dots)"/>
    <circle cx="92%" cy="20%" r="180" fill="rgba(255,255,255,0.025)"/>
    <circle cx="85%" cy="75%" r="100" fill="rgba(20,107,74,0.12)"/>
  </svg>`;
}

function buildTopicCards() {
  const topics = [
    { route: "catalog",    iconName: "database",  iconClass: "green",  title: "데이터 카탈로그", desc: "금천구·서울시·국가기관의 공공데이터 24종을 검색·분류·열람합니다. 카테고리별 필터와 형식 검색 지원.",     label: "카탈로그 보기" },
    { route: "map",        iconName: "map",       iconClass: "teal",   title: "생활지도",        desc: "시설 위치와 행정동 경계를 지도 위에서 확인합니다. 병원·약국·주차장·안전 시설을 권역별로 비교합니다.",   label: "시설 지도 보기" },
    { route: "commercial", iconName: "bar-chart", iconClass: "amber",  title: "상권분석",        desc: "업종별 점포 수와 행정동 경쟁 밀도를 막대차트로 비교합니다. 카페·음식점·편의점·학원 필터를 지원합니다.", label: "상권 분석 보기" },
    { route: "geo",        iconName: "pin",       iconClass: "blue",   title: "집계구 분석",     desc: "행정동·집계구 단위로 생활·교통·안전 접근성 지표를 비교합니다. 반경 분석과 권역 비교를 지원합니다.",      label: "집계구 분석 보기" },
    { route: "population", iconName: "users",     iconClass: "teal",   title: "인구 분석",       desc: "행정동별 인구 피라미드와 연령대 분포를 시각화합니다. 남녀 성비와 총인구 현황을 비교합니다.",             label: "인구 분석 보기" },
    { route: "api",        iconName: "activity",  iconClass: "violet", title: "API 수집 현황",   desc: "공공데이터 API 연결 상태와 수집 이력을 확인합니다. 수동 재수집을 실행할 수 있습니다.",                  label: "API 현황 보기" },
    { route: "api-logs",   iconName: "list",      iconClass: "blue",   title: "수집 로그",       desc: "API 수집 실행 내역을 필터링하고 검색합니다. 상태별·소스별로 수집 결과를 추적합니다.",                   label: "로그 보기" },
    { route: "admin",      iconName: "settings",  iconClass: "navy",   title: "관리자",          desc: "데이터셋 메타데이터를 관리하고 CSV/Excel 파일을 업로드합니다. 컬럼 매핑과 검증을 지원합니다.",            label: "관리 화면 열기" }
  ];

  // accent: 카드 상단 강조선 색 (CSS 변수로 전달)
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
