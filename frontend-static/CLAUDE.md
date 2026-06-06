# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 서버 실행

```
node serve-static.mjs           # http://localhost:3000
PORT=4000 node serve-static.mjs # 포트 변경
```

빌드 도구 없음. 저장 → 브라우저 새로고침이 전부다. `serve-static.mjs`가 `.js` 파일을 `text/javascript`로 서빙하기 때문에 네이티브 ES Module import가 그대로 동작한다.

백엔드 mock(Spring Boot) 별도 실행 시 `http://localhost:8080`이 자동으로 연결된다. 없으면 로컬 Mock JSON으로 폴백한다.

## 아키텍처 개요

**바닐라 JS + 네이티브 ES Module. 빌드 단계 없음.**

```
index.html              — 앱 셸 (topbar + <main id="view"> + <script type="module" src="./js/main.js">)
js/main.js              — 진입점: 라우터 초기화 + 데이터 부트 + 페이지 모듈 등록
js/core/
  state.js              — 전역 state 객체 + 앱 상수 (모든 페이지가 import)
  router.js             — hashchange → mount/unmount 디스패치
  api.js                — fetch 래퍼 (state 직접 수정 안 함, 데이터만 반환)
  charts.js             — ECharts CDN 동적 로드 + createChart/disposeChart 헬퍼
  selectors.js          — state를 읽는 순수 셀렉터 함수 4개
  dom.js                — escapeHtml 등 순수 유틸
  meta.js               — sourceMode 텍스트·기준시각 유틸
js/pages/               — 각 라우트 페이지 모듈 (아래 참조)
css/tokens.css          — 공간·색상·타이포 CSS 변수
css/components.css      — 공통 컴포넌트 (topic-card 등)
css/pages/              — 페이지별 전용 CSS (라우터가 동적 주입)
assets/data/            — Mock JSON + GeoJSON
```

## 페이지 모듈 인터페이스

모든 페이지 모듈(`js/pages/*.js`)은 동일한 계약을 따른다.

```js
export async function mount(container) { ... }  // 항상 async
export function unmount() { ... }               // 동기, 리소스 정리
```

`router.js`가 해시 변경 시 이전 페이지의 `unmount()` → 새 페이지의 `mount(container)` 순으로 호출한다.

**필수 패턴 — 모든 async 페이지 모듈에 적용:**

```js
let isMounted = false;

export async function mount(container) {
  isMounted = true;
  // ... HTML 렌더
  await loadECharts(); // 또는 loadLeaflet()
  if (!isMounted) return; // 비동기 로드 중 페이지 전환 race condition 방지
  // ... 차트 초기화
}

export function unmount() {
  isMounted = false;
  disposeChart(chartInstance); chartInstance = null;
}
```

## 외부 라이브러리 동적 로드

Leaflet과 ECharts는 `index.html`에 미리 넣지 않고, 해당 페이지 첫 마운트 시에만 CDN에서 동적 로드한다.

- **Leaflet**: `map.js` 내부 `loadLeaflet()` — `window.L` 존재 시 즉시 resolve, 중복 삽입은 `document.getElementById("leaflet-js")` 감시로 방지.
- **ECharts**: `js/core/charts.js`의 `loadECharts()` — 동일 패턴. `window.echarts` 존재 시 즉시 resolve.

두 함수 모두 Promise를 반환하므로 `await` 후 `isMounted` 플래그를 확인해야 한다.

## ECharts 차트 생성·소멸

```js
import { loadECharts, createChart, disposeChart, CHART_PALETTE, CHART_COLORS, BASE_OPTION } from "../core/charts.js";

// 생성 (loadECharts() await 이후)
let chart = createChart(document.getElementById("my-chart"), option);

// 소멸 (unmount에서 반드시 호출)
disposeChart(chart); chart = null;
```

`createChart`는 내부적으로 ResizeObserver를 WeakMap에 연결하고, `disposeChart`는 observer까지 함께 정리한다.

