// API 수집 현황 페이지: 소스별 연동 상태 필터 + 카드 그리드

import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { renderDataStamp } from "../core/meta.js";
import { icon } from "../core/icons.js";

const FILTER_OPTIONS = ["전체", "준비됨", "Mock", "키 필요", "확인 필요"];

// ─── 상태 레이블/클래스 ───────────────────────────────────────

function apiStatusLabel(status) {
  return { ready: "준비됨", mock: "Mock", "key-needed": "키 필요", "check-required": "확인 필요" }[status] || "확인 필요";
}

function apiStatusClass(status) {
  return { ready: "is-ready", mock: "is-mock", "key-needed": "is-key", "check-required": "is-check" }[status] || "is-check";
}

// ─── 기본 소스 목록 ────────────────────────────────────────────

function defaultApiSources() {
  return [
    { datasetKey: "weather",    name: "기상 현황",         domain: "실시간", status: "mock",           refreshCycle: "10분", targetScreen: "메인 대시보드", envVar: "DATA_GO_KR_API_KEY",   source: "기상청",                lastSynced: "2026.06.02 16:00", note: "금천구 대표 좌표 기준 Mock 응답" },
    { datasetKey: "dust",       name: "미세먼지/초미세먼지", domain: "실시간", status: "key-needed",     refreshCycle: "시간",  targetScreen: "대기 현황",     envVar: "SEOUL_OPEN_API_KEY",   source: "서울 열린데이터광장",    lastSynced: "대기중",            note: "측정소 기준시각 표기 필요" },
    { datasetKey: "traffic",    name: "교통 알림",          domain: "실시간", status: "check-required",  refreshCycle: "실시간", targetScreen: "상황판",       envVar: "SEOUL_OPEN_API_KEY",   source: "서울 TOPIS",             lastSynced: "점검 필요",         note: "공사·통제·사고 이벤트 우선" },
    { datasetKey: "stores",     name: "상가업소 정보",       domain: "상권",   status: "ready",          refreshCycle: "수시", targetScreen: "상권분석",      envVar: "DATA_GO_KR_API_KEY",   source: "소상공인시장진흥공단",   lastSynced: "2026.06.02 15:40", note: "업종 분류와 좌표가 있어 핵심 데이터" },
    { datasetKey: "parking",    name: "공영주차장",          domain: "생활",   status: "mock",           refreshCycle: "수시", targetScreen: "생활지도",      envVar: "SEOUL_OPEN_API_KEY",   source: "서울/금천 열린데이터",  lastSynced: "2026.06.02 14:50", note: "정적 주차장 목록으로 개발 중" },
    { datasetKey: "population", name: "주민등록 인구",       domain: "인구",   status: "key-needed",     refreshCycle: "월",   targetScreen: "인구 대시보드", envVar: "SEOUL_OPEN_API_KEY",   source: "행안부/서울 열린데이터", lastSynced: "대기중",            note: "행정동 기준 우선" }
  ];
}

function mergeApiSources(rawSources = []) {
  const base = defaultApiSources();
  const map = new Map(rawSources.map((s) => [s.datasetKey || s.name, s]));
  const merged = base.map((s) => ({ ...s, ...(map.get(s.datasetKey || s.name) || {}) }));
  const baseKeys = new Set(base.map((s) => s.datasetKey || s.name));
  const extras = rawSources.filter((s) => !baseKeys.has(s.datasetKey || s.name));
  return merged.concat(extras);
}

// ─── CSS 주입 ─────────────────────────────────────────────────

