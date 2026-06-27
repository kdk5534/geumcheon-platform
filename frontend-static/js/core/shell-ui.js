import { escapeHtml } from "./dom.js";
import { icon } from "./icons.js";
import { state, BACKEND_API_BASE } from "./state.js";
import { applyTranslations, approvedLanguages, getLanguage, setLanguage, t } from "./i18n.js";
import { isBackendApiEnabled } from "./api.js";

const SEARCH_ITEMS = [
  { type: "화면", title: "종합 현황", detail: "지도와 핵심 측정값", href: "#/home", keywords: "현황 지도 인구 상권 복지 안전" },
  { type: "화면", title: "인구·생활", detail: "누가 어디에 사는가", href: "#/population", keywords: "인구 연령 가구 동" },
  { type: "화면", title: "상권·경제", detail: "업종 분포와 변화", href: "#/commercial", keywords: "상가 점포 업종 경제" },
  { type: "화면", title: "복지·건강", detail: "필요한 도움과 시설", href: "#/welfare", keywords: "어르신 장애 돌봄 의료 긴급" },
  { type: "화면", title: "안전·환경", detail: "대기질과 안전시설", href: "#/safety", keywords: "대기 CCTV 쉼터 스쿨존" },
  { type: "화면", title: "데이터 카탈로그", detail: "출처와 다운로드", href: "#/datasets", keywords: "데이터셋 csv api 출처" },
  { type: "행정동", title: "가산동", detail: "행정동 필터", href: "#/population?district=가산동", keywords: "가산" },
  { type: "행정동", title: "독산동", detail: "행정동 필터", href: "#/population?district=독산동", keywords: "독산" },
  { type: "행정동", title: "시흥동", detail: "행정동 필터", href: "#/population?district=시흥동", keywords: "시흥" },
];

let cleanup = [];

export function initShellUi() {
  document.getElementById("global-command")?.remove();
  const root = document.createElement("div");
  root.id = "global-command";
  root.innerHTML = `
    <button class="global-search-trigger" id="global-search-trigger" type="button" aria-haspopup="dialog" aria-label="통합 검색 열기">
      ${icon("search", { size: 15 })}<span data-i18n="shell.searchPlaceholder">시설, 데이터셋, 행정동 검색</span><kbd>Ctrl K</kbd>
    </button>
    <div class="global-language-picker">
      <button class="global-lang" id="global-lang" type="button" aria-label="언어 선택" aria-expanded="false" ${approvedLanguages().length < 2 ? "disabled" : ""}>${escapeHtml(getLanguage().toUpperCase())}</button>
      <div class="global-language-menu" id="global-language-menu" hidden>
        ${approvedLanguages().map((language) => `<button type="button" data-language="${language}" class="${language === getLanguage() ? "is-active" : ""}">${escapeHtml(t(`language.${language}`))}</button>`).join("")}
      </div>
    </div>
    <div class="data-health-strip" id="data-health-strip">
      <button class="data-health-summary" id="data-health-summary" type="button" aria-expanded="false">
        <span class="data-health-dot"></span><strong>데이터 상태 확인 중</strong><span id="data-health-date">기준일 항목별 표시</span>${icon("chevron-right", { size: 14 })}
      </button>
      <div class="data-health-detail" id="data-health-detail" hidden>
        <div><span>공개 범위</span><strong>금천구 GEUMCHEON</strong></div>
        <div><span>표시 정책</span><strong>마지막 정상 스냅샷 유지</strong></div>
        <div><span>최근 실패</span><strong id="data-health-failure">상태 API 확인 중</strong></div>
        <div><span>활성 필터</span><strong id="data-health-filter">전체 지역</strong></div>
        <a href="#/datasets">데이터 근거 보기</a>
      </div>
    </div>
    <div class="command-dialog" id="command-dialog" role="dialog" aria-modal="true" aria-label="통합 검색" hidden>
      <button class="command-backdrop" type="button" aria-label="검색 닫기"></button>
      <section class="command-panel">
        <div class="command-input-wrap">${icon("search", { size: 19 })}<input id="command-input" type="search" placeholder="시설, 데이터셋, 행정동, 화면 검색" autocomplete="off"><kbd>ESC</kbd></div>
        <div class="command-results" id="command-results"></div>
        <footer><span>↑↓ 이동</span><span>Enter 선택</span><span>Esc 닫기</span></footer>
      </section>
    </div>
    <div class="shell-toast" id="shell-toast" role="status" aria-live="polite"></div>
  `;
  document.querySelector(".topbar")?.append(root);
  applyTranslations(root);
  bindShell(root);
  updateDataHealth();
}

