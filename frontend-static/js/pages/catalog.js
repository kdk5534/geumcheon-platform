// 데이터 카탈로그 페이지: 금천구 공공데이터 목록 검색·필터·정렬·상세 미리보기

import { escapeHtml } from "../core/dom.js";
import { createDataState } from "../core/data-state.js";
import { icon } from "../core/icons.js";
import { injectPageCss } from "../core/assets.js";
import { renderDataStamp } from "../core/meta.js";
import { BACKEND_API_BASE } from "../core/state.js";
import { isBackendApiEnabled } from "../core/api.js";

const CATEGORIES = ["전체", "교통물류", "환경기상", "사회복지", "공공행정", "보건의료", "문화관광", "산업고용", "재난안전"];
const TYPE_LABELS = { sheet: "시트", chart: "차트", map: "지도", file: "파일", api: "API" };
const TYPE_ICONS  = { sheet: "list", chart: "bar-chart", map: "map", file: "file", api: "database" };

// 카테고리별 배지 색상 (wash 토큰 기반)
const CATEGORY_COLORS = {
  교통물류: { bg: "var(--teal-wash)",   fg: "var(--teal)" },
  환경기상: { bg: "var(--blue-wash)",   fg: "var(--blue)" },
  사회복지: { bg: "var(--green-wash)",  fg: "var(--green)" },
  공공행정: { bg: "var(--navy-wash)",   fg: "var(--navy)" },
  보건의료: { bg: "var(--amber-wash)",  fg: "var(--amber)" },
  문화관광: { bg: "var(--violet-wash)", fg: "var(--violet)" },
  산업고용: { bg: "var(--blue-wash)",   fg: "var(--blue)" },
  재난안전: { bg: "var(--red-wash)",    fg: "var(--red)" },
};

let allDatasets = [];
let operationalStatuses = [];
let isMounted = false;
let loadFailed = false;
let pageController = null;

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  pageController?.abort();
  pageController = new AbortController();
  isMounted = true;
  loadFailed = false;
  await injectPageCss("css-page-catalog", "./css/pages/catalog.css");
  await injectPageCss("css-professional-dashboard", "./css/professional-dashboard.css");
  if (!isMounted) return;
  container.innerHTML = buildSkeleton();

  allDatasets = await loadDatasets(pageController.signal);
  operationalStatuses = [];
  if (!isMounted) return;

  render(container);
  bindEvents(container);

  loadOperationalStatuses(pageController.signal).then((statuses) => {
    if (!isMounted || pageController?.signal.aborted) return;
    operationalStatuses = statuses;
    render(container);
    bindEvents(container);
  });
}

export function unmount() {
  isMounted = false;
  pageController?.abort();
  pageController = null;
}

// ─── 데이터 로드 ──────────────────────────────────────────────

async function loadDatasets(signal) {
  try {
    const res = await fetch("./assets/data/datasets.json", { signal });
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return Array.isArray(data.datasets) ? data.datasets : [];
  } catch (error) {
    if (error?.name === "AbortError") return [];
    loadFailed = true;
    return [];
  }
}

async function loadOperationalStatuses(signal) {
  if (!isBackendApiEnabled()) return [];
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), 1200);
  const abortWithParent = () => timeoutController.abort();
  try {
    signal?.addEventListener("abort", abortWithParent, { once: true });
    const response = await fetch(`${BACKEND_API_BASE}/api/public/datasets/status`, { signal: timeoutController.signal });
    if (!response.ok) return [];
    const payload = await response.json();
    return payload?.success && Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortWithParent);
  }
}

export function summarizeOperationalStatuses(statuses = []) {
  const valid = Array.isArray(statuses) ? statuses : [];
  const available = valid.filter((status) => status.dataStatus === "AVAILABLE").length;
  const attention = valid.filter((status) =>
    status.attemptStatus === "FAILED" && status.dataStatus === "AVAILABLE"
  ).length;
  const noSuccess = valid.filter((status) => status.dataStatus === "NO_SUCCESS").length;
  const latestCollectedAt = valid
    .map((status) => status.collectedAt || "")
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] || "";
  return { total: valid.length, available, attention, noSuccess, latestCollectedAt };
}

