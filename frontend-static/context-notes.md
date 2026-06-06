# 개편 작업 컨텍스트 노트

## 2026-06-06 — 0단계 시작

### 기술 방향 결정
- **바닐라 JS + 네이티브 ES Module** 유지. 빌드 도구 없음.
- `serve-static.mjs`가 `.js`를 `text/javascript`로 서빙하므로 `<script type="module">` + 상대경로 import가 빌드 없이 동작한다.
- CSS는 빌드 없이 `<link>` 다중 로드. `index.html`에서 공통 CSS를 모두 로드하고, 페이지별 CSS는 라우터가 `<link>`를 동적으로 주입한다.

### 화면 구조 결정
- **홈 대시보드 + 해시 라우팅 페이지 전환** 구조.
- 라우트: `#/home`, `#/map`, `#/commercial`, `#/geo`, `#/api`, `#/admin`
- 각 페이지 모듈은 `mount(container)` / `unmount()` 인터페이스.
- 해시 없이 접근하면 `#/home`으로 리다이렉트.

### CSS 아키텍처 결정
- `styles.css`는 **그대로 유지**. 건드리지 않는다.
- 새 CSS 파일(`css/tokens.css`, `css/components.css`, `css/pages/home.css` 등)을 `styles.css` 뒤에 로드해 위에 덧씌운다.
- 각 페이지 단계가 완료된 후에야 styles.css의 해당 블록을 페이지 CSS로 이전하고 styles.css에서 제거한다.
- **이유**: 한 번에 바꾸면 CSS 추적이 어렵고, 단계별로 이전하면 어떤 CSS가 아직 옛날 파일에 있는지 명확하다.

### JS 모듈 분리 전략
- `state.js` — 상태 객체 + 앱 전역 상수만 담는다. 렌더 함수 없음.
- `dom.js` — 순수 함수만. DOM 없음, 상태 없음, 사이드이펙트 없음.
- `meta.js` — `state.data?.meta`를 읽는 함수. 상태를 읽되 수정하지 않는다.
- `api.js` — fetch 계열. 상태를 수정하지 않고 데이터를 반환한다. main.js에서 결과를 state에 쓴다.
- `router.js` — `hashchange` 이벤트를 듣고 페이지 모듈의 `mount/unmount`를 호출한다. 현재 active 라우트 CSS도 관리한다.
- 각 페이지 모듈 — HTML 템플릿 + 렌더 함수 + 이벤트 핸들러를 한 파일에 담는다.

### 홈 페이지 디자인 결정
- 강남/서초 톤: 상단 풀컬럼 히어로 배너 + 하단 KPI 그리드 + 주제 진입 카드 그리드.
- 히어로: 기존 `.overview` 스타일(녹색-파랑 그라디언트)을 기반으로 더 넓고 높게 디자인.
- KPI 카드: 기존 `.metric-card`를 재사용 (styles.css의 `.metric-card` 스타일 유지).
- 주제 진입 카드 6개: 생활지도/상권분석/집계구/API상태/API로그/관리자.
  - 각 카드에 아이콘 영역, 제목, 설명, "바로가기" 링크.
  - 카드 클릭 시 해당 해시 라우트로 이동.

### 0단계 stub 페이지 결정
- `#/map`, `#/commercial` 등 미구현 페이지는 "준비 중" 카드를 보여주는 `stub.js` 모듈을 공유한다.
- 이유: 0단계 검증 기준이 "홈 라우트 하나만 떠도 통과"이므로, 다른 페이지를 완전히 구현하지 않아도 내비게이션이 동작하면 충분하다.

### 주의사항
- `state.adminAuth = readStoredAdminAuth()` — state.js가 로드될 때 자동으로 sessionStorage를 읽는다. readStoredAdminAuth는 dom.js가 아닌 state.js 내부에 정의한다.
- `datasetFieldSchemas`, `fieldAliases` — 업로드 관련 상수이므로 admin 모듈로 이전 예정. 0단계에서는 state.js에 포함.
- `categoryInitial`, `categoryColor` — map 모듈로 이전 예정. 0단계에서는 state.js에 포함.

