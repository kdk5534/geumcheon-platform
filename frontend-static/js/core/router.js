import { state } from "./state.js";

const routes = {};

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

  try {
    const result = page.mount(viewContainer);
    Promise.resolve(result)
      .then(() => {
        if (sequence !== mountSequence || currentPage !== page) return;
        viewContainer.removeAttribute("aria-busy");
        enhancePageBack();
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

function resolveRoute(defaultRoute) {
  const raw = location.hash.replace(/^#\/?/, "") || defaultRoute;
  const [pathPart, searchPart = ""] = raw.split("?");
  const path = pathPart || defaultRoute;
  const params = new URLSearchParams(searchPart);

  if (path === "today" || path === "home") {
    return { page: "home", primaryNav: "home", params };
  }

  if (path === "nearby" || path === "map") {
    return { page: "map", primaryNav: "nearby", params };
  }

  if (path === "dong") {
    if (params.get("section") === "population") {
      return { page: "population", primaryNav: "dong", params };
    }
    if (params.get("section") === "accessibility" || params.get("metric")) {
      return { page: "geo", primaryNav: "dong", params };
    }
    return { page: "dong", primaryNav: "dong", params };
  }

  if (path === "population") {
    return { page: "population", primaryNav: "dong", params };
  }

  if (path === "geo") {
    return { page: "geo", primaryNav: "dong", params };
  }

  if (path === "topics") {
    const topic = params.get("topic");
    if (topic === "safety") {
      return { page: "realtime", primaryNav: "topics", params };
    }
    if (topic === "economy") {
      return { page: "commercial", primaryNav: "topics", params };
    }
    return { page: "topics", primaryNav: "topics", params };
  }

  if (path === "realtime" || path === "indicators" || path === "commercial") {
    return { page: path, primaryNav: "topics", params };
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
