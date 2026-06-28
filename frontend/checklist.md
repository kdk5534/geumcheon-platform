# 프론트엔드 전면 비주얼 리뉴얼 체크리스트

브랜치: `feat/visual-renewal`
목표: 공공기관 정제형 비주얼 리뉴얼 + 디자인 시스템 토대 구축

## Phase 0 — 안전망

- [ ] `feat/visual-renewal` 브랜치 생성
- [ ] 현재 기능 E2E 그린 확인 (`npm run test:e2e`)
- [ ] 시각회귀 baseline 스냅샷 위치 확인 (`tests/e2e/*-snapshots/`)

## Phase 1 — 토큰 토대 (`src/styles/tokens.css`)

- [ ] spacing 토큰 (`--gdp-space-1` ~ `--gdp-space-12`) 추가
- [ ] typography 토큰 (`--gdp-text-xs` ~ `--gdp-text-4xl`, line-height, weight, letter-spacing) 추가
- [ ] radius 확장 (`--gdp-radius-xs/sm/md/lg/pill`) 추가
- [ ] elevation 5단계 (`--gdp-elev-0` ~ `--gdp-elev-4`) 추가
- [ ] motion 토큰 (`--gdp-ease-standard`, `--gdp-dur-1` ~ `--gdp-dur-4`) 추가
- [ ] z-index 토큰 (`--gdp-z-header/overlay/modal/toast`) 추가
- [ ] chart 시리즈 색 토큰 (`--gdp-series-1..6`, `--gdp-axis-line/label`, `--gdp-grid-line`) 추가
- [ ] 중립 회색 스케일 (`--gdp-gray-50` ~ `--gdp-gray-900`) 추가
- [ ] 액션 시맨틱 토큰 (`--gdp-action`, `--gdp-action-hover`) 추가
- [ ] 다크 오버라이드 병행 작성
- [ ] 기존 `--gdp-*` 변수 alias 유지 확인 (218 셀렉터 무수정)
- [ ] `npm run typecheck` 통과

## Phase 2 — 공통 컴포넌트 레이어 (`src/components/ui/`)

- [ ] 디렉터리 구조 생성 (`src/components/ui/`)
- [ ] Button 컴포넌트 (`Button/index.tsx` + `Button.css`)
- [ ] Card/Panel 컴포넌트
- [ ] Stat/KPICard 컴포넌트
- [ ] Badge/StatusBadge 컴포넌트 (기존 `gdp-status-badge--*` 클래스 유지)
- [ ] SegmentedControl 컴포넌트 (`role=radiogroup`)
- [ ] 배럴 `src/components/ui/index.ts`
- [ ] `npm run typecheck` 통과

## Phase 3 — 셸 리뉴얼 (`src/shell/AppShell.tsx` + 관련 CSS)

- [ ] 유틸바 리뉴얼 (여백·타이포 토큰화)
- [ ] 헤더 리뉴얼 (브랜드·내비·액션 영역)
- [ ] 펄스바 리뉴얼
- [ ] 데이터상태배너 리뉴얼
- [ ] 섹션서브내비 리뉴얼
- [ ] 푸터 리뉴얼
- [ ] 클래스명·aria 보존 확인
- [ ] 기능 E2E 그린 확인
- [ ] `GDP_BASE_PATH` 빌드 검증

## Phase 4 — CSS 분할 + px→토큰 치환

- [ ] app.css → 파일별 분리 (base/shell/map/health/pages/*)
- [ ] 분할 커밋 시각회귀 diff 0 확인
- [ ] px → spacing/typography 토큰 치환 (별도 커밋)
- [ ] breakpoint 640/900/1200으로 통일 (별도 커밋)
- [ ] `prefers-reduced-motion`/`contrast` 대응 추가
- [ ] 기능 E2E 그린 확인

## Phase 5 — 차트/지도 색상 토큰 연동

- [ ] `src/data/themeTokens.ts` 생성 (`readTokens()`)
- [ ] `AppShell` theme state → Context 승격
- [ ] `LinkedChart.tsx` 하드코딩 hex → 토큰 치환
- [ ] `GeoPage.tsx` 하드코딩 hex → 토큰 치환
- [ ] `VworldMap.tsx` divIcon 색 → 토큰 치환 (도형 기호 보존)
- [ ] 테마 전환 시 차트 재렌더 확인

## Phase 6 — 페이지 순차 리뉴얼 + 스냅샷 확정

- [ ] home(OverviewPage) 리뉴얼 + 방향 확인
- [ ] 주제분석 4개 (ThematicAnalysisPage) 리뉴얼
- [ ] realtime, indicators, facilities, district, topics 리뉴얼
- [ ] geo, catalog, about, api-status, api-logs 리뉴얼
- [ ] admin 앱 (admin.css) 리뉴얼
- [ ] `npx playwright test visual --update-snapshots` 최종 스냅샷 확정
- [ ] baseline 육안 비교
- [ ] 전 페이지 axe-core 접근성 E2E 통과