---

## 2026-06-06/07 — 1~7단계 진행

### 1단계: selectors.js 설계 결정
- `currentGeoDistrict`, `currentCommercialIndustryData`, `getIndustryDistrictSnapshot`, `defaultGeoRecommendation` 4개를 `js/core/selectors.js`로 추출.
- 모두 `state`만 읽는 순수 셀렉터. 상태를 변경하지 않으므로 여러 페이지가 안전하게 import 가능.

### 2단계: Leaflet 동적 로드 결정
- CDN Leaflet을 `index.html`에 미리 넣지 않고, map.js의 `loadLeaflet()`이 최초 마운트 시에만 동적 삽입.
- **이유**: 지도 미방문 시 불필요한 리소스 로드 방지(약 150KB).
- 중복 로드 방지: `document.getElementById("leaflet-js")` 존재 여부로 판단. 이미 있으면 해당 스크립트의 `load` 이벤트를 리슨.
- `isMounted` 플래그로 비동기 Leaflet 로드 중 페이지 전환 시 race condition 방지.
- 경계 폴리곤(`renderMapBoundary`) 미이식: `boundaries[]`가 SVG path 좌표계라 Leaflet GeoJSON과 호환 안 됨. 별도 GeoJSON 확보 전까지 보류.

### 3단계: 상권 페이지 교차 렌더 제거
- 기존 app.js에서 업종 변경 시 상권+집계구+지도를 동시에 다시 그렸음.
- commercial.js에서는 `state.industry`만 갱신하고 상권 화면만 재렌더. geo/map 화면은 다음 마운트 시 현재 state를 반영하는 방식으로 분리.

### 4단계: geo.js 핵심 설계 결정
- `renderGeoDistricts()` 끝의 `renderMapBoundary()` 호출 제거. geo 페이지는 지도 화면을 건드리지 않는다.
- `CSS.escape(districtName)` 사용: 행정동명에 괄호 등 특수문자가 있을 때 querySelector가 실패하지 않도록.
- 키보드 네비게이션: Arrow Up/Down, Home/End로 권역 카드 이동. `aria-pressed` 동기화.

### 5단계: API 페이지 설계 결정
- api-status.js와 api-logs.js가 같은 CSS 파일(`css/pages/api.css`)을 공유. 두 모듈 모두 `id="css-page-api"` 로 중복 주입 방지.
- 재수집 mock: localStorage에 상태 변경을 저장해 페이지 재진입 시에도 유지.

### 6단계: admin.js 단일 모듈 결정
- 계획에서는 admin/{auth,datasets,upload}.js 3개로 분리 예정이었으나, 세 영역이 state를 공유하고(auth 헤더를 upload가 사용, datasets 편집 결과를 upload가 참조) 단순 함수 간 의존이 많아 파일 분리 시 순환 참조 또는 과도한 prop drilling 발생.
- **결정**: 단일 `admin.js` (~600줄)에 내부 함수로 구성. 파일 길이가 길더라도 모듈 경계가 명확한 단일 파일이 낫다.
- CSV 파서(`parseCsv`): RFC 4180 준수, UTF-8/EUC-KR 자동 감지(`readCsvText`).
- 백엔드 프리뷰(`previewCsvOnBackend`): `:8080` 타임아웃 실패 시 로컬 파서로 폴백.

### 공통: app.js 보존 결정
- `app.js`(3352줄)는 index.html에서 이미 로드되지 않으며, 새 모듈들이 모든 기능을 대체했음.
- 파일 자체는 아직 삭제하지 않음. 참조용으로 보존 중. 최종 정리 단계에서 삭제 예정.

### 데이터 구조 한계 (향후 작업 시 참고)
- `state.data.districts[]`: 중심 좌표 없음. Leaflet 마커 위치로 활용 불가.
- `state.data.boundaries[]`: SVG `d` path 좌표계. Leaflet GeoJSON 폴리곤으로 직접 변환 불가.
- 해결 방안: 향후 행정동 GeoJSON 파일 별도 확보 후 Leaflet `geoJSON()` 레이어로 추가 예정.
