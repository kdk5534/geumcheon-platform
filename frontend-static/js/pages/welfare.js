import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { injectPageCss } from "../core/assets.js";
import { getSectionMeta, renderDataStamp, sourceModeText } from "../core/meta.js";

let root = null;

const HELP_TYPES = [
  { key: "elder", label: "어르신", note: "건강·돌봄·일상 지원", categories: ["병원", "약국", "복지"] },
  { key: "care", label: "돌봄", note: "가족·아동·생활 지원", categories: ["복지", "돌봄", "병원"] },
  { key: "medical", label: "의료", note: "병원·약국 찾기", categories: ["병원", "약국"] },
  { key: "emergency", label: "긴급지원", note: "대피·안전·긴급 연락", categories: ["쉼터", "안전", "병원"] },
];

export async function mount(container) {
  root = container;
  await injectPageCss("css-page-welfare", "./css/pages/welfare.css");
  await injectPageCss("css-professional-dashboard", "./css/professional-dashboard.css");
  render();
}

export function unmount() { root = null; }

function render() {
  if (!root) return;
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const activeHelp = HELP_TYPES.find((item) => item.key === params.get("help")) || HELP_TYPES[0];
  const facilities = filteredFacilities(activeHelp);
  const allFacilities = Array.isArray(state.data?.facilities) ? state.data.facilities : [];
  const { asOf, source } = getSectionMeta("life");
  const sourceText = state.data ? sourceModeText(state.data.sourceMode) : "데이터 확인 중";
  root.innerHTML = `
    <div class="welfare-page" data-help="${escapeHtml(activeHelp.key)}">
      <header class="welfare-head">
        <div><p>WELFARE & HEALTH</p><h1>필요한 도움부터 찾습니다</h1><span>시설 수로 지역을 평가하지 않고, 이용에 필요한 확인 정보와 출처를 먼저 보여드립니다.</span></div>
        <a href="#/datasets?topic=welfare">관련 데이터 근거 ${icon("arrow-right", { size: 15 })}</a>
      </header>

      <section class="welfare-executive-strip" aria-label="복지·건강 데이터 요약">
        <article>
          <span>표시 원칙</span>
          <strong>확인 가능한 정보만</strong>
          <p>대상·운영시간이 없으면 분석값처럼 포장하지 않습니다.</p>
        </article>
        <article>
          <span>현재 주제</span>
          <strong>${escapeHtml(activeHelp.label)}</strong>
          <p>${escapeHtml(activeHelp.note)}</p>
        </article>
        <article>
          <span>관련 시설 행</span>
          <strong>${facilities.length.toLocaleString("ko-KR")}<small>행</small></strong>
          <p>현재 선택 조건에서 확인되는 공개 행</p>
        </article>
        <article>
          <span>데이터 상태</span>
          <strong>${escapeHtml(sourceText)}</strong>
          <p>${escapeHtml(asOf)} · ${escapeHtml(source)}</p>
        </article>
      </section>

      <section class="welfare-help" aria-labelledby="welfare-help-title">
        <div class="welfare-step"><span>STEP 01</span><h2 id="welfare-help-title">어떤 도움이 필요한가요?</h2></div>
        <div class="welfare-help-grid">
          ${HELP_TYPES.map((item) => `
            <button type="button" data-help="${item.key}" class="${item.key === activeHelp.key ? "is-active" : ""}">
              <i></i><strong>${item.label}</strong><span>${item.note}</span>${icon("chevron-right", { size: 15 })}
            </button>
          `).join("")}
        </div>
      </section>

      <section class="welfare-workspace">
        <div class="welfare-list-panel">
          <div class="welfare-panel-head">
            <div><span>STEP 02 · ${activeHelp.label}</span><h2>확인 가능한 시설</h2><p>현재 공개 데이터에서 확인되는 항목만 표시합니다.</p></div>
            <div class="welfare-view-switch" role="group" aria-label="보기 방식"><button class="is-active" type="button">목록</button><a href="#/nearby?category=${encodeURIComponent(activeHelp.categories[0])}">지도</a></div>
          </div>
          <div class="welfare-filter-row">
            <label>지역<select id="welfare-dong"><option value="">금천구 전체</option><option>가산동</option><option>독산동</option><option>시흥동</option></select></label>
            <span>공개 범위 <strong>GEUMCHEON</strong> · 전체 시설 데이터 ${allFacilities.length.toLocaleString("ko-KR")}행</span>
          </div>
          <div class="welfare-results" id="welfare-results">
            ${facilityRows(facilities)}
          </div>
        </div>
        <aside class="welfare-guide-panel">
          <div class="welfare-guide-kicker">BEFORE YOU VISIT</div>
          <h2>방문 전에 확인하세요</h2>
          <p class="welfare-guide-lead">공개 데이터에 없는 항목은 추정하지 않고, 방문 전 확인해야 하는 체크리스트로 안내합니다.</p>
          <ol><li><strong>대상</strong><span>서비스 이용 대상과 조건</span></li><li><strong>운영시간</strong><span>휴무일과 접수 마감 시간</span></li><li><strong>연락처</strong><span>방문 전 전화 확인</span></li><li><strong>확인일</strong><span>정보가 마지막으로 확인된 날짜</span></li></ol>
          <div class="welfare-caution"><span>${icon("info", { size: 15 })}</span><p>표시되지 않은 정보는 추정하지 않습니다. 시설에 직접 확인해 주세요.</p></div>
          <div class="welfare-data-stamp">${renderDataStamp("life", "복지·건강 시설")}</div>
        </aside>
      </section>

      <div class="welfare-drawer" id="welfare-drawer" aria-hidden="true">
        <button class="welfare-drawer-backdrop" type="button" data-close-drawer aria-label="상세 닫기"></button>
        <aside class="welfare-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="welfare-drawer-title">
          <button class="welfare-drawer-close" type="button" data-close-drawer aria-label="상세 닫기">×</button>
          <div id="welfare-drawer-content"></div>
        </aside>
      </div>
    </div>
  `;
  bind(activeHelp);
}

