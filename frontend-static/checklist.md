# 금천 데이터플랫폼 프론트엔드 개편 체크리스트

## 0단계 — 기반 (디자인 시스템 + 모듈 골격)

- [x] checklist.md / context-notes.md 생성
- [x] `css/tokens.css` — 새 공간·반경·타이포 토큰 추가
- [x] `css/components.css` — 공통 컴포넌트 클래스 (topic-card, page-header 등)
- [x] `css/pages/home.css` — 홈 대시보드 전용 스타일
- [x] `js/core/state.js` — 전역 state 객체 + 상수
- [x] `js/core/dom.js` — 순수 유틸 (escapeHtml, formatBytes, clamp01, formatMockTimestamp, formatAdminAuthSavedAt)
- [x] `js/core/meta.js` — 출처·기준시각 유틸 (getSectionMeta, renderDataStamp, sourceModeText)
- [x] `js/core/api.js` — API 호출 (fetchWithTimeout, loadLocalData, loadApiSources, loadApiLogs, loadBackendData, withBackendMetric)
- [x] `js/core/router.js` — 해시 라우터
- [x] `js/pages/home.js` — 홈 대시보드 (히어로 + KPI + 주제 진입 카드)
- [x] `js/pages/stub.js` — 미구현 페이지 placeholder
- [x] `js/main.js` — 앱 진입점
- [x] `index.html` — 셸로 교체 (topbar + nav + `<main id="view">`)
- [x] 검증: `node serve-static.mjs` → 홈 라우트 정상 표시 확인 (HTTP 200)

## 1단계 — 공유 셀렉터 추출 (`js/core/selectors.js`)

- [x] `currentGeoDistrict()`, `currentCommercialIndustryData()`, `getIndustryDistrictSnapshot()`, `defaultGeoRecommendation()` 추출
- [x] 검증: HTTP 200 + export 4개 확인

## 2단계 — 생활지도 Leaflet (`js/pages/map.js` / `css/pages/map.css`)

- [x] Leaflet CSS/JS CDN 동적 로드 (map.js 내 loadLeaflet())
- [x] `js/pages/map.js` — mount/unmount/refresh 구현 (Leaflet 초기화, 마커, 필터, 목록)
- [x] `css/pages/map.css` — 지도 레이아웃 + 필터바 + 목록 패널 스타일
- [x] `js/main.js` — map stub → map 모듈 교체 + refreshMapIfVisible() 추가
- [x] async mount guard (isMounted), Leaflet 중복 로드 방지
- [ ] 검증(브라우저): `#/map` 타일 로드, 마커 표시, 카테고리 필터, 목록 클릭

## 3단계 — 상권분석 (`js/pages/commercial.js` / `css/pages/commercial.css`)

- [x] `js/pages/commercial.js` — mount/unmount, 업종 필터, KPI 카드 3개, 막대차트
- [x] `css/pages/commercial.css` — 필터바, KPI 카드, 막대차트 스타일
- [x] `js/main.js` — commercial stub → commercial 모듈 교체
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/commercial` 업종 필터 전환 시 KPI·차트 갱신

## 4단계 — 집계구 분석 (`js/pages/geo.js` / `css/pages/geo.css`)

- [x] `js/pages/geo.js` — mount/unmount, 권역 선택, 지표 전환, 비교 분석, 접근성, 키보드 네비게이션
- [x] `css/pages/geo.css` — 2컬럼 레이아웃, 요약 KPI, spotlight, 반경 분석, 비교 그리드
- [x] `js/main.js` — geo stub → geo 모듈 교체
- [x] `renderMapBoundary()` 교차 호출 제거 (geo.js가 map 화면을 건드리지 않음)
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/geo` 권역 선택·비교 기준 전환·키보드 네비게이션

## 5단계 — API 상태/로그 (`js/pages/api-status.js`, `api-logs.js` / `css/pages/api.css`)

- [x] `js/pages/api-status.js` — mount/unmount, 상태 요약, 필터, 소스 카드
- [x] `js/pages/api-logs.js` — mount/unmount, 로그 카드, 필터, 검색, 재수집 mock
- [x] `css/pages/api.css` — 두 페이지 공유 스타일
- [x] `js/main.js` — api/api-logs stub → 각 모듈 교체
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/api` 필터, `#/api-logs` 필터·검색·재수집 동작

## 6단계 — 관리자 (`js/pages/admin.js` / `css/pages/admin.css`)

