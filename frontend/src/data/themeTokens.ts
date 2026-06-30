// 차트·지도용 디자인 토큰 리더 — .gdp-app CSS 변수를 읽어 구체 색상값을 반환
// ECharts option 및 Leaflet divIcon에서 CSS 변수를 직접 쓸 수 없으므로 런타임 읽기가 필요하다.

export interface ChartTokens {
  /** 카테고리 시리즈 색 [0]=cobalt [1]=mint [2]=coral [3]=amber [4]=violet [5]=teal */
  series: [string, string, string, string, string, string];
  /** 축 레이블 색 (--gdp-axis-label) */
  axisLabel: string;
  /** 축 선 색 (--gdp-axis-line) */
  axisLine: string;
  /** 그리드 선 색 (--gdp-grid-line) */
  gridLine: string;
  /** 비활성 막대 색 (--gdp-line-strong) */
  inactiveBar: string;
  /** 브랜드 액션 색 (--gdp-action, 선택 막대) */
  action: string;
  /** 앰버 — 평균선·마킹 등 강조 (--gdp-series-4) */
  amber: string;
}

function v(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/**
 * 현재 테마 기준 차트 토큰을 읽어 반환한다.
 * .gdp-app 요소가 없으면 :root를 대상으로 한다(SSR·테스트 환경).
 * ECharts·Leaflet option 생성 직전, useEffect 안에서 호출할 것.
 */
export function readChartTokens(): ChartTokens {
  const el = document.querySelector(".gdp-app") ?? document.documentElement;
  return {
    series: [
      v(el, "--gdp-series-1"),
      v(el, "--gdp-series-2"),
      v(el, "--gdp-series-3"),
      v(el, "--gdp-series-4"),
      v(el, "--gdp-series-5"),
      v(el, "--gdp-series-6"),
    ],
    axisLabel:   v(el, "--gdp-axis-label"),
    axisLine:    v(el, "--gdp-axis-line"),
    gridLine:    v(el, "--gdp-grid-line"),
    inactiveBar: v(el, "--gdp-line-strong"),
    action:      v(el, "--gdp-action"),
    amber:       v(el, "--gdp-series-4"),
  };
}
