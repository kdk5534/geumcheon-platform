import { state } from "./state.js";

const routes = {};

const SECTION_CONFIG = {
  home: {
    title: "종합 현황",
    documentTitle: "종합 현황",
    items: [
      { label: "대시보드", href: "#/home", pages: ["home"] },
      { label: "최근 도시현황", href: "#/realtime", pages: ["realtime"] },
      { label: "핵심 지표", href: "#/indicators", pages: ["indicators"] },
    ],
  },
  population: {
    title: "인구·생활",
    documentTitle: "인구·생활 분석",
    items: [
      { label: "인구 구조", href: "#/population", pages: ["population"] },
      { label: "생활시설 지도", href: "#/nearby", pages: ["map"] },
      { label: "분야별 생활 데이터", href: "#/topics", pages: ["topics"] },
    ],
  },
  commercial: {
    title: "상권·경제",
    documentTitle: "상권·경제 분석",
    items: [
      { label: "상권 현황", href: "#/commercial", pages: ["commercial"] },
      { label: "지역별 비교", href: "#/dong", pages: ["dong"] },
      { label: "관련 데이터셋", href: "#/datasets", pages: ["catalog"] },
    ],
  },
  safety: {
    title: "안전·환경",
    documentTitle: "안전·환경 현황",
    items: [
      { label: "통합 상황 지도", href: "#/safety", pages: ["safety"] },
      { label: "안전시설 목록", href: "#/nearby?category=CCTV", pages: ["map"] },
      { label: "관련 데이터", href: "#/datasets?topic=safety", pages: ["catalog"] },
    ],
  },
  welfare: {
    title: "복지·건강",
    documentTitle: "복지·건강 정보",
    items: [
      { label: "필요한 도움", href: "#/welfare", pages: ["welfare"] },
      { label: "복지시설 찾기", href: "#/nearby?category=복지", pages: ["map"] },
      { label: "관련 데이터", href: "#/datasets?topic=welfare", pages: ["catalog"] },
    ],
  },
  catalog: {
    title: "데이터 카탈로그",
    documentTitle: "데이터 카탈로그",
    items: [
      { label: "데이터셋 검색", href: "#/datasets", pages: ["catalog"] },
      { label: "데이터 이용안내", href: "#/about", pages: ["about"] },
    ],
  },
};

let currentPage = null;
let viewContainer = null;
let mountSequence = 0;

export function init(container, pageMap, defaultRoute = "home") {
  viewContainer = container;

  Object.entries(pageMap).forEach(([path, module]) => {
    routes[path] = module;
  });

  window.addEventListener("hashchange", () => navigate(defaultRoute));
  navigate(defaultRoute);
}

export function navigate(defaultRoute = "home") {
  const route = resolveRoute(defaultRoute);
  applyRouteState(route);
  syncPageChrome(route);
  mountPage(route.page, defaultRoute);
  syncNavActive(route.primaryNav);
}

export function go(path) {
  location.hash = `#/${path}`;
}

