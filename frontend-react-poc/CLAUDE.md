# CLAUDE.md — frontend-react-poc

종합 현황 1화면을 React+Vite+TypeScript로 병행 구현한 비교·검증용 PoC.

## 목적과 위치

`frontend-static`(Vanilla JS 정본)을 대체하지 **않는다**. 품질·성능·접근성·포털 탑재성을 비교·검증하는 병행 구현이다. 포털 하위경로 배치를 전제로 전체 CSS에 `gdp-` 접두사 네임스페이스를 사용한다.

## 실행·빌드·테스트

```powershell
# 개발 서버 (http://127.0.0.1:3100)
cd frontend-react-poc
npm run dev

# 타입 검사
npm run typecheck

# 프로덕션 빌드 (기본 상대 경로)
npm run build

# 포털 하위경로 빌드 검증
$env:GDP_BASE_PATH = "/data-platform/"
npm run build
npm run preview          # http://127.0.0.1:4174

# E2E 테스트 (Playwright)
npm run test:e2e
```

> **주의.** Playwright를 자체 설치하지 않고 `../frontend-static/node_modules`를 빌려 쓴다. E2E 실행 전 `cd ../frontend-static && npm install`이 선행되어야 한다.

> **주의.** lint 스크립트와 Vitest 단위 테스트가 없다. 타입 검사는 `npm run typecheck`(`tsc -b`)로만 수행한다.

## 설정 파일

`vite.config.js`와 `vite.config.ts`가 동일 내용으로 중복 존재한다. 빌드·dev 실행에는 `package.json`이 명시한 **`vite.config.js`가 사용**된다. `vite.config.ts`는 `tsconfig.node.json`의 타입체크 전용이다.

핵심 Vite 설정:
- `base: process.env.GDP_BASE_PATH || "./"` — 포털 하위경로는 환경변수로 주입.
- dev 서버 미들웨어가 `/env-config.js`를 가로채 `window.__ENV__ = { BACKEND_API_BASE }` 주입.
- 정적 빌드/포털 배치에서는 `public/env-config.js`(`index.html`의 `<script>`)로 주입.

## 아키텍처 개요

### 라우터

`src/main.tsx` — `#`(HashRouter) + `React.lazy`/Suspense 코드 스플리팅. 모든 라우트는 `<AppShell>` 아래 중첩된다. 4개 주제 분석 페이지(`/population`, `/commercial`, `/welfare`, `/safety`)는 `ThematicAnalysisPage`를 props만 달리해 재사용한다.

### 셸 (`src/shell/`)

`AppShell.tsx` — 유틸바, 지표 펄스바, 헤더(내비·검색·언어 선택·테마 토글), 데이터 상태 배너, `<Outlet>`, 푸터, `CommandSearch`를 조립한다.

- **테마·언어**: localStorage(`gdp-theme`, `gdp-language`)에 저장. 지원 언어: `ko`, `en`, `ja`, `zh-CN`.
- **CommandSearch**: `Ctrl/Cmd+K`. 23개 정적 색인으로 즉시 검색하고 쿼리 2자 이상이면 백엔드 `/api/public/search?q=&lang=`(180ms 디바운스)로 보완. 원격 실패 시 정적 색인으로 폴백.

### 데이터 계층 (`src/data/`)

- `env.ts` — `window.__ENV__?.BACKEND_API_BASE`를 정규화해 `BACKEND_API_BASE` 상수 생성. `API_TIMEOUT_MS = 2500`.
- `publicApi.ts` — `loadPublicData()`가 population/facilities/stores/air-quality/api-sources를 `Promise.allSettled`로 병렬 호출. **3단계 폴백**: backend → `public/assets/data/mock-data.json`(로컬) → empty. 반환 번들에 `source: "backend"|"local"|"empty"` 포함.
- `overviewAdapter.ts` — 원시 데이터를 화면용 `OverviewModel`로 변환. 좌표 없는 시설은 행정동 키워드+해시 오프셋으로 추정 좌표 생성(`coordinateSource: "estimated"`).

### 지도 (`overview/components/VworldMap.tsx`)

타일(`/api/public/map/tiles/base/{z}/{y}/{x}`), 경계(`/api/public/boundaries?type=DONG`), 가용성(`/api/public/map/status`)을 **모두 백엔드 프록시를 통해** 요청한다. 백엔드 연결 불가 시 지도 대신 목록 폴백(`onUnavailable` 콜백)으로 전환한다.

### 차트 (`overview/components/LinkedChart.tsx`)

`echarts/core`에서 필요한 컴포넌트만 `echarts.use()`로 트리셰이킹 등록. 차트 클릭이 부모 필터와 양방향 연동(차트↔필터 linked).

## frontend-static과의 관계

| 항목 | 공유 여부 |
|------|-----------|
| 백엔드 포트 `:8080` | 공유 |
| `ApiResponse<T>` 계약 (`success`, `data[]`) | 공유 |
| 백엔드 API 엔드포인트 경로 | 공유 |
| 로컬 Mock fixture (`assets/data/mock-data.json`) | **각자 독립** (데이터 구조 다름) |
| Playwright node_modules | `../frontend-static/node_modules` 빌려 씀 |

## 기타 주의사항

- `tmp-*.png` 스크린샷 파일 다수가 git에 추적되고 있다(정리 대상).
- Node `>=22 <23` — `frontend-static`과 동일한 버전 정책.