function injectCss() {
  if (!document.getElementById("css-page-api")) {
    const link = document.createElement("link");
    link.id = "css-page-api";
    link.rel = "stylesheet";
    link.href = "./css/pages/api.css";
    document.head.appendChild(link);
  }
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

/** API 수집 현황 페이지를 container에 마운트한다. */
export function mount(container) {
  injectCss();

  // 외부 소스와 기본 소스를 병합해 state에 저장
  state.apiSources = mergeApiSources(Array.isArray(state.apiSources) ? state.apiSources : []);

  container.innerHTML = buildHtml();
  renderApiStatus();
  bindEvents(container);
}

/** API 수집 현황 페이지를 언마운트한다. */
export function unmount() {}

// ─── HTML 구조 ────────────────────────────────────────────────

function buildHtml() {
  const filterBtns = FILTER_OPTIONS.map((f) => `
    <button
      class="api-filter-btn${state.apiSourceFilter === f ? " is-active" : ""}"
      data-api-filter="${escapeHtml(f)}"
      aria-pressed="${state.apiSourceFilter === f}"
    >${escapeHtml(f)}</button>
  `).join("");

  return `
    <div class="api-page">
      <div class="page-header">
        <div class="page-header-copy">
          <p class="eyebrow">API 수집 현황</p>
          <h2>공공데이터 연동 상태</h2>
        </div>
        <a class="page-back" href="#/home">◀ 홈으로</a>
      </div>

      <div id="api-status-summary" class="api-summary-row" aria-live="polite"></div>

      <div class="api-filter-bar" role="group" aria-label="상태 필터">
        ${filterBtns}
      </div>

      <div id="api-source-grid" class="api-card-grid" aria-live="polite" aria-label="API 소스 목록"></div>
    </div>
  `;
}

// ─── 렌더 함수 ────────────────────────────────────────────────

function renderApiStatus() {
  const summaryEl = document.getElementById("api-status-summary");
  const gridEl = document.getElementById("api-source-grid");
  if (!summaryEl || !gridEl) return;

  const sources = state.apiSources;
  const counts = sources.reduce((acc, s) => {
    acc[s.status || "check-required"] = (acc[s.status || "check-required"] || 0) + 1;
    return acc;
  }, {});

  summaryEl.innerHTML = `
    <article class="api-summary-kpi api-summary-kpi--green">
      <div class="api-kpi-icon">${icon("check", { size: 15 })}</div>
      <span>준비됨</span><strong>${counts.ready || 0}</strong>
    </article>
    <article class="api-summary-kpi api-summary-kpi--blue">
      <div class="api-kpi-icon">${icon("database", { size: 15 })}</div>
      <span>Mock</span><strong>${counts.mock || 0}</strong>
    </article>
    <article class="api-summary-kpi api-summary-kpi--amber">
      <div class="api-kpi-icon">${icon("alert", { size: 15 })}</div>
      <span>키 필요</span><strong>${counts["key-needed"] || 0}</strong>
    </article>
    <article class="api-summary-kpi api-summary-kpi--muted">
      <div class="api-kpi-icon">${icon("refresh-cw", { size: 15 })}</div>
      <span>확인 필요</span><strong>${counts["check-required"] || 0}</strong>
    </article>
  `;

  const activeFilter = state.apiSourceFilter || "전체";
  const filtered = activeFilter === "전체"
    ? sources
    : sources.filter((s) => apiStatusLabel(s.status) === activeFilter);

  if (filtered.length === 0) {
    gridEl.innerHTML = `<div class="api-grid-empty">해당 조건의 API 소스가 없습니다.</div>`;
    return;
  }

  gridEl.innerHTML = filtered.map((source) => `
    <article class="api-source-card ${apiStatusClass(source.status)}">
      <div class="api-source-head">
        <div>
          <p>${escapeHtml(source.domain)}</p>
          <strong>${escapeHtml(source.name)}</strong>
        </div>
        <span class="api-source-status">${escapeHtml(apiStatusLabel(source.status))}</span>
      </div>
      <dl>
        <div><dt>연동 화면</dt><dd>${escapeHtml(source.targetScreen)}</dd></div>
        <div><dt>갱신 주기</dt><dd>${escapeHtml(source.refreshCycle)}</dd></div>
        <div><dt>마지막 상태</dt><dd>${escapeHtml(source.lastSynced)}</dd></div>
        <div><dt>환경변수</dt><dd>${escapeHtml(source.envVar || "-")}</dd></div>
      </dl>
      <p>${escapeHtml(source.note || "")}</p>
    </article>
  `).join("");
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-api-filter]");
    if (!btn) return;
    state.apiSourceFilter = btn.dataset.apiFilter;
    container.querySelectorAll("[data-api-filter]").forEach((b) => {
      const isActive = b.dataset.apiFilter === state.apiSourceFilter;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-pressed", String(isActive));
    });
    renderApiStatus();
  });
}