function buildCatalogStatus(total, apiCount) {
  const operations = summarizeOperationalStatuses(operationalStatuses);
  const latestUpdatedAt = allDatasets
    .map((d) => d.updatedAt || "")
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0];

  const collectedAt = operations.latestCollectedAt || latestUpdatedAt;
  const dataState = createDataState({
    hasData: total > 0,
    sourceMode: "local",
    error: loadFailed ? "catalog-load-failed" : "",
    collectedAt,
    sourceName: operations.total ? "금천구 운영 데이터 상태" : "금천구 정적 데이터 카탈로그",
  });
  let tone = dataState.tone;
  let label = dataState.label;
  let title = "데이터 찾기 화면이 정적 카탈로그 기준으로 동작 중입니다.";
  let note = "공개 가능한 데이터셋 탐색과 분류, 검색 경험 검증에 맞춘 구조입니다.";

  if (loadFailed) {
    tone = dataState.tone;
    label = dataState.label;
    title = "데이터셋 목록을 불러오지 못했습니다.";
    note = "정적 카탈로그 파일을 다시 확인하면 검색과 공개 상태 점검을 이어갈 수 있습니다.";
  } else if (!total) {
    tone = dataState.tone;
    label = dataState.label;
    title = "표시할 데이터셋이 아직 없습니다.";
    note = "카탈로그 파일이 비어 있거나 초기 적재 전일 수 있습니다.";
  } else if (apiCount > 0) {
    tone = dataState.tone;
    label = dataState.label;
    title = "검색 가능한 공공 데이터셋과 Open API 목록이 준비되어 있습니다.";
    note = "카테고리, 형식, 키워드 필터를 함께 써서 사용 가능한 공개 자산을 빠르게 찾을 수 있습니다.";
  }

  if (operations.total > 0) {
    title = operations.attention > 0
      ? `최근 수집 실패 ${operations.attention}건이 있지만 마지막 정상자료는 유지되고 있습니다.`
      : "운영 데이터셋의 최근 수집 상태와 마지막 정상자료를 확인했습니다.";
    note = operations.noSuccess > 0
      ? `정상 수집 이력이 없는 데이터셋 ${operations.noSuccess}건은 공개 지표에서 제외됩니다.`
      : "최근 시도 실패는 마지막 정상 스냅샷의 삭제나 공개 중단을 의미하지 않습니다.";
  }

  return `
    <div class="cat-status-card">
      <div class="cat-status-head">
        <span class="cat-state-pill cat-state-pill--${tone}">${escapeHtml(label)}</span>
        <span class="cat-status-title">${escapeHtml(title)}</span>
      </div>
      <div class="cat-status-metrics">
        <div class="cat-status-metric">
          <strong>${operations.total || total}</strong>
          <span>${operations.total ? "운영 데이터셋" : "전체 데이터셋"}</span>
        </div>
        <div class="cat-status-metric">
          <strong>${operations.total ? operations.available : apiCount}</strong>
          <span>${operations.total ? "정상자료 보유" : "Open API"}</span>
        </div>
        <div class="cat-status-metric">
          <strong>${operations.total ? operations.attention : escapeHtml(latestUpdatedAt ? latestUpdatedAt.replace(/-/g, ".") : "미정")}</strong>
          <span>${operations.total ? "최근 실패·자료 유지" : "최근 갱신 기준"}</span>
        </div>
      </div>
      <p class="cat-status-note">${escapeHtml(note)}</p>
      ${renderDataStamp("overview", "데이터 카탈로그")}
    </div>
  `;
}

// ─── HTML 빌더 ────────────────────────────────────────────────

/** 로딩 중 스켈레톤 플레이스홀더 */
function buildSkeleton() {
  return `
    <div class="cat-page">
      <div class="page-banner cat-command-head" style="--banner-from:#1739a6;--banner-to:#2f5bff">
        <div class="page-banner-icon">${icon("database", { size: 26 })}</div>
        <div class="page-banner-copy">
          <p class="page-banner-eyebrow">DATA CATALOG</p>
          <h2 class="page-banner-title">근거 데이터를 찾습니다</h2>
          <p class="page-banner-desc">금천구청·서울시·국가기관의 공공데이터를 검색·열람할 수 있습니다.</p>
        </div>
        <a class="page-banner-back" href="#/home">◀ 홈으로</a>
      </div>
      <div class="cat-toolbar">
        <div class="skeleton" style="height:40px;width:320px;border-radius:var(--radius-md)"></div>
        <div class="skeleton" style="height:40px;width:160px;border-radius:var(--radius-md)"></div>
      </div>
      <div class="cat-grid">
        ${Array(6).fill('<div class="skeleton-card"></div>').join("")}
      </div>
    </div>
  `;
}

