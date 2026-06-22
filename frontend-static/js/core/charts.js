// ECharts 동적 로드 + 차트 생성·소멸 헬퍼

import { loadScriptOnce } from "./assets.js";

const ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";

// 금천구 공식 브랜드 색상 기반 팔레트 (시안→마젠타 계열 우선)
export const CHART_PALETTE = [
  "#0d93cf", // --teal (금천 시안블루)
  "#3f7180", // subdued blue-teal accent
  "#0c7fb8", // --green (딥 시안)
  "#6556a3", // --violet
  "#b56b17", // --amber
  "#245b9e", // --blue
  "#bd493c", // --red
];

// 차트 텍스트·그리드 공통 색상 — Proxy로 현재 CSS 변수를 실시간 반환한다.
// 다크 테마 전환 후 페이지가 remount되면 render 시점 토큰을 읽어 자동 적용된다.
const _COLOR_MAP = {
  text:    "--text-secondary",
  line:    "--border-subtle",
  ink:     "--text-primary",
  surface: "--surface-base",
  muted:   "--text-tertiary",
};
const _COLOR_FALLBACK = {
  text: "#65736d", line: "#d8e0dd", ink: "#14201b", surface: "#ffffff", muted: "#8a9e97",
};
export const CHART_COLORS = new Proxy({}, {
  get(_, key) {
    const cssVar = _COLOR_MAP[key];
    if (!cssVar) return _COLOR_FALLBACK[key] ?? "#65736d";
    return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
      || _COLOR_FALLBACK[key];
  },
});

const _FONT = '"Pretendard", "Pretendard Variable", "Noto Sans KR", "Malgun Gothic", sans-serif';

// 모든 ECharts 차트에 적용할 기본 테마 옵션 (fontFamily 참조 용도로만 유지)
export const BASE_OPTION = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: _FONT, color: "#65736d", fontSize: 12 },
  color: CHART_PALETTE,
};

// ─── ECharts 로더 ─────────────────────────────────────────────

/**
 * ECharts JS를 CDN에서 동적으로 로드한다.
 * 이미 로드된 경우 즉시 resolve. 로딩 중이면 완료 이벤트를 기다린다.
 * (map.js loadLeaflet() 패턴과 동일)
 */
export function loadECharts() {
  return loadScriptOnce({
    id: "echarts-js",
    src: ECHARTS_CDN,
    isReady: () => Boolean(window.echarts),
    errorMessage: "ECharts 스크립트 로드 실패",
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
  // 현재 테마 토큰을 읽어 기본 옵션을 동적으로 구성한다. (CHART_COLORS는 Proxy)
  const dynamicBase = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: _FONT, color: CHART_COLORS.text, fontSize: 12 },
    color: CHART_PALETTE,
  };
  chart.setOption({ ...dynamicBase, ...option });

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
