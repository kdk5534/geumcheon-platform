// home 페이지 HTML 템플릿 빌더·계산 유틸 — 표현 로직만 담당하는 순수 함수 모음

import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { getSectionMeta, sourceModeText } from "../core/meta.js";

export const CHOROPLETH_METRICS = ["생활", "교통", "안전", "인구"];

/**
 * 상권 점포 합계를 계산한다. byDong 배열이 있으면 행정동 합산 기준으로 계산한다.
 * renderKpiTiles·renderStatsStrip·buildReportSection이 공용한다.
 * @returns {number}
 */
export function calcCommercialTotal() {
  const commercial = state.data?.commercial;
  if (!commercial) return 0;
  return Object.values(commercial).reduce((s, cat) => {
    const byDong = cat?.byDong;
    return s + (byDong ? byDong.reduce((t, d) => t + (d.count ?? 0), 0) : Number(cat.total || 0));
  }, 0);
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────

function buildMiniNotices() {
  const notices = [
    { type: "공지",   title: "2026년 2분기 상권 데이터 업데이트 완료", date: "06.13", href: "#/commercial" },
    { type: "안내",   title: "금천구 집계구 GIS 데이터 신규 추가",      date: "06.01", href: "#/geo" },
    { type: "새소식", title: "행안부 주민등록 API 연동 시범 운영",       date: "05.15", href: "#/api" },
    { type: "공지",   title: "생활지도 시설 데이터 214건 갱신",          date: "05.10", href: "#/map" },
    { type: "안내",   title: "카탈로그 신규 데이터셋 4종 등록",          date: "05.01", href: "#/catalog" },
  ];
  const cls = { "공지": "notice-badge--green", "안내": "notice-badge--blue", "새소식": "notice-badge--amber" };
  return `<ul class="home-mini-notice-list">
    ${notices.map((n) => `
      <li class="home-mini-notice-item">
        <span class="home-notice-badge ${cls[n.type] || ""}">${escapeHtml(n.type)}</span>
        <a class="home-mini-notice-title" href="${escapeHtml(n.href)}">${escapeHtml(n.title)}</a>
        <time class="home-mini-notice-date">${escapeHtml(n.date)}</time>
      </li>
    `).join("")}
  </ul>`;
}

function buildPopularDatasetsSkeleton() {
  return Array(4).fill(`<div class="skeleton" style="height:100px;border-radius:var(--radius-xl)"></div>`).join("");
}

function buildReportSection() {
  const commercialTotal = calcCommercialTotal();
  const pop       = state.data?.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
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
      statLabel: "주민등록 인구",    title: "인구 현황",    desc: "연령대·성별·행정동별 인구 구조 분석",            link: "#/population", linkLabel: "인구 분석 보기" },
    { grad: "var(--grad-amber)",  iconName: "bar-chart", stat: commercialTotal ? Number(commercialTotal).toLocaleString() + "개" : "692개",
      statLabel: "등록 점포 수",     title: "상권 분석",    desc: "업종별 점포 수·행정동 경쟁 밀도 비교",           link: "#/commercial", linkLabel: "상권 분석 보기" },
    { grad: "var(--grad-blue)",   iconName: "pin",       stat: avgScore ? avgScore + "점" : "68.4점",
      statLabel: "평균 접근성 지수", title: "집계구 접근성", desc: "생활·교통·안전 접근성 지수 권역별 비교",         link: "#/geo",        linkLabel: "집계구 분석 보기" },
    { grad: "var(--grad-teal)",   iconName: "database",  stat: facilities ? facilities + "건" : "214건",
      statLabel: "등록 생활시설",    title: "공공데이터",   desc: "금천구·서울시·행정기관 24종 데이터셋 열람",       link: "#/catalog",    linkLabel: "카탈로그 보기" },
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
    const total   = pop  ? Number(pop.total).toLocaleString() : "—";
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
    { label: "기상 관측",  source: "기상청 초단기 API",   updated: "2026.06.13 16:00", status: "ready" },
    { label: "시설 정보",  source: "금천구 생활시설 DB",  updated: "2026.06.13 00:00", status: "ready" },
    { label: "상권 정보",  source: "상가업소정보 API",    updated: "2026.06.02 15:40", status: "mock"  },
    { label: "인구 통계",  source: "행안부 주민등록 API", updated: "2026.06.01 00:00", status: "mock"  },
    { label: "집계구 GIS", source: "행안부 집계구 API",   updated: "2026.06.01 00:00", status: "mock"  },
    { label: "API 로그",   source: "내부 수집 로그 DB",   updated: "2026.06.13 16:00", status: "ready" },
  ];
  const statusBadge = (s) => {
    if (s === "ready") return `<span class="home-ds-badge home-ds-badge--green">${icon("check",    { size: 10 })} 정상</span>`;
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
    { route: "realtime",   iconName: "activity",     iconClass: "teal",   title: "실시간 도시현황", desc: "재난·교통·환경·안전 현황을 지도와 차트로 실시간 모니터링합니다.", label: "현황 보기" },
    { route: "indicators", iconName: "bar-chart",    iconClass: "green",  title: "분야별 지표",     desc: "인구·경제·복지·보건·환경·교통·안전 7개 분야 핵심 지표 대시보드.", label: "지표 보기" },
    { route: "catalog",    iconName: "database",     iconClass: "green",  title: "데이터 카탈로그", desc: "금천구·서울시·국가기관의 공공데이터 24종을 검색·분류·열람합니다.", label: "카탈로그 보기" },
    { route: "map",        iconName: "map",          iconClass: "teal",   title: "생활지도",        desc: "시설 위치와 행정동 경계를 지도 위에서 확인합니다. 권역별 비교 지원.", label: "시설 지도 보기" },
    { route: "commercial", iconName: "shopping-bag", iconClass: "amber",  title: "상권분석",        desc: "업종별 점포 수와 행정동 경쟁 밀도를 막대차트로 비교합니다.", label: "상권 분석 보기" },
    { route: "geo",        iconName: "pin",          iconClass: "blue",   title: "집계구 분석",     desc: "행정동·집계구 단위로 생활·교통·안전 접근성 지표를 비교합니다.", label: "집계구 분석 보기" },
    { route: "population", iconName: "users",        iconClass: "teal",   title: "인구 분석",       desc: "행정동별 인구 피라미드와 연령대 분포를 시각화합니다.", label: "인구 분석 보기" },
    { route: "about",      iconName: "info",         iconClass: "violet", title: "이용안내",        desc: "플랫폼 소개·데이터 출처·관련 사이트를 안내합니다.", label: "안내 보기" },
  ];
  const ACCENT_MAP = {
    realtime: "#0d93cf", indicators: "#0c7fb8", catalog: "#0c7fb8",
    map:      "#0d93cf", commercial: "#b56b17", geo:     "#245b9e",
    population: "#0d93cf", about: "#6556a3",
  };
  return topics.map((topic) => {
    const accent = ACCENT_MAP[topic.route] || "#0c7fb8";
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

// ─── 공개 API ─────────────────────────────────────────────────

/**
 * 홈 대시보드 전체 HTML을 빌드한다.
 * @param {string} metric - 현재 choropleth 지표 (homeChoroplethMetric)
 * @returns {string} HTML 문자열
 */
export function buildDashHtml(metric) {
  const { asOf } = getSectionMeta("overview");
  const sourceText     = state.data ? sourceModeText(state.data.sourceMode) : "로드 중";
  const facilityCount  = Array.isArray(state.data?.facilities) ? state.data.facilities.length : 0;
  const pop            = state.data?.population?.reduce((s, p) => s + Number(p.total || 0), 0) || 0;
  const totalSources   = Array.isArray(state.apiSources) ? state.apiSources.length : 6;

  const metricBtns = CHOROPLETH_METRICS.map((m) => `
    <button class="home-map-metric-btn${m === metric ? " is-active" : ""}"
            data-metric="${escapeHtml(m)}"
            aria-pressed="${m === metric}">${escapeHtml(m)}</button>
  `).join("");

  return `
<div class="home-dash">

  <!-- ─ 상단 타이틀 띠 — 슬림 단행 (상황판 밀도) ─ -->
  <header class="home-dash-header">
    <div class="home-dash-brand">
      <p class="home-dash-eyebrow" id="home-eyebrow">${escapeHtml(asOf)} 기준 · ${escapeHtml(sourceText)}</p>
      <h1 class="home-dash-title-text">금천구 도시·생활 데이터플랫폼</h1>
    </div>

    <div class="home-dash-header-stats" aria-label="주요 통계">
      <div class="home-hdr-stat">
        <span class="home-hdr-stat-val">${pop ? (pop / 10000).toFixed(1) + "만" : "—"}</span>
        <span class="home-hdr-stat-label">총인구</span>
      </div>
      <div class="home-hdr-stat">
        <span class="home-hdr-stat-val">${facilityCount || "—"}</span>
        <span class="home-hdr-stat-label">시설</span>
      </div>
      <div class="home-hdr-stat">
        <span class="home-hdr-stat-val">${totalSources}</span>
        <span class="home-hdr-stat-label">데이터소스</span>
      </div>
    </div>

    <form class="home-search-form home-dash-search" role="search" aria-label="화면 검색">
      <label class="sr-only" for="home-search-input">화면 검색</label>
      <div class="home-search-wrap">
        <span class="home-search-icon" aria-hidden="true">${icon("search", { size: 14 })}</span>
        <input id="home-search-input" class="home-search-input" type="search"
               placeholder="상권·지도·인구…"
               autocomplete="off" spellcheck="false">
        <button class="home-search-btn" type="submit">이동</button>
      </div>
    </form>

    <div class="home-dash-badges">
      <span class="home-mode-badge" id="home-mode-badge" aria-label="현재 데이터 모드">${escapeHtml(sourceText)}</span>
      <a class="home-dash-badge-link" href="#/api">${icon("activity", { size: 11 })} API</a>
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
      <div class="home-right-panel home-rt-summary-panel">
        <div class="home-right-panel-hdr">
          <span class="home-rt-live-badge">● LIVE</span>
          <span style="flex:1">도시현황</span>
          <a class="home-right-link" href="#/realtime">더보기 →</a>
        </div>
        <div id="home-rt-summary" class="home-rt-summary">
          <div class="home-rt-kpi"><strong class="home-rt-kpi-num" id="rt-critical">—</strong><span>위급</span></div>
          <div class="home-rt-kpi"><strong class="home-rt-kpi-num home-rt-warning" id="rt-warning">—</strong><span>주의</span></div>
          <div class="home-rt-kpi"><strong class="home-rt-kpi-num home-rt-normal" id="rt-normal">—</strong><span>정상</span></div>
        </div>
      </div>

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
          <a class="home-right-link" href="#/catalog">더보기</a>
        </div>
        ${buildMiniNotices()}
      </div>

      <div class="home-right-panel">
        <div class="home-right-panel-hdr">
          <span>분석 바로가기</span>
        </div>
        <div class="home-quick-links">
          <a class="home-quick-link" href="#/commercial">${icon("bar-chart", { size:14 })} 상권분석</a>
          <a class="home-quick-link" href="#/population">${icon("users",     { size:14 })} 인구분석</a>
          <a class="home-quick-link" href="#/geo">${icon("pin",         { size:14 })} 집계구</a>
          <a class="home-quick-link" href="#/map">${icon("map",         { size:14 })} 생활지도</a>
          <a class="home-quick-link" href="#/catalog">${icon("database",   { size:14 })} 카탈로그</a>
          <a class="home-quick-link" href="#/api">${icon("activity",   { size:14 })} API 현황</a>
        </div>
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

  <div class="home-section-label" style="margin-top:var(--space-6)">
    <h2>데이터 인사이트</h2>
    <span>업종·인구·접근성 핵심 지표</span>
  </div>

  <div class="home-insight-row home-insight-row--2col" aria-label="데이터 인사이트">
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
          <p class="home-insight-sub">행정동별 총인구 및 고령화율</p>
        </div>
        <a class="home-insight-link" href="#/population">자세히 ${icon("arrow-right", { size: 14 })}</a>
      </div>
      <div class="home-insight-chart" id="insight-population-chart"></div>
    </div>
  </div>

  <div class="home-insight-row home-insight-row--1col" aria-label="집계구 접근성 인사이트">
    <div class="home-insight-card">
      <div class="home-insight-header">
        <div class="home-insight-icon teal">${icon("map", { size: 18 })}</div>
        <div>
          <p class="home-insight-label">집계구 접근성 지수</p>
          <p class="home-insight-sub">행정동별 생활·교통·안전 접근성 누적 비교</p>
        </div>
        <a class="home-insight-link" href="#/geo">자세히 ${icon("arrow-right", { size: 14 })}</a>
      </div>
      <div class="home-insight-chart home-insight-chart--wide" id="insight-geo-chart"></div>
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
