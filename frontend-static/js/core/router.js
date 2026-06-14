// 해시 기반 라우터: hashchange를 듣고 현재 라우트 페이지를 렌더한다

/** 등록된 라우트 맵 { path: pageModule } */
const routes = {};

/** 현재 마운트된 페이지 모듈 */
let currentPage = null;

/** 라우터가 렌더할 컨테이너 엘리먼트 */
let viewContainer = null;

/**
 * 라우터를 초기화한다.
 * @param {HTMLElement} container — 페이지를 렌더할 <main> 엘리먼트
 * @param {Object} pageMap — { "home": homeModule, "map": mapModule, ... }
 * @param {string} defaultRoute — 매칭 없을 때 이동할 기본 라우트 ("home")
 */
export function init(container, pageMap, defaultRoute = "home") {
  viewContainer = container;

  Object.entries(pageMap).forEach(([path, module]) => {
    routes[path] = module;
  });

  window.addEventListener("hashchange", () => navigate());
  navigate(defaultRoute);
}

/** 현재 해시를 읽어 해당 페이지를 마운트한다. */
export function navigate(defaultRoute = "home") {
  const hash = location.hash.replace(/^#\/?/, "") || defaultRoute;
  mountPage(hash, defaultRoute);
  syncNavActive(hash);
}

/** 지정한 라우트로 이동한다. */
export function go(path) {
  location.hash = `#/${path}`;
}

// ─── 내부 함수 ────────────────────────────────────────────────

function mountPage(hash, defaultRoute) {
  const page = routes[hash] || routes[defaultRoute];

  if (!viewContainer || !page) {
    return;
  }

  if (currentPage?.unmount) {
    currentPage.unmount();
  }

  currentPage = page;

  // mount는 동기·비동기 모두 가능 — 비동기 완료 후 아이콘을 보강한다
  const result = page.mount(viewContainer);
  if (result && typeof result.then === "function") {
    result.then(() => enhancePageBack());
  } else {
    enhancePageBack();
  }

  // 페이지 전환 시 최상단으로 스크롤
  window.scrollTo({ top: 0, behavior: "instant" });
}

function syncNavActive(hash) {
  document.querySelectorAll(".nav a[data-route]").forEach((link) => {
    const isActive = link.dataset.route === hash;
    link.classList.toggle("is-active", isActive);
  });
}

/** 마운트된 페이지의 .page-back 링크에 SVG 화살표 아이콘을 삽입한다. */
function enhancePageBack() {
  const CHEVRON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon"><polyline points="15 18 9 12 15 6"/></svg>`;

  document.querySelectorAll(".page-back:not([data-icon-done])").forEach((el) => {
    el.dataset.iconDone = "1";
    // "← 홈으로" 텍스트에서 화살표 문자 제거 후 아이콘 삽입
    const label = el.textContent.replace(/^[←→\s]+/, "").trim() || "홈으로";
    el.innerHTML = `${CHEVRON_LEFT} ${label}`;
  });
}
