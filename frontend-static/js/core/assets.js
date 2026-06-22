// 외부 리소스(페이지 CSS·Leaflet JS·MarkerCluster) 멱등 동적 로더 유틸

import { VWORLD_KEY } from "./state.js";

/**
 * 페이지별 CSS를 한 번만 주입한다. 이미 존재하면 무시한다.
 * @param {string} id   - <link> 엘리먼트 ID (중복 체크용)
 * @param {string} href - CSS 파일 경로
 */
export function injectPageCss(id, href) {
  const existing = document.getElementById(id);
  if (existing) {
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

/**
 * Leaflet 1.9.4 CSS·JS를 멱등으로 로드한다.
 * window.L이 이미 있으면 즉시 resolve. 스크립트 태그가 이미
 * 있으면 load/error 이벤트만 구독해 중복 삽입을 방지한다.
 * @returns {Promise<void>}
 */
export function loadLeaflet() {
  injectPageCss("leaflet-css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
  return loadScriptOnce({
    id: "leaflet-js",
    src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
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
  injectPageCss("markercluster-css",         "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css");
  injectPageCss("markercluster-default-css",  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css");
  return loadScriptOnce({
    id: "markercluster-js",
    src: "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
    isReady: () => Boolean(window.L?.MarkerClusterGroup),
    errorMessage: "MarkerCluster 로드 실패",
  });
}

/**
 * VWorld 또는 OSM 기반 Leaflet 타일 레이어를 반환한다.
 * VWORLD_KEY가 설정되어 있으면 VWorld 한국 지도 타일을 사용하고,
 * 없으면 OpenStreetMap으로 폴백한다.
 *
 * @param {object} L         - window.L (Leaflet)
 * @param {"base"|"satellite"|"hybrid"} [type="base"] - 레이어 종류
 * @returns {object} Leaflet TileLayer
 */
export function createBaseTileLayer(L, type = "base") {
  if (VWORLD_KEY) {
    const layerMap = {
      base:      { layer: "Base",      ext: "png",  maxZoom: 18 },
      satellite: { layer: "Satellite", ext: "jpeg", maxZoom: 18 },
      hybrid:    { layer: "Hybrid",    ext: "png",  maxZoom: 18 },
    };
    const cfg = layerMap[type] || layerMap.base;
    return L.tileLayer(
      `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${cfg.layer}/{z}/{y}/{x}.${cfg.ext}`,
      {
        attribution: '&copy; <a href="https://www.vworld.kr" target="_blank">VWorld</a> · 국토교통부',
        maxZoom: cfg.maxZoom,
        tms: false,
      }
    );
  }

  // OSM 폴백
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxZoom: 19,
  });
}
