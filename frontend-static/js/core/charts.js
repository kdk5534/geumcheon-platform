// ECharts 동적 로드 + 차트 생성·소멸 헬퍼

const ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";

// styles.css 색상 변수 기반 팔레트 (강남·서초 톤)
export const CHART_PALETTE = [
  "#146b4a", // --green
  "#197982", // --teal
  "#245b9e", // --blue
  "#6556a3", // --violet
  "#b56b17", // --amber
  "#bd493c", // --red
];

// 차트 텍스트·그리드 공통 색상
export const CHART_COLORS = {
  text:    "#65736d", // --muted
  line:    "#d8e0dd", // --line
  ink:     "#14201b", // --ink
  surface: "#ffffff", // --surface
};

// 모든 ECharts 차트에 적용할 기본 테마 옵션
export const BASE_OPTION = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: '"Pretendard", "Pretendard Variable", "Noto Sans KR", "Malgun Gothic", sans-serif', color: CHART_COLORS.text, fontSize: 12 },
  color: CHART_PALETTE,
};

// ─── ECharts 로더 ─────────────────────────────────────────────

/**
 * ECharts JS를 CDN에서 동적으로 로드한다.
 * 이미 로드된 경우 즉시 resolve. 로딩 중이면 완료 이벤트를 기다린다.
 * (map.js loadLeaflet() 패턴과 동일)
 */
export function loadECharts() {
  return new Promise((resolve, reject) => {
    if (window.echarts) {
      resolve();
      return;
    }

    const existing = document.getElementById("echarts-js");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("ECharts 스크립트 로드 실패")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "echarts-js";
    script.src = ECHARTS_CDN;
    script.onload = resolve;
    script.onerror = () => reject(new Error("ECharts 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
}

// ─── 차트 인스턴스 관리 ───────────────────────────────────────

// el → ResizeObserver 맵 (disposeChart 시 정리)
const observerMap = new WeakMap();

/**
 * el에 ECharts 인스턴스를 생성하고 option을 적용한다.
 * ResizeObserver로 컨테이너 크기 변화를 자동 감지한다.
 * loadECharts() 완료 후 호출해야 한다.
 */
export function createChart(el, option) {
  const chart = window.echarts.init(el, null, { renderer: "canvas" });
  chart.setOption({ ...BASE_OPTION, ...option });

  const observer = new ResizeObserver(() => chart.resize());
  observer.observe(el);
  observerMap.set(el, observer);

  return chart;
}

/**
 * ECharts 인스턴스와 ResizeObserver를 정리한다.
 * 페이지 unmount() 에서 반드시 호출해야 메모리 누수가 없다.
 */
export function disposeChart(chart) {
  if (!chart) return;
  const el = chart.getDom();
  if (el) {
    const observer = observerMap.get(el);
    if (observer) {
      observer.disconnect();
      observerMap.delete(el);
    }
  }
  chart.dispose();
}

/**
 * ECharts 세로 선형 그라디언트 colorStop 객체를 반환한다.
 * areaStyle.color / series itemStyle.color 에 직접 전달한다.
 * @param {string} hex — 상단 진한 색상 hex (예: "#146b4a")
 * @param {number} [alpha=0.85] — 상단 알파 (0~1)
 */
export function makeGradient(hex, alpha = 0.85) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    type: "linear", x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(${r},${g},${b},${alpha})` },
      { offset: 1, color: `rgba(${r},${g},${b},0)` }
    ]
  };
}