/** 전체 페이지 렌더 */
function render(container) {
  const total = allDatasets.length;
  const catCount  = new Set(allDatasets.map((d) => d.category)).size;
  const typeCount = new Set(allDatasets.flatMap((d) => d.types || [])).size;
  const apiCount  = allDatasets.filter((d) => (d.types || []).includes("api")).length;

  container.innerHTML = `
    <div class="cat-page">
      <div class="page-banner cat-command-head" style="--banner-from:#1739a6;--banner-to:#2f5bff">
        <div class="page-banner-icon">${icon("database", { size: 26 })}</div>
        <div class="page-banner-copy">
          <p class="page-banner-eyebrow">DATA CATALOG</p>
          <h2 class="page-banner-title">근거 데이터를 찾습니다</h2>
          <p class="page-banner-desc">주제, 형식, 최신성, 다운로드 가능 여부를 기준으로 공개 데이터의 출처와 이용 방법을 확인합니다.</p>
        </div>
        <div class="page-banner-stats">
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${total}</span>
            <span class="page-banner-stat-label">전체 데이터셋</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${catCount}</span>
            <span class="page-banner-stat-label">카테고리</span>
          </div>
          <div class="page-banner-stat">
            <span class="page-banner-stat-val">${apiCount}</span>
            <span class="page-banner-stat-label">Open API</span>
          </div>
        </div>
        <a class="page-banner-back" href="#/home">◀ 홈으로</a>
      </div>

      <!-- 통계 요약 스트립 -->
      ${buildCatalogStatus(total, apiCount)}

      <div class="cat-stats-strip">
        <div class="cat-stat-item">
          <strong>${total}</strong><span>전체 데이터셋</span>
        </div>
        <div class="cat-stat-divider"></div>
        <div class="cat-stat-item">
          <strong>${catCount}</strong><span>분류 카테고리</span>
        </div>
        <div class="cat-stat-divider"></div>
        <div class="cat-stat-item">
          <strong>${typeCount}</strong><span>데이터 형식</span>
        </div>
        <div class="cat-stat-divider"></div>
        <div class="cat-stat-item">
          <strong>${apiCount}</strong><span>Open API 제공</span>
        </div>
      </div>

      <!-- 툴바: 검색 + 정렬 -->
      <div class="cat-toolbar">
        <div class="cat-search-wrap">
          <span class="cat-search-icon" aria-hidden="true">${icon("search", { size: 15 })}</span>
          <input
            id="cat-search"
            class="cat-search"
            type="search"
            placeholder="데이터셋 검색 (예: 주차장, 인구, CCTV)"
            aria-label="데이터셋 검색"
            autocomplete="off"
          >
        </div>
        <select id="cat-sort" class="cat-sort" aria-label="정렬 기준">
          <option value="views">조회순</option>
          <option value="updatedAt">최신순</option>
          <option value="title">이름순</option>
        </select>
      </div>

      <!-- 카테고리 필터 탭 -->
      <div class="cat-category-bar" role="group" aria-label="카테고리 필터">
        ${CATEGORIES.map((cat) => {
          const cnt = cat === "전체" ? total : allDatasets.filter((d) => d.category === cat).length;
          return `
            <button class="cat-cat-btn${cat === "전체" ? " is-active" : ""}"
                    data-cat="${escapeHtml(cat)}"
                    aria-pressed="${cat === "전체"}">
              ${escapeHtml(cat)}<span class="cat-cat-count">${cnt}</span>
            </button>`;
        }).join("")}
      </div>

      <!-- 형식(type) 필터 -->
      <div class="cat-type-bar" role="group" aria-label="데이터 형식 필터">
        <span class="cat-type-label">형식</span>
        ${Object.entries(TYPE_LABELS).map(([key, label]) => {
          const cnt = allDatasets.filter((d) => (d.types || []).includes(key)).length;
          return `
            <button class="cat-type-btn" data-type="${key}" aria-pressed="false">
              ${icon(TYPE_ICONS[key] || "list", { size: 12 })} ${label}
              <span class="cat-type-count">${cnt}</span>
            </button>`;
        }).join("")}
      </div>

      <!-- 결과 수 -->
      <p id="cat-count" class="cat-count" aria-live="polite"></p>

      <!-- 카드 그리드 -->
      <div id="cat-grid" class="cat-grid" aria-label="데이터셋 목록"></div>
    </div>

    <!-- 상세 미리보기 다이얼로그 (Shoelace) -->
    <sl-dialog id="cat-dialog" label="데이터셋 상세">
      <div id="cat-dialog-body" class="cat-dialog-body"></div>
      <sl-button slot="footer" variant="neutral" class="cat-dialog-close">닫기</sl-button>
    </sl-dialog>
  `;
}

