// 외부 리소스(페이지 CSS·Leaflet JS·MarkerCluster) 멱등 동적 로더 유틸

import { BACKEND_API_BASE } from "./state.js";

export function isExternalAssetsEnabled() {
  const configured = globalThis.window?.__ENV__?.ENABLE_EXTERNAL_ASSETS;
  if (configured != null && configured !== "") {
    return String(configured).toLowerCase() === "true";
  }
  const runtimeBackendBase = globalThis.window?.__ENV__?.BACKEND_API_BASE || BACKEND_API_BASE;
  if (runtimeBackendBase) {
    return true;
  }
  const hostname = globalThis.window?.location?.hostname || "";
  return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
}

/**
 * 페이지별 CSS를 한 번만 주입한다. 이미 존재하면 무시한다.
 * @param {string} id   - <link> 엘리먼트 ID (중복 체크용)
 * @param {string} href - CSS 파일 경로
 */
export function injectPageCss(id, href) {
  const existing = document.getElementById(id);
  if (existing) {
    if (id === "css-professional-dashboard") {
      document.head.appendChild(existing);
    }
    if (existing.sheet || existing.dataset.loadState === "loaded") return Promise.resolve(true);
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.loadState = "loading";
  const loaded = new Promise((resolve) => {
    link.addEventListener("load", () => {
      link.dataset.loadState = "loaded";
      resolve(true);
    }, { once: true });
    link.addEventListener("error", () => {
      link.dataset.loadState = "error";
      resolve(false);
    }, { once: true });
  });
  document.head.appendChild(link);
  return loaded;
}

export function loadScriptOnce({ id, src, isReady, errorMessage, timeoutMs = 8_000 }) {
  if (isReady()) return Promise.resolve();

  let script = document.getElementById(id);
  let created = false;
  if (script?.dataset.loadState === "error") {
    script.remove();
    script = null;
  }

  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.dataset.loadState = "loading";
    created = true;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (error) {
        script.dataset.loadState = "error";
        script.remove();
        reject(error);
        return;
      }
      script.dataset.loadState = "loaded";
      resolve();
    };
    const onLoad = () => finish(isReady() ? null : new Error(errorMessage));
    const onError = () => finish(new Error(errorMessage));
    const timer = setTimeout(() => finish(new Error(`${errorMessage} (timeout)`)), timeoutMs);

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (created) document.head.appendChild(script);
    else if (isReady()) finish(null);
  });
}

export async function loadScriptWithFallback({ id, sources, isReady, errorMessage, timeoutMs = 8_000 }) {
  if (isReady()) return;
  let lastError = null;
  for (let index = 0; index < sources.length; index += 1) {
    try {
      await loadScriptOnce({
        id: `${id}-${index}`,
        src: sources[index],
        isReady,
        errorMessage,
        timeoutMs,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(errorMessage);
}

/**
 * Leaflet 1.9.4 CSS·JS를 멱등으로 로드한다.
 * window.L이 이미 있으면 즉시 resolve. 스크립트 태그가 이미
 * 있으면 load/error 이벤트만 구독해 중복 삽입을 방지한다.
 * @returns {Promise<void>}
 */
export function loadLeaflet() {
  if (!isExternalAssetsEnabled()) {
    return Promise.reject(new Error("External map assets disabled for local preview"));
  }
  injectPageCss("leaflet-css-unpkg", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
  injectPageCss("leaflet-css-jsdelivr", "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css");
  return loadScriptWithFallback({
    id: "leaflet-js",
    sources: [
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
    ],
    isReady: () => Boolean(window.L),
    errorMessage: "Leaflet 스크립트 로드 실패",
  });
}

/**
 * Leaflet.markercluster 1.5.3 CSS·JS를 멱등으로 로드한다.
 * Leaflet이 먼저 로드되어 있어야 한다.
 * @returns {Promise<void>}
 */
export function loadMarkerCluster() {
  if (!isExternalAssetsEnabled()) {
    return Promise.reject(new Error("External map assets disabled for local preview"));
  }
  injectPageCss("markercluster-css-unpkg", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css");
  injectPageCss("markercluster-default-css-unpkg", "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css");
  injectPageCss("markercluster-css-jsdelivr", "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css");
  injectPageCss("markercluster-default-css-jsdelivr", "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css");
  return loadScriptWithFallback({
    id: "markercluster-js",
    sources: [
      "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
      "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
    ],
    isReady: () => Boolean(window.L?.MarkerClusterGroup),
    errorMessage: "MarkerCluster 로드 실패",
  });
}

/**
 * 서버 프록시를 통해 VWorld 타일 레이어를 반환한다.
 * API 키는 브라우저에 노출하지 않으며 다른 지도 공급자로 자동 전환하지 않는다.
 *
 * @param {object} L         - window.L (Leaflet)
 * @param {"base"|"satellite"|"hybrid"} [type="base"] - 레이어 종류
 * @returns {object} Leaflet TileLayer
 */
export function createBaseTileLayer(L, type = "base") {
  const style = ["base", "satellite", "hybrid"].includes(type) ? type : "base";
  return L.tileLayer(`${BACKEND_API_BASE}/api/public/map/tiles/${style}/{z}/{y}/{x}`, {
    attribution: '&copy; <a href="https://www.vworld.kr" target="_blank" rel="noopener">VWorld</a> · 국토교통부',
    minZoom: 6,
    maxZoom: 18,
    tms: false,
    crossOrigin: true,
    errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
  });
}

export function bindTileFailureFallback(tileLayer, onUnavailable, threshold = 3) {
  let failures = 0;
  let notified = false;
  tileLayer.on("tileerror", () => {
    failures += 1;
    if (!notified && failures >= threshold) {
      notified = true;
      onUnavailable?.();
    }
  });
  return tileLayer;
}