function mountPage(routeKey, defaultRoute) {
  const page = routes[routeKey] || routes[defaultRoute];

  if (!viewContainer || !page) {
    return;
  }

  const sequence = ++mountSequence;

  if (currentPage?.unmount) {
    try {
      currentPage.unmount();
    } catch (error) {
      console.warn("Page cleanup failed", error);
    }
  }

  currentPage = page;
  viewContainer.setAttribute("aria-busy", "true");
  viewContainer.classList.remove("is-view-entering");
  void viewContainer.offsetWidth;
  viewContainer.classList.add("is-view-entering");

  try {
    const result = page.mount(viewContainer);
    Promise.resolve(result)
      .then(() => {
        if (sequence !== mountSequence || currentPage !== page) return;
        viewContainer.removeAttribute("aria-busy");
        enhancePageBack();
        window.setTimeout(() => viewContainer?.classList.remove("is-view-entering"), 260);
      })
      .catch((error) => {
        if (sequence !== mountSequence || currentPage !== page) return;
        renderMountError(error);
      });
  } catch (error) {
    if (sequence === mountSequence && currentPage === page) {
      renderMountError(error);
    }
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderMountError(error) {
  viewContainer?.removeAttribute("aria-busy");
  if (!viewContainer) return;

  const section = document.createElement("section");
  section.className = "route-error";
  section.setAttribute("role", "alert");

  const title = document.createElement("h2");
  title.textContent = "화면을 불러오지 못했습니다";
  const message = document.createElement("p");
  message.textContent = "잠시 후 새로고침하거나 다른 메뉴를 이용해 주세요.";
  section.append(title, message);
  viewContainer.replaceChildren(section);

  console.error("Page mount failed", error);
}

function syncNavActive(navKey) {
  document.querySelectorAll(".nav a[data-route]").forEach((link) => {
    const isActive = link.dataset.route === navKey;
    link.classList.toggle("is-active", isActive);
  });
}

function syncPageChrome(route) {
  const config = SECTION_CONFIG[route.primaryNav] || SECTION_CONFIG.home;
  const title = document.getElementById("section-context-title");
  const nav = document.getElementById("section-nav");

  if (title) title.textContent = config.title;
  document.title = `${config.documentTitle} | 금천 데이터플랫폼`;

  if (!nav) return;
  nav.innerHTML = config.items.map((item) => {
    const active = item.pages.includes(route.page);
    return `<a href="${item.href}"${active ? ' class="is-active" aria-current="page"' : ""}>${item.label}</a>`;
  }).join("");
}

function resolveRoute(defaultRoute) {
  const raw = location.hash.replace(/^#\/?/, "") || defaultRoute;
  const [pathPart, searchPart = ""] = raw.split("?");
  const path = pathPart || defaultRoute;
  const params = new URLSearchParams(searchPart);

  if (path === "today" || path === "home") {
    return { page: "home", primaryNav: "home", params };
  }

  if (path === "nearby" || path === "map") {
    return { page: "map", primaryNav: navForMap(params), params };
  }

  if (path === "dong") {
    if (params.get("section") === "population") {
      return { page: "population", primaryNav: "population", params };
    }
    if (params.get("section") === "accessibility" || params.get("metric")) {
      return { page: "geo", primaryNav: "population", params };
    }
    return { page: "dong", primaryNav: "commercial", params };
  }

  if (path === "population") {
    return { page: "population", primaryNav: "population", params };
  }

  if (path === "welfare") {
    return { page: "welfare", primaryNav: "welfare", params };
  }

  if (path === "geo") {
    return { page: "geo", primaryNav: "population", params };
  }

  if (path === "topics") {
    const topic = params.get("topic");
    if (topic === "welfare") {
      return { page: "welfare", primaryNav: "welfare", params };
    }
    if (topic === "safety") {
      return { page: "safety", primaryNav: "safety", params };
    }
    if (topic === "economy") {
      return { page: "commercial", primaryNav: "commercial", params };
    }
    return { page: "topics", primaryNav: "population", params };
  }

  if (path === "realtime") {
    return { page: path, primaryNav: "home", params };
  }

  if (path === "safety") {
    return { page: path, primaryNav: "safety", params };
  }

  if (path === "indicators") {
    return { page: path, primaryNav: "home", params };
  }

  if (path === "commercial") {
    return { page: path, primaryNav: "commercial", params };
  }

  if (path === "datasets" || path === "catalog") {
    return { page: "catalog", primaryNav: "catalog", params };
  }

  if (path === "api" || path === "api-logs") {
    return state.adminAuth
      ? { page: path, primaryNav: "", params }
      : { page: "admin", primaryNav: "", params };
  }

  if (path === "about" || path === "admin") {
    return { page: path, primaryNav: "", params };
  }

  return { page: defaultRoute, primaryNav: "home", params };
}

function navForMap(params) {
  const explicit = params.get("nav") || params.get("section");
  if (["population", "welfare", "safety", "commercial"].includes(explicit)) {
    return explicit;
  }

  const category = (params.get("category") || "").trim().toLocaleLowerCase("ko-KR");
  if (!category) {
    return "population";
  }

  if (["복지", "병원", "약국", "의료", "돌봄", "어르신", "장애", "쉼터"].some((keyword) => category.includes(keyword))) {
    return "welfare";
  }

  if (["cctv", "안전", "보호구역", "스쿨존", "대피", "대기", "환경"].some((keyword) => category.includes(keyword))) {
    return "safety";
  }

  return "population";
}

function applyRouteState(route) {
  const { page, params } = route;

  if (page === "map") {
    const category = params.get("category");
    if (category) {
      state.category = category;
    }
  }

  if (page === "geo") {
    const metric = params.get("metric");
    const district = params.get("district");
    if (metric) {
      state.geoMetric = metric;
    }
    if (district) {
      state.geoDistrict = district;
    }
  }

  if (page === "dong") {
    const district = params.get("district");
    if (district) {
      state.geoDistrict = district;
      state.populationDistrict = district;
    }
  }

  if (page === "population") {
    const district = params.get("district");
    if (district) {
      state.populationDistrict = district;
    }
  }

  if (page === "commercial") {
    const industry = params.get("industry");
    if (industry) {
      state.industry = industry;
    }
  }
}

function enhancePageBack() {
  const CHEVRON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon"><polyline points="15 18 9 12 15 6"/></svg>`;

  document.querySelectorAll(".page-back:not([data-icon-done])").forEach((el) => {
    el.dataset.iconDone = "1";
    const label = el.textContent.replace(/^[←↩\s]+/, "").trim() || "이전으로";
    el.innerHTML = `${CHEVRON_LEFT} ${label}`;
  });
}