// ─── 필터·정렬·렌더 ───────────────────────────────────────────

function getFilters(container) {
  const query   = (container.querySelector("#cat-search")?.value || "").trim().toLowerCase();
  const sortBy  = container.querySelector("#cat-sort")?.value || "views";
  const catBtn  = container.querySelector(".cat-cat-btn.is-active");
  const cat     = catBtn ? catBtn.dataset.cat : "전체";
  const activeTypes = [...container.querySelectorAll(".cat-type-btn.is-active")].map((b) => b.dataset.type);
  return { query, sortBy, cat, activeTypes };
}

function applyFilters(datasets, { query, sortBy, cat, activeTypes }) {
  let list = [...datasets];

  if (cat !== "전체") list = list.filter((d) => d.category === cat);

  if (activeTypes.length > 0) {
    list = list.filter((d) => activeTypes.every((t) => (d.types || []).includes(t)));
  }

  if (query) {
    list = list.filter((d) =>
      d.title.toLowerCase().includes(query) ||
      d.org.toLowerCase().includes(query) ||
      (d.description || "").toLowerCase().includes(query) ||
      d.category.toLowerCase().includes(query)
    );
  }

  if (sortBy === "views")     list.sort((a, b) => (b.views || 0) - (a.views || 0));
  if (sortBy === "updatedAt") list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  if (sortBy === "title")     list.sort((a, b) => a.title.localeCompare(b.title, "ko"));

  return list;
}

