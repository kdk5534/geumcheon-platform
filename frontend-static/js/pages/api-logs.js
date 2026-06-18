// API 수집 로그 페이지: 상태 필터 + 검색 + 재수집 mock + 카드 그리드

import { state, API_LOG_KEY } from "../core/state.js";
import { escapeHtml, formatMockTimestamp } from "../core/dom.js";
import { injectPageCss } from "../core/assets.js";

const FILTER_OPTIONS = ["전체", "성공", "실패", "대기", "수동"];

// ─── 상태 레이블/클래스 ───────────────────────────────────────

function apiLogStatusLabel(status) {
  return { success: "성공", fail: "실패", queued: "대기", manual: "수동" }[status] || "대기";
}

function apiLogStatusClass(status) {
  return { success: "is-success", fail: "is-failed", queued: "is-queued", manual: "is-manual" }[status] || "is-queued";
}

// ─── 기본 로그 목록 ────────────────────────────────────────────

function defaultApiLogs() {
  return [
    { id: "weather-20260602-1600",    sourceName: "기상 현황",     domain: "도시환경", status: "success", collectedAt: "2026.06.02 16:00", duration: "18초", rows: 1280, targetScreen: "메인 대시보드", nextRun: "16:10",         note: "정상 수집 완료. 최신 기상 지표를 갱신했습니다." },
    { id: "stores-20260602-1540",     sourceName: "상권/업소 정보", domain: "상권",     status: "success", collectedAt: "2026.06.02 15:40", duration: "31초", rows: 842,  targetScreen: "상권 분석",     nextRun: "16:40",         note: "업소명 중복 정제 규칙 적용 후 반영했습니다." },
    { id: "dust-20260602-1500",       sourceName: "미세먼지",       domain: "도시환경", status: "queued",  collectedAt: "2026.06.02 15:00", duration: "-",    rows: 0,    targetScreen: "대기 현황",     nextRun: "15:10",         note: "다음 예약 수집 대기 중입니다." },
    { id: "parking-20260602-1450",    sourceName: "공영주차장",     domain: "생활",     status: "manual",  collectedAt: "2026.06.02 14:50", duration: "수동", rows: 214,  targetScreen: "생활지도",      nextRun: "수동",           note: "지도 좌표 보정 확인이 필요합니다." },
    { id: "traffic-20260602-1405",    sourceName: "교통 혼잡",      domain: "교통",     status: "fail",    collectedAt: "2026.06.02 14:05", duration: "9초",  rows: 0,    targetScreen: "교통 현황",     nextRun: "14:15",         note: "API 응답 코드 403. 키 또는 호출 제한을 다시 확인해야 합니다." },
    { id: "population-20260602-1320", sourceName: "인구 통계",      domain: "행정",     status: "success", collectedAt: "2026.06.02 13:20", duration: "22초", rows: 156,  targetScreen: "인구 분석",     nextRun: "다음 날 08:00", note: "행정동 단위 집계가 정상 반영되었습니다." }
  ];
}

function mergeApiLogEdits(baseLogs) {
  const stored = readApiLogs();
  if (stored.length === 0) return baseLogs;
  const merged = new Map(baseLogs.map((log) => [log.id, log]));
  stored.forEach((log) => merged.set(log.id, log));
  return Array.from(merged.values());
}