function filteredFacilities(help) {
  const facilities = Array.isArray(state.data?.facilities) ? state.data.facilities : [];
  return facilities.filter((item) => help.categories.some((category) => String(item.category || "").includes(category))).slice(0, 12);
}

function facilityRows(facilities) {
  if (!facilities.length) return `<div class="welfare-empty"><strong>현재 확인 가능한 시설 데이터가 없습니다.</strong><span>필터를 바꾸거나 데이터 카탈로그에서 수집 상태를 확인해 주세요.</span><a href="#/datasets?topic=welfare">데이터 상태 확인</a></div>`;
  return facilities.map((facility, index) => `
    <button class="welfare-result" type="button" data-facility-index="${index}">
      <span class="welfare-result-type">${escapeHtml(facility.category || "시설")}</span>
      <div><strong>${escapeHtml(facility.name || "이름 확인 필요")}</strong><p>${escapeHtml(facility.address || "주소 정보 없음")}</p></div>
      <span class="welfare-result-source">출처 확인</span>${icon("chevron-right", { size: 16 })}
    </button>
  `).join("");
}

function bind(activeHelp) {
  const facilities = filteredFacilities(activeHelp);
  root.querySelectorAll("[data-help]").forEach((button) => button.addEventListener("click", () => {
    history.replaceState(null, "", `${location.pathname}${location.search}#/welfare?help=${button.dataset.help}`);
    render();
  }));
  root.querySelectorAll("[data-facility-index]").forEach((button) => button.addEventListener("click", () => openDrawer(facilities[Number(button.dataset.facilityIndex)])));
  root.querySelectorAll("[data-close-drawer]").forEach((button) => button.addEventListener("click", closeDrawer));
  root.querySelector("#welfare-dong")?.addEventListener("change", (event) => {
    const dong = event.target.value;
    const visible = facilities.filter((facility) => !dong || String(facility.address || "").includes(dong));
    root.querySelector("#welfare-results").innerHTML = facilityRows(visible);
  });
}

function openDrawer(facility) {
  if (!facility) return;
  const drawer = root.querySelector("#welfare-drawer");
  const content = root.querySelector("#welfare-drawer-content");
  content.innerHTML = `<p class="welfare-drawer-kicker">${escapeHtml(facility.category || "시설")}</p><h2 id="welfare-drawer-title">${escapeHtml(facility.name || "시설 상세")}</h2><dl><div><dt>주소</dt><dd>${escapeHtml(facility.address || "확인 필요")}</dd></div><div><dt>연락처</dt><dd>${escapeHtml(facility.phone || "시설에 직접 확인")}</dd></div><div><dt>이용 대상</dt><dd>공개 데이터에서 확인되지 않음</dd></div><div><dt>운영시간</dt><dd>방문 전 시설에 확인</dd></div><div><dt>서비스</dt><dd>${escapeHtml(facility.category || "관련 서비스")}</dd></div><div><dt>출처·확인일</dt><dd>${escapeHtml(facility.source || "데이터 카탈로그 확인")} · 항목별 기준일</dd></div></dl><div class="welfare-drawer-actions"><a href="https://map.kakao.com/link/search/${encodeURIComponent(facility.address || facility.name || "금천구")}" target="_blank" rel="noopener noreferrer">길찾기</a><a href="#/datasets?topic=welfare">데이터 근거</a></div>`;
  drawer.setAttribute("aria-hidden", "false");
  drawer.classList.add("is-open");
  root.querySelector(".welfare-drawer-close")?.focus();
}

function closeDrawer() {
  const drawer = root?.querySelector("#welfare-drawer");
  drawer?.setAttribute("aria-hidden", "true");
  drawer?.classList.remove("is-open");
}
