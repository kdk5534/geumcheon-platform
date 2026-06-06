// 홈 대시보드: 히어로 배너 + KPI 카드 + 스파크라인 + 주제 진입 카드

import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { getSectionMeta, sourceModeText } from "../core/meta.js";
import { loadECharts, CHART_PALETTE, CHART_COLORS } from "../core/charts.js";

// 모듈-레벨 스파크라인 인스턴스 (unmount 시 dispose)
const sparklines = [];

function disposeSparklines() {
  sparklines.forEach((c) => { try { c.dispose(); } catch {} });
  sparklines.length = 0;
}

/** 홈 페이지 CSS를 동적으로 주입한다. 이미 있으면 중복 추가하지 않는다. */
function injectCss() {
  const id = "css-page-home";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "./css/pages/home.css";
    document.head.appendChild(link);
  }
}

/** 홈 페이지를 container에 마운트한다. */
export async function mount(container) {
  injectCss();
  container.innerHTML = buildHomeHtml();
  renderMetrics();

  // ECharts가 로드된 경우 스파크라인 추가 (실패해도 기본 카드는 정상 표시)
  try {
    await loadECharts();
    if (document.getElementById("home-metrics")) renderSparklines();
  } catch {}
}

/** 홈 페이지를 언마운트한다. */
export function unmount() {
  disposeSparklines();
}

// ─── 렌더 함수 ────────────────────────────────────────────────

/** KPI 카드 그리드를 갱신한다. state.data.metrics가 준비되지 않으면 스켈레톤을 유지한다. */
export function renderMetrics() {
  const grid = document.getElementById("home-metrics");
  if (!grid) {
    return;
  }

  if (!state.data?.metrics) {
    grid.innerHTML = `
      <div class="metric-card"><div class="metric-value">—</div><p class="metric-note">로드 중...</p></div>
      <div class="metric-card"><div class="metric-value">—</div></div>
      <div class="metric-card"><div class="metric-value">—</div></div>
      <div class="metric-card"><div class="metric-value">—</div></div>
    `;
    return;
  }

  grid.innerHTML = state.data.metrics.map((metric, idx) => `
    <article class="metric-card">
      <div class="metric-top">
        <span>${escapeHtml(metric.label)}</span>
        <span class="metric-badge">${escapeHtml(metric.badge)}</span>
      </div>
      <div class="metric-value">${escapeHtml(metric.value)}</div>
      ${metric.trend ? `<div class="metric-sparkline" data-metric-idx="${idx}"></div>` : ""}
      <p class="metric-note">${escapeHtml(metric.note)}</p>
    </article>
  `).join("");
}

/** KPI 카드 내 스파크라인을 ECharts 미니 라인 차트로 렌더한다. */
function renderSparklines() {
  disposeSparklines();
  if (!state.data?.metrics) return;

  state.data.metrics.forEach((metric, idx) => {
    if (!metric.trend?.length) return;
    const el = document.querySelector(`.metric-sparkline[data-metric-idx="${idx}"]`);
    if (!el) return;

    const values = metric.trend.map((t) => t.value ?? t);
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
        lineStyle: { color: CHART_PALETTE[0], width: 1.5 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: "rgba(20,107,74,0.25)" }, { offset: 1, color: "rgba(20,107,74,0)" }] } }
      }],
      animation: false
    });
    sparklines.push(chart);
  });
}

/** 데이터 갱신 후 스파크라인만 다시 그린다. renderMetrics() 이후 호출 전제. */
export function refreshSparklines() {
  renderSparklines();
}

/** 히어로 배너의 데이터 모드 배지와 eyebrow를 갱신한다. */
export function renderHeroMode() {
  const badge = document.getElementById("home-mode-badge");
  const eyebrow = document.getElementById("home-eyebrow");

  if (!state.data) {
    return;
  }

  const sourceText = sourceModeText(state.data.sourceMode);
  const { asOf } = getSectionMeta("overview");

  if (eyebrow) {
    eyebrow.textContent = `${asOf} 기준 · ${sourceText}`;
  }

  if (badge) {
    const hint = state.data.sourceModeError ? " · 일부 지연" : "";
    badge.textContent = `${sourceText}${hint}`;
  }
}

// ─── 템플릿 ───────────────────────────────────────────────────