- [x] `js/pages/admin.js` — 인증 폼/세션, 데이터셋 목록·편집, CSV/Excel 업로드·매핑·검증·커밋 (단일 모듈 ~600줄)
- [x] `css/pages/admin.css` — 인증 패널, 데이터셋 2컬럼 그리드, 업로드 패널 스타일
- [x] `js/main.js` — admin stub → admin 모듈 교체
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/admin` 로그인 → 데이터셋 편집 → CSV 미리보기 → 커밋 (백엔드 mock `:8080` 필요)

## 7단계 — 최종 정리 (시각화 고도화 이전)

- [x] 전체 신규 파일 HTTP 200 통합 확인 (13개 파일)
- [x] `checklist.md` / `context-notes.md` 최종 갱신
- [x] 메모리 파일 갱신
- [x] `app.js` 삭제

## 시각화 고도화 — ECharts 도입

### 1단계 — ECharts 인프라 + 데이터 스키마 확장
- [x] `js/core/charts.js` — loadECharts, createChart, disposeChart, CHART_PALETTE
- [x] `mock-data.json` — 업종별 12개월 trend 추가, population 도메인(연령대별) 추가, metrics trend 추가
- [x] 검증: HTTP 200 + 스키마 파싱 확인

### 2단계 — 상권분석 ECharts 차트화
- [x] `js/pages/commercial.js` — ECharts 가로 막대 + 도넛 + 라인 차트 (async mount, unmount dispose)
- [x] `css/pages/commercial.css` — charts-grid 2컬럼 + ECharts 컨테이너 높이
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/commercial` 업종 전환 → 막대·도넛·라인 동시 갱신

### 3단계 — 집계구 분석 ECharts 차트화
- [x] `js/pages/geo.js` — 레이더 차트(권역 vs 평균) + 그룹 막대(비교) + 가로 막대(접근성)
- [x] `css/pages/geo.css` — ECharts 컨테이너 높이 추가
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/geo` 권역 선택·지표 전환 → 레이더·비교 차트 갱신

### 4단계 — 지도 단계구분도(choropleth)
- [x] `assets/data/geumcheon-dong.geojson` — 금천구 3개 동 경계 GeoJSON
- [x] `js/pages/map.js` — L.geoJSON choropleth, 지표 토글, 범례, hover/click
- [x] `css/pages/map.css` — toolbar, choropleth 버튼, 범례, 툴팁 스타일
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/map` 행정동 색칠, 지표 토글, 범례, 마커 공존

### 5단계 — 인구 분석 신규 페이지
- [x] `js/pages/population.js` — 인구 피라미드 + 행정동별 막대 + KPI
- [x] `css/pages/population.css`
- [x] `index.html` nav — 인구분석 링크 추가
- [x] `js/main.js` — population 라우트 등록
- [x] `js/pages/home.js` — 인구 분석 진입 카드 추가
- [x] `js/core/state.js` — `populationDistrict` 상태 추가
- [x] 검증: HTTP 200
- [ ] 검증(브라우저): `#/population` 피라미드·막대 렌더, 행정동 전환

### 6단계 — 홈 스파크라인
- [x] `js/pages/home.js` — async mount, renderSparklines(), refreshSparklines() export, disposeSparklines() on unmount
- [x] `css/pages/home.css` — .metric-sparkline { height: 40px }
- [x] `js/main.js` — refreshHomeIfVisible()에서 refreshSparklines() 호출
- [x] 검증: HTTP 200 (home.js, home.css, main.js)
- [ ] 검증(브라우저): `#/home` KPI 카드에 스파크라인 렌더

### 7단계 — 정리 및 통합 검증
- [x] `styles.css` 잔여 블록 정리 (2,960줄 → 1,911줄, 1,049줄 제거)
  - 삭제: `.overview`, `.portal-grid`, `.workbench`, `.segmented`, `.segment`
  - 삭제: SVG 지도 클래스 (`.boundary-*`, `.district-map`, `.river`, `.dong`, `.marker`)
  - 삭제: 구 `.map-layout`, `.map-panel`, `.map-toolbar`, `.map-layer-row`, `.map-boundary-*`
  - 삭제: `.insight-rail`, `.rail-panel`, `.source-list`, `.split-section`
  - 삭제: 구 API 레이아웃 (`.api-status-workflow`, `.api-summary`, `.api-source-grid`, `.api-log-workflow`, `.api-log-grid` 등)
  - 삭제: `.analysis-panel`, `.stat-stack`, `.mini-stat`, `.bar-chart` 등
  - 삭제: 구 Admin (`.admin-strip`, `.admin-workflow`, `.admin-auth-panel`, `.admin-auth-field` 등)
  - 반응형 미디어 쿼리 삭제된 클래스 참조 정리
- [x] 24개 JS/CSS 파일 HTTP 200 일괄 확인
- [x] `CLAUDE.md` 생성 (아키텍처 가이드)
- [ ] 브라우저 전체 라우트 통합 점검 (8개 라우트) — 수동 필요
- [ ] ECharts 인스턴스 누수 없음 확인 (페이지 전환 반복) — 수동 필요