function bindShell(root) {
  const dialog = root.querySelector("#command-dialog");
  const input = root.querySelector("#command-input");
  const results = root.querySelector("#command-results");
  let selected = 0;
  let visibleItems = SEARCH_ITEMS;
  let searchController = null;

  const renderVisibleResults = () => {
    results.innerHTML = visibleItems.length ? visibleItems.map((item, index) => `
      <a href="${item.href}" class="command-result${index === selected ? " is-selected" : ""}" data-command-index="${index}">
        <span>${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small>${icon("arrow-right", { size: 14 })}
      </a>
    `).join("") : `<div class="command-empty">검색 결과가 없습니다. 다른 단어로 찾아보세요.</div>`;
  };

  const render = (query = "") => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    visibleItems = SEARCH_ITEMS.filter((item) =>
      !normalized || `${item.title} ${item.detail} ${item.keywords}`.toLocaleLowerCase("ko-KR").includes(normalized)
    );
    selected = Math.min(selected, Math.max(0, visibleItems.length - 1));
    renderVisibleResults();
  };
  const open = () => { dialog.hidden = false; document.body.classList.add("has-command-open"); render(input.value); requestAnimationFrame(() => input.focus()); };
  const close = () => { dialog.hidden = true; document.body.classList.remove("has-command-open"); };

  root.querySelector("#global-search-trigger")?.addEventListener("click", open);
  root.querySelector(".command-backdrop")?.addEventListener("click", close);
  input?.addEventListener("input", () => {
    selected = 0;
    const query = input.value.trim();
    render(query);
    searchController?.abort();
    if (query.length < 2 || !isBackendApiEnabled()) return;
    searchController = new AbortController();
    const activeController = searchController;
    window.setTimeout(async () => {
      if (activeController.signal.aborted) return;
      try {
        const response = await fetch(`${BACKEND_API_BASE}/api/public/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(getLanguage())}`, { signal: activeController.signal });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload?.data?.items) || input.value.trim() !== query) return;
        visibleItems = payload.data.items.map((item) => ({
          type: searchTypeLabel(item.type), title: item.title, detail: item.detail, href: item.href, keywords: "",
        }));
        selected = 0;
        renderVisibleResults();
      } catch {}
    }, 180);
  });
  results?.addEventListener("click", close);
  const onKey = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); dialog.hidden ? open() : close(); return; }
    if (dialog.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      selected = (selected + delta + visibleItems.length) % visibleItems.length;
      render(input.value);
      results.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && visibleItems[selected]) { location.hash = visibleItems[selected].href; close(); }
  };
  document.addEventListener("keydown", onKey);
  cleanup.push(() => document.removeEventListener("keydown", onKey));
  cleanup.push(() => searchController?.abort());

  const languageButton = root.querySelector("#global-lang");
  const languageMenu = root.querySelector("#global-language-menu");
  languageButton?.addEventListener("click", () => {
    const expanded = languageButton.getAttribute("aria-expanded") !== "true";
    languageButton.setAttribute("aria-expanded", String(expanded));
    languageMenu.hidden = !expanded;
  });
  languageMenu?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-language]");
    if (!button) return;
    if (await setLanguage(button.dataset.language)) location.reload();
  });

  const summary = root.querySelector("#data-health-summary");
  const detail = root.querySelector("#data-health-detail");
  summary?.addEventListener("click", () => {
    const expanded = summary.getAttribute("aria-expanded") !== "true";
    summary.setAttribute("aria-expanded", String(expanded));
    detail.hidden = !expanded;
  });

  document.addEventListener("click", handleShellAction);
  cleanup.push(() => document.removeEventListener("click", handleShellAction));
}

function handleShellAction(event) {
  const action = event.target.closest("[data-shell-action]")?.dataset.shellAction;
  if (!action) return;
  if (action === "share") {
    navigator.clipboard?.writeText(location.href).then(() => showToast("현재 필터 URL을 복사했습니다.")).catch(() => showToast("주소창의 URL을 복사해 주세요."));
  }
  if (action === "print") window.print();
  if (action === "csv") downloadCurrentCsv();
}

function downloadCurrentCsv() {
  const rows = [["행정동", "주민등록인구"]];
  (state.data?.population || []).forEach((item) => rows.push([item.areaName || "", Number(item.total || 0)]));
  if (rows.length === 1) { showToast("내보낼 공개 데이터가 없습니다."); return; }
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `geumcheon-overview-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("현재 공개 범위의 CSV를 만들었습니다.");
}

function showToast(message) {
  const toast = document.getElementById("shell-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

export function updateDataHealth() {
  const root = document.getElementById("global-command");
  const appState = document.documentElement.dataset.appDataState;
  const summary = root?.querySelector(".data-health-summary strong");
  if (!summary) return;
  summary.textContent = appState === "error" ? "일부 데이터 연결 지연" : appState === "ready" ? "공개 데이터 연결됨" : "데이터 상태 확인 중";
  root.classList.toggle("has-delay", appState === "error");
}

export function destroyShellUi() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
}

function searchTypeLabel(type) {
  return ({ SCREEN: "화면", DATASET: "데이터셋", FACILITY: "시설", AREA: "행정동" })[type] || "검색";
}