function buildHomeHtml() {
  const { asOf } = getSectionMeta("overview");
  const sourceText = state.data ? sourceModeText(state.data.sourceMode) : "로드 중";

  return `
    <section class="home-hero" aria-label="금천 데이터플랫폼 소개">
      <div class="home-hero-inner">
        <div class="home-hero-copy">
          <p class="eyebrow" id="home-eyebrow">${escapeHtml(asOf)} 기준 · ${escapeHtml(sourceText)}</p>
          <h1>금천구<br>도시·생활 데이터플랫폼</h1>
          <p>생활시설, 교통, 대기, 상권 지표를 한 화면에서 확인하고<br>
             지도 기반 분석으로 이어지는 구민용 데이터 서비스입니다.</p>
          <span class="home-mode-badge" id="home-mode-badge" aria-label="현재 데이터 모드">${escapeHtml(sourceText)}</span>
        </div>

        <div class="home-hero-stats" aria-label="서비스 현황">
          <div class="home-stat-card">
            <span>데이터 소스</span>
            <strong>12종</strong>
          </div>
          <div class="home-stat-card">
            <span>수집 상태</span>
            <strong class="ok">정상</strong>
          </div>
          <div class="home-stat-card">
            <span>API 전환</span>
            <strong class="pending">준비중</strong>
          </div>
          <div class="home-stat-card">
            <span>백엔드</span>
            <strong>:8080</strong>
          </div>
        </div>
      </div>
    </section>

    <div class="home-section-label">
      <h2>주요 지표</h2>
      <span>실시간 · Mock 집계</span>
    </div>

    <section class="metric-grid" id="home-metrics" aria-label="주요 지표">
      <div class="metric-card"><div class="metric-value">—</div><p class="metric-note">로드 중...</p></div>
      <div class="metric-card"><div class="metric-value">—</div></div>
      <div class="metric-card"><div class="metric-value">—</div></div>
      <div class="metric-card"><div class="metric-value">—</div></div>
    </section>

    <div class="home-topics-header">
      <h2>분석 화면</h2>
      <p>아래 카드를 클릭해 세부 분석 화면으로 이동하세요.</p>
    </div>

    <nav class="topic-grid" aria-label="주요 분석 화면 바로가기">
      ${buildTopicCards()}
    </nav>
  `;
}

function buildTopicCards() {
  const topics = [
    {
      route: "map",
      icon: "🗺",
      iconClass: "green",
      title: "생활지도",
      desc: "시설 위치와 행정동 경계를 지도 위에서 확인합니다. 병원·약국·주차장·안전 시설을 권역별로 비교합니다.",
      label: "시설 지도 보기"
    },
    {
      route: "commercial",
      icon: "📊",
      iconClass: "amber",
      title: "상권분석",
      desc: "업종별 점포 수와 행정동 경쟁 밀도를 막대차트로 비교합니다. 카페·음식점·편의점·학원 필터를 지원합니다.",
      label: "상권 분석 보기"
    },
    {
      route: "geo",
      icon: "📍",
      iconClass: "teal",
      title: "집계구 분석",
      desc: "행정동·집계구 단위로 생활·교통·안전 접근성 지표를 비교합니다. 반경 분석과 권역 비교를 지원합니다.",
      label: "집계구 분석 보기"
    },
    {
      route: "population",
      icon: "👥",
      iconClass: "teal",
      title: "인구 분석",
      desc: "행정동별 인구 피라미드와 연령대 분포를 시각화합니다. 남녀 성비와 총인구 현황을 비교합니다.",
      label: "인구 분석 보기"
    },
    {
      route: "api",
      icon: "🔌",
      iconClass: "blue",
      title: "API 수집 현황",
      desc: "공공데이터 API 연결 상태와 수집 이력을 확인합니다. 수동 재수집을 실행할 수 있습니다.",
      label: "API 현황 보기"
    },
    {
      route: "api-logs",
      icon: "📋",
      iconClass: "violet",
      title: "수집 로그",
      desc: "API 수집 실행 내역을 필터링하고 검색합니다. 상태별·소스별로 수집 결과를 추적합니다.",
      label: "로그 보기"
    },
    {
      route: "admin",
      icon: "⚙",
      iconClass: "navy",
      title: "관리자",
      desc: "데이터셋 메타데이터를 관리하고 CSV/Excel 파일을 업로드합니다. 컬럼 매핑과 검증을 지원합니다.",
      label: "관리 화면 열기"
    }
  ];

  return topics.map((topic) => `
    <a class="topic-card" href="#/${escapeHtml(topic.route)}" aria-label="${escapeHtml(topic.title)} 화면으로 이동">
      <div class="topic-icon ${topic.iconClass}" aria-hidden="true">${topic.icon}</div>
      <h3>${escapeHtml(topic.title)}</h3>
      <p>${escapeHtml(topic.desc)}</p>
      <span class="topic-link">${escapeHtml(topic.label)} →</span>
    </a>
  `).join("");
}
