# React/Vite 대시보드 PoC 전환 계획

작성일: 2026-06-24

## 결정

전체 프론트엔드를 즉시 React로 갈아엎지 않는다. 현재 정적 프론트의 지도, 라우팅, 데이터 상태, 접근성 회귀를 안정화하면서 `종합 현황` 1개 화면만 React/Vite PoC로 병행 구현한다.

PoC는 “React가 더 나은가”를 감으로 판단하지 않고 다음 기준으로 비교한다.

- 화면 완성도: 카드, 지도, 필터, 차트, 드로어, 빈 상태가 일관된가
- 상태 안정성: 주제, 행정동, 지도/목록 모드, 언어, 테마가 예측 가능하게 동작하는가
- 포털 탑재성: hash routing, base path, CSS 격리, self-hosted asset 조건을 만족하는가
- 접근성: axe 중대/심각 오류 0건, 키보드 조작, 200% 확대, 색상 외 상태 표현을 만족하는가
- 성능: 1440px와 390px에서 초기 렌더링과 라우트 전환이 느리지 않은가
- 유지보수성: 컴포넌트와 데이터 모델이 페이지별 문자열 조립보다 명확한가

## PoC 대상

대상 화면은 `종합 현황`이다.

선정 이유:

- 지도, KPI, 주제 필터, 행정동 선택, 차트, 데이터 상태, 공유/CSV/PDF 액션이 모두 들어 있어 대시보드 복잡도를 대표한다.
- 현재 사용자가 가장 먼저 보는 화면이다.
- React 전환 효과가 가장 크게 드러난다.

## 하지 않는 것

PoC 단계에서는 다음을 하지 않는다.

- 전체 공개 화면 전환
- 관리자 콘솔 전환
- Next.js, SSR, Server Components 도입
- BrowserRouter 도입
- 포털 서버 rewrite 전제
- 운영 데이터 모델 변경
- VWorld API key의 브라우저 노출

## 권장 기술 조합

```text
React
Vite
TypeScript
HashRouter
ECharts
Leaflet + VWorld backend proxy
CSS Modules 또는 .gdp-app namespace CSS
```

초기 PoC는 상태관리 라이브러리를 추가하지 않는다. React 기본 상태와 작은 reducer로 충분한지 확인한다. Zustand, TanStack Query 같은 도구는 PoC 후 복잡도가 명확할 때만 검토한다.

## 포털 탑재 원칙

React 앱은 포털 전체를 소유하지 않는다. 앱 루트 내부만 제어한다.

```html
<div id="geumcheon-data-platform-root"></div>
```

필수 원칙:

- URL은 `#/home`, `#/population` 같은 hash routing을 유지한다.
- Vite `base`는 실제 탑재 경로에 맞춘다.
- CSS는 `.gdp-app` 아래로 제한하거나 CSS Modules를 사용한다.
- Leaflet, ECharts, 폰트, 아이콘은 운영 전 self-hosted 또는 bundle 포함을 원칙으로 한다.
- 포털 헤더, 검색, 메뉴, 다국어, 본문 바로가기와 충돌하지 않는다.

## 컴포넌트 경계

`종합 현황` PoC는 다음 컴포넌트로 나눈다.

```text
AppShell
  DashboardHeader
  DataHealthBar
  SectionTabs
  OverviewPage
    OverviewBriefStrip
    TopicSelector
    DistrictSelector
    OverviewMapPanel
      VworldMap
      MapFallbackList
    OverviewAnalysisPanel
      MiniMetricGrid
      LinkedChart
      ActiveFilterChips
    KpiGrid
    ProvenancePanel
    ConnectedInsights
```

## 상태 모델

전역 상태:

- language
- theme
- district

페이지 상태:

- topic
- mapMode
- activeFacility
- selectedChartItem
- visibleLayer

서버/데이터 상태:

- apiMeta
- population
- facilities
- stores
- airQuality
- datasetStatuses

URL 직렬화:

```text
#/home?topic=population&district=가산동&map=list
```

## 데이터 어댑터

React 컴포넌트가 기존 API 응답 형태에 직접 묶이지 않도록 `adapters` 계층을 둔다.

```text
src/data/publicApi.ts
src/data/overviewAdapter.ts
```

역할:

- API 호출
- 빈 값/지연/오류 상태 정규화
- 화면이 쓰는 `OverviewModel`로 변환
- 출처, 기준일, 마지막 정상값, 경고를 함께 제공

## 기존 정적 화면과 비교 기준

PoC가 통과하려면 기존 정적 화면보다 최소한 다음이 좋아야 한다.

| 항목 | 통과 기준 |
| --- | --- |
| 시각 품질 | 1440px 첫 화면이 지도 60%, 분석 40% 구조로 안정적이고 카드 밀도가 균형 있음 |
| 지도 | VWorld 타일 정상, 실패 시 목록 전환, 행정동 경계 표시 |
| 필터 | 주제/행정동/지도 모드가 URL과 UI에 동시에 반영 |
| 차트 | 지도/차트/표가 같은 필터 맥락을 공유 |
| 접근성 | axe 중대/심각 오류 0건 |
| 모바일 | 390px에서 문서 overflow 없음 |
| 포털 탑재 | 하위 경로 base build와 hash routing 통과 |

## 작업 순서

1. 현재 정적 앱 안정화 유지
2. `frontend-react-poc` 별도 디렉터리 생성
3. Vite/React/TypeScript 기본 구조 작성
4. 기존 `종합 현황` 데이터 어댑터를 React PoC로 연결
5. 지도와 fallback 목록을 먼저 구현
6. KPI/필터/차트/출처 패널 구현
7. 기존 정적 화면과 스크린샷·테스트 비교
8. 통과 시 나머지 공개 화면 이전 여부 결정

## 판단 지점

다음 중 하나라도 충족하지 못하면 전체 React 전환을 보류한다.

- 포털 하위 경로에서 빌드 산출물 경로가 깨진다.
- HashRouter로 요구 URL을 처리하지 못한다.
- CSS 충돌을 격리하지 못한다.
- VWorld/차트 번들 크기가 성능 기준을 크게 넘는다.
- 접근성 회귀가 정적 화면보다 나쁘다.
- 개발 생산성이 예상보다 낮고 컴포넌트 경계가 오히려 복잡해진다.

반대로 위 조건을 통과하면 React/Vite로 단계적 전환한다.