**동적 innerHTML 섹션에 차트가 있을 때** (geo.js의 spotlight/comparison처럼 innerHTML이 교체되는 경우):
```js
// innerHTML 교체 전 기존 차트 소멸, 교체 후 재초기화
disposeChart(chartRadar); chartRadar = null;
container.innerHTML = newHtml;
if (window.echarts) { chartRadar = createChart(...); }
```

## CSS 아키텍처

`index.html`은 `styles.css` → `css/tokens.css` → `css/components.css` 순으로 로드한다. 페이지 전용 CSS(`css/pages/*.js`)는 각 페이지 모듈의 `injectCss()` 함수가 `<link>` 태그를 동적으로 주입하며, 이미 주입된 경우 건너뛴다.

`styles.css`는 2,900줄짜리 레거시 파일로, 아직 정리가 완료되지 않았다. 새 CSS는 반드시 `css/pages/` 또는 `css/components.css`에 작성한다.

## 전역 상태

`js/core/state.js`의 `state` 객체 하나를 모든 모듈이 import해서 읽고 쓴다. 별도 getter/setter 없음.

주요 상태 키.

| 키 | 용도 |
|---|---|
| `state.data` | mock-data.json 또는 백엔드 병합 데이터 |
| `state.industry` | 상권 페이지 선택 업종 |
| `state.geoDistrict` | 집계구 페이지 선택 행정동 |
| `state.populationDistrict` | 인구 페이지 선택 행정동 |
| `state.category` | 지도 페이지 마커 필터 카테고리 |
| `state.apiSources` / `state.apiLogs` | API 현황·로그 페이지 데이터 |
| `state.adminAuth` | 관리자 세션 (sessionStorage 기반) |

## 데이터 흐름

`main.js`의 `bootData()`가 앱 시작 시 한 번 실행된다.

1. `loadLocalData()` → `state.data = localData` → 홈 KPI 갱신
2. `loadApiSources()` + `loadApiLogsRaw()` 병렬 로드 → `state.apiSources`, `state.apiLogs`
3. `loadBackendData(localData)` → `:8080` 응답 있으면 병합, 없으면 로컬 유지 → `state.data` 재할당 → 홈·지도 갱신

## 라우트 목록

| 해시 | 모듈 | 외부 의존 |
|---|---|---|
| `#/home` | `pages/home.js` | ECharts (스파크라인) |
| `#/map` | `pages/map.js` | Leaflet, GeoJSON |
| `#/commercial` | `pages/commercial.js` | ECharts |
| `#/geo` | `pages/geo.js` | ECharts |
| `#/population` | `pages/population.js` | ECharts |
| `#/api` | `pages/api-status.js` | — |
| `#/api-logs` | `pages/api-logs.js` | — |
| `#/admin` | `pages/admin.js` | 백엔드 `:8080` (없으면 로컬 폴백) |

## mock-data.json 스키마

`assets/data/mock-data.json`의 주요 도메인.

- `metrics[]` — 홈 KPI 카드. `trend[]` (숫자 배열 6개) 포함.
- `commercial.<업종>.byDong[]` + `commercial.<업종>.trend[]` — 상권 행정동별·월별.
- `districts[]` — 집계구 분석용. `scores: { 생활, 교통, 안전 }`, `accessScores`, `radius`.
- `facilities[]` — 지도 마커. `category`, `latitude`, `longitude` 필수.
- `population[]` — 인구 분석. `areaName`, `total`, `male`, `female`, `byAge[]`.

`geumcheon-dong.geojson`은 금천구 3개 행정동(가산동·독산동·시흥동)의 위경도 폴리곤. `feature.properties.name`이 `districts[].name`과 매칭된다.

## 새 페이지 추가 절차

1. `js/pages/<name>.js` 생성 (첫 줄: 한국어 역할 주석)
2. `css/pages/<name>.css` 생성 + 페이지 모듈에서 `injectCss()`로 동적 주입
3. `js/main.js` — import + `routes` 객체에 등록
4. `index.html` — nav에 `<a href="#/<name>" data-route="<name>">` 추가
5. `js/pages/home.js`의 `buildTopicCards()` 배열에 진입 카드 추가