function renderCards(container) {
  const grid    = container.querySelector("#cat-grid");
  const countEl = container.querySelector("#cat-count");
  if (!grid) return;

  const filters  = getFilters(container);
  const filtered = applyFilters(allDatasets, filters);

  if (countEl) {
    const total = allDatasets.length;
    countEl.textContent = filtered.length === total
      ? `${total}개 데이터셋`
      : `${filtered.length}개 결과 (전체 ${total}개 중)`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${icon("search", { size: 24 })}</div>
        <h3>검색 결과 없음</h3>
        <p>다른 키워드나 필터 조건을 사용해 보세요.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((d) => buildCard(d)).join("");
}

function buildCard(d) {
  const color  = CATEGORY_COLORS[d.category] || { bg: "var(--wash)", fg: "var(--muted)" };
  const typeTags = (d.types || []).map((t) =>
    `<span class="cat-type-tag">${icon(TYPE_ICONS[t] || "list", { size: 11 })} ${TYPE_LABELS[t] || t}</span>`
  ).join("");

  const updatedLabel = d.updatedAt ? d.updatedAt.replace(/-/g, ".") : "—";
  const views = Number(d.views || 0).toLocaleString();

  return `
    <article class="cat-card" data-id="${escapeHtml(d.id)}" tabindex="0" role="button"
             aria-label="${escapeHtml(d.title)} 상세보기">
      <div class="cat-card-head">
        <span class="cat-cat-badge"
              style="background:${color.bg};color:${color.fg}">
          ${escapeHtml(d.category)}
        </span>
        <span class="cat-cycle-badge">${escapeHtml(d.updateCycle)} 갱신</span>
      </div>
      <h3 class="cat-card-title">${escapeHtml(d.title)}</h3>
      <p class="cat-card-org">${escapeHtml(d.org)}</p>
      <p class="cat-card-desc">${escapeHtml(d.description || "")}</p>
      <div class="cat-card-footer">
        <div class="cat-type-tags">${typeTags}</div>
        <div class="cat-card-meta">
          <span>${icon("list", { size: 11 })} ${views}회</span>
          <span>갱신 ${updatedLabel}</span>
        </div>
      </div>
    </article>
  `;
}

// ─── 다이얼로그 ───────────────────────────────────────────────

async function openDetail(id, container) {
  const d = allDatasets.find((ds) => ds.id === id);
  if (!d) return;

  const dialog = container.ownerDocument.getElementById("cat-dialog");
  if (!dialog) return;

  const color  = CATEGORY_COLORS[d.category] || { bg: "var(--wash)", fg: "var(--muted)" };
  const typeTags = (d.types || []).map((t) =>
    `<span class="cat-type-tag">${icon(TYPE_ICONS[t] || "list", { size: 12 })} ${TYPE_LABELS[t] || t}</span>`
  ).join("");

  const body = dialog.querySelector("#cat-dialog-body");
  if (body) {
    body.innerHTML = `
      <div class="cat-detail-meta">
        <span class="cat-cat-badge" style="background:${color.bg};color:${color.fg}">${escapeHtml(d.category)}</span>
        ${typeTags}
        <span class="cat-cycle-badge">${escapeHtml(d.updateCycle)} 갱신</span>
      </div>
      <h3 class="cat-detail-title">${escapeHtml(d.title)}</h3>
      <dl class="cat-detail-dl">
        <div><dt>제공 기관</dt><dd>${escapeHtml(d.org)}</dd></div>
        <div><dt>최종 갱신</dt><dd>${escapeHtml(d.updatedAt || "—")}</dd></div>
        <div><dt>제공 형식</dt><dd>${escapeHtml(d.format || "—")}</dd></div>
        <div><dt>누적 조회</dt><dd>${Number(d.views || 0).toLocaleString()}회</dd></div>
      </dl>
      <p class="cat-detail-desc">${escapeHtml(d.description || "")}</p>
      <p class="cat-detail-note">
        ${icon("database", { size: 13 })} 실제 데이터는
        <a href="https://data.geumcheon.go.kr" target="_blank" rel="noopener">금천구 공공데이터포털</a> 또는
        <a href="https://data.go.kr" target="_blank" rel="noopener">공공데이터포털</a>에서 확인하세요.
      </p>
    `;
  }

  // Shoelace sl-dialog label 업데이트 후 열기
  dialog.setAttribute("label", escapeHtml(d.title));

  // 웹 컴포넌트 업그레이드 대기
  await openCatalogDialog(dialog);
}

async function openCatalogDialog(dialog) {
  if (typeof dialog.show === "function") {
    dialog.show();
    return;
  }

  const defined = await Promise.race([
    customElements.whenDefined("sl-dialog").then(() => true),
    new Promise((resolve) => window.setTimeout(() => resolve(false), 350)),
  ]);
  if (defined && typeof dialog.show === "function") {
    dialog.show();
    return;
  }

  dialog.setAttribute("open", "");
  dialog.classList.add("cat-dialog-fallback", "is-open");
  document.body.classList.add("has-modal-open");
}

function closeCatalogDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.hide === "function") {
    dialog.hide();
  } else {
    dialog.removeAttribute("open");
    dialog.classList.remove("is-open");
  }
  document.body.classList.remove("has-modal-open");
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  // 검색
  const search = container.querySelector("#cat-search");
  if (search) {
    search.addEventListener("input", () => renderCards(container));
  }

  // 정렬
  const sort = container.querySelector("#cat-sort");
  if (sort) {
    sort.addEventListener("change", () => renderCards(container));
  }

  container.querySelector(".cat-dialog-close")?.addEventListener("click", () =>
    closeCatalogDialog(container.ownerDocument.getElementById("cat-dialog"))
  );
  container.ownerDocument.getElementById("cat-dialog")?.addEventListener("click", (event) => {
    if (event.target?.id === "cat-dialog") closeCatalogDialog(event.target);
  });

  // 카테고리 필터
  container.addEventListener("click", (e) => {
    const catBtn = e.target.closest(".cat-cat-btn");
    if (catBtn) {
      container.querySelectorAll(".cat-cat-btn").forEach((b) => {
        const active = b === catBtn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      renderCards(container);
      return;
    }

    // 형식 필터 (토글)
    const typeBtn = e.target.closest(".cat-type-btn");
    if (typeBtn) {
      const active = typeBtn.classList.toggle("is-active");
      typeBtn.setAttribute("aria-pressed", String(active));
      renderCards(container);
      return;
    }

    // 카드 클릭 → 상세 다이얼로그
    const card = e.target.closest(".cat-card");
    if (card) {
      openDetail(card.dataset.id, container);
      return;
    }
  });

  // 카드 키보드 접근성
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".cat-card");
      if (card) {
        e.preventDefault();
        openDetail(card.dataset.id, container);
      }
    }
  });

  // 다이얼로그 닫기 버튼
  const doc = container.ownerDocument;
  const dialog = doc.getElementById("cat-dialog");
  if (dialog) {
    const closeBtn = dialog.querySelector(".cat-dialog-close");
    if (closeBtn) closeBtn.addEventListener("click", () => dialog.hide());
  }

  // 초기 렌더
  renderCards(container);
}