function readApiLogs() {
  try {
    const raw = localStorage.getItem(API_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveApiLogs() {
  localStorage.setItem(API_LOG_KEY, JSON.stringify(state.apiLogs));
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

/** API 로그 페이지를 container에 마운트한다. */
export function mount(container) {
  injectPageCss("css-page-api", "./css/pages/api.css");

  // 기본 로그와 localStorage 편집분을 병합해 state에 저장
  const baseLogs = Array.isArray(state.apiLogs) && state.apiLogs.length > 0
    ? state.apiLogs
    : defaultApiLogs();
  state.apiLogs = mergeApiLogEdits(baseLogs);

  container.innerHTML = buildHtml();
  renderApiLogs();
  bindEvents(container);
}

/** API 로그 페이지를 언마운트한다. */
export function unmount() {}

// ─── HTML 구조 ────────────────────────────────────────────────

function buildHtml() {
  const filterBtns = FILTER_OPTIONS.map((f) => `
    <button
      class="api-filter-btn${state.apiLogFilter === f ? " is-active" : ""}"
      data-log-filter="${escapeHtml(f)}"
      aria-pressed="${state.apiLogFilter === f}"
    >${escapeHtml(f)}</button>
  `).join("");

  const logs    = Array.isArray(state.apiLogs) ? state.apiLogs : [];
  const success = logs.filter((l) => l.status === "success").length;
  const failed  = logs.filter((l) => l.status === "failed").length;

  return `
    <div class="api-page">
      <div class="page-banner" style="--banner-from:#0d2a45;--banner-to:#0c7fb8">
        <div class="page-banner-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        </div>
        <div class="page-banner-copy">
          <p class="page-banner-eyebrow">수집 로그</p>
          <h2 class="page-banner-title">API 수집 실행 내역</h2>
          <p class="page-banner-desc">API 수집 실행 내역을 상태·소스별로 필터링하고 수동 재수집을 실행합니다.</p>
        </div>
        <div class="page-banner-stats">
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${logs.length || "—"}</span>
            <span class="page-banner-stat-label">전체 로그</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${success || "0"}</span>
            <span class="page-banner-stat-label">성공</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${failed || "0"}</span>
            <span class="page-banner-stat-label">실패</span>
          </div>
        </div>
        <a class="page-banner-back" href="#/home">◀ 홈으로</a>
      </div>

      <div id="api-log-summary" class="api-summary-row" aria-live="polite"></div>

      <div class="api-filter-bar" role="group" aria-label="로그 필터">
        ${filterBtns}
        <input
          type="search"
          class="api-search-input"
          id="api-log-search"
          placeholder="소스명·도메인·메모 검색..."
          value="${escapeHtml(state.apiLogSearch || "")}"
          aria-label="로그 검색"
        >
      </div>

      <div id="api-log-grid" class="api-card-grid" aria-live="polite" aria-label="수집 로그 목록"></div>
    </div>
  `;
}

// ─── 렌더 함수 ────────────────────────────────────────────────

function renderApiLogs() {
  const summaryEl = document.getElementById("api-log-summary");
  const gridEl = document.getElementById("api-log-grid");
  if (!summaryEl || !gridEl) return;

  const query = (state.apiLogSearch || "").trim().toLowerCase();
  const activeFilter = state.apiLogFilter || "전체";

  const filtered = state.apiLogs.filter((log) => {
    const matchStatus = activeFilter === "전체" || apiLogStatusLabel(log.status) === activeFilter;
    const searchable = [log.sourceName, log.domain, log.targetScreen, log.note, log.collectedAt]
      .join(" ").toLowerCase();
    return matchStatus && (!query || searchable.includes(query));
  });

  const counts = state.apiLogs.reduce((acc, log) => {
    acc[log.status || "queued"] = (acc[log.status || "queued"] || 0) + 1;
    return acc;
  }, {});

  summaryEl.innerHTML = `
    <article class="api-summary-kpi api-summary-kpi--green"><span>성공</span><strong>${counts.success || 0}</strong></article>
    <article class="api-summary-kpi api-summary-kpi--amber"><span>실패</span><strong>${counts.fail || 0}</strong></article>
    <article class="api-summary-kpi api-summary-kpi--blue"><span>대기</span><strong>${counts.queued || 0}</strong></article>
    <article class="api-summary-kpi api-summary-kpi--muted"><span>수동</span><strong>${counts.manual || 0}</strong></article>
  `;

  if (filtered.length === 0) {
    gridEl.innerHTML = `<div class="api-grid-empty">조건에 맞는 수집 로그가 없습니다.</div>`;
    return;
  }

  gridEl.innerHTML = filtered.map((log) => {
    const canRetry = log.status === "fail" || log.status === "queued" || log.status === "manual";
    return `
      <article class="api-log-card ${apiLogStatusClass(log.status)}">
        <div class="api-log-head">
          <div>
            <p>${escapeHtml(log.domain)}</p>
            <strong>${escapeHtml(log.sourceName)}</strong>
          </div>
          <span class="api-log-status">${escapeHtml(apiLogStatusLabel(log.status))}</span>
        </div>
        <dl class="api-log-kpis">
          <div><dt>수집 시각</dt><dd>${escapeHtml(log.collectedAt || "-")}</dd></div>
          <div><dt>대상 화면</dt><dd>${escapeHtml(log.targetScreen || "-")}</dd></div>
          <div><dt>소요 시간</dt><dd>${escapeHtml(log.duration || "-")}</dd></div>
          <div><dt>건수</dt><dd>${Number(log.rows || 0).toLocaleString()}건</dd></div>
          <div><dt>다음 실행</dt><dd>${escapeHtml(log.nextRun || "-")}</dd></div>
          <div><dt>로그 ID</dt><dd>${escapeHtml(log.id || "-")}</dd></div>
        </dl>
        <p>${escapeHtml(log.note || "")}</p>
        ${canRetry ? `
          <div class="api-log-actions">
            <button class="sample-link" type="button" data-retry-id="${escapeHtml(log.id)}">재수집</button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  container.addEventListener("click", (e) => {
    // 필터 버튼
    const filterBtn = e.target.closest("[data-log-filter]");
    if (filterBtn) {
      state.apiLogFilter = filterBtn.dataset.logFilter;
      container.querySelectorAll("[data-log-filter]").forEach((b) => {
        const isActive = b.dataset.logFilter === state.apiLogFilter;
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-pressed", String(isActive));
      });
      renderApiLogs();
      return;
    }

    // 재수집 버튼 (mock 동작)
    const retryBtn = e.target.closest("[data-retry-id]");
    if (retryBtn) {
      const logId = retryBtn.dataset.retryId;
      const logIdx = state.apiLogs.findIndex((l) => l.id === logId);
      if (logIdx < 0) return;

      state.apiLogs[logIdx] = {
        ...state.apiLogs[logIdx],
        status: "success",
        collectedAt: formatMockTimestamp(new Date()),
        duration: `${Math.floor(Math.random() * 25) + 8}초`,
        note: "재수집 완료 (Mock)"
      };
      saveApiLogs();
      renderApiLogs();
    }
  });

  // 검색 입력
  container.addEventListener("input", (e) => {
    if (e.target.id === "api-log-search") {
      state.apiLogSearch = e.target.value || "";
      renderApiLogs();
    }
  });
}
