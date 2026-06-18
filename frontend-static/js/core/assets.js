// 외부 리소스(페이지 CSS·Leaflet JS) 멱등 동적 로더 유틸

/**
 * 페이지별 CSS를 한 번만 주입한다. 이미 존재하면 무시한다.
 * @param {string} id   - <link> 엘리먼트 ID (중복 체크용)
 * @param {string} href - CSS 파일 경로
 */
export function injectPageCss(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Leaflet 1.9.4 CSS·JS를 멱등으로 로드한다.
 * window.L이 이미 있으면 즉시 resolve. 스크립트 태그가 이미
 * 있으면 load/error 이벤트만 구독해 중복 삽입을 방지한다.
 * @returns {Promise<void>}
 */
export function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }

    injectPageCss("leaflet-css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");

    const existing = document.getElementById("leaflet-js");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet 스크립트 로드 실패")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Leaflet 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
}
