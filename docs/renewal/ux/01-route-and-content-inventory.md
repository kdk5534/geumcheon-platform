# 라우트 및 콘텐츠 인벤토리

- 작성일: 2026-06-18
- 기준 문서: `docs/renewal/01-ui-ux-information-architecture-execution-plan.md`
- 기준 코드: `frontend-static/index.html`, `frontend-static/js/main.js`, `frontend-static/js/core/router.js`

## 1. 현재 공개 상단 메뉴

| 구분 | 공개 여부 | 현재 라벨 | 현재 링크 | 비고 |
| --- | --- | --- | --- | --- |
| 1 | 공개 | 오늘의 금천 | `#/home` | 기존 `상황판`에서 명칭 변경 |
| 2 | 공개 | 내 주변 | `#/nearby` | 내부적으로 `map` 모듈 사용 |
| 3 | 공개 | 우리 동 | `#/dong` | 내부적으로 `geo` 또는 `population` 모듈 사용 |
| 4 | 공개 | 분야별 | `#/topics` | 내부적으로 `indicators`, `commercial`, `realtime` 모듈 사용 |
| 5 | 공개 | 데이터 찾기 | `#/datasets` | 내부적으로 `catalog` 모듈 사용 |

## 2. 공개 메뉴에서 제거된 항목

| 기존 메뉴 | 기존 링크 | 현재 처리 |
| --- | --- | --- |
| 실시간 도시현황 | `#/realtime` | `분야별` 내부 진입 경로로 유지 |
| 분야별 지표 | `#/indicators` | `분야별` 내부 진입 경로로 유지 |
| 생활지도 | `#/map` | `내 주변` 별칭으로 유지 |
| 상권분석 | `#/commercial` | `분야별` 내부 진입 경로로 유지 |
| 이용안내 | `#/about` | 상단 메뉴 제거, 푸터 링크 유지 |
| API 상태 | `#/api` | 공개 메뉴 제거 |
| API 로그 | `#/api-logs` | 공개 메뉴 제거 |
| 관리자 | `#/admin` | 공개 메뉴/푸터 노출 제거 |

## 3. 현재 모듈 대응

| 해시 경로 | 실제 마운트 모듈 | 상태 파라미터 |
| --- | --- | --- |
| `#/home`, `#/today` | `home` | 없음 |
| `#/nearby`, `#/map` | `map` | `category` |
| `#/dong` | `dong` 허브 | 없음 |
| `#/dong?section=population` | `population` | `district` |
| `#/dong?district=...` | `dong` 허브 | `district` |
| `#/dong?section=accessibility` | `geo` | `metric`, `district` |
| `#/geo` | `geo` | `metric`, `district` |
| `#/population` | `population` | `district` |
| `#/topics` | `topics` 허브 | 없음 |
| `#/topics?topic=economy` | `commercial` | `industry` |
| `#/topics?topic=safety` | `realtime` | 없음 |
| `#/indicators` | `indicators` | 없음 |
| `#/commercial` | `commercial` | `industry` |
| `#/realtime` | `realtime` | 없음 |
| `#/datasets`, `#/catalog` | `catalog` | 없음 |
| `#/about` | `about` | 없음 |
| `#/api`, `#/api-logs`, `#/admin` | 기존 운영 모듈 | 없음 |

## 4. 이번 턴 반영 사항

- 공개 상단 메뉴를 10개에서 5개로 축소했다.
- `#/nearby`, `#/dong`, `#/topics`, `#/datasets` 목표 경로를 수용하는 라우팅 호환층을 추가했다.
- `#/dong`과 `#/topics`에 허브 화면을 추가해 새 정보구조 진입점이 실제 화면으로 보이게 했다.
- `#/map`, `#/population`, `#/geo`, `#/realtime`, `#/indicators`, `#/commercial`, `#/catalog` 기존 링크는 그대로 열리도록 유지했다.
- 라우트 진입 시 `category`, `metric`, `district`, `industry` 상태를 URL 파라미터에서 복원하도록 반영했다.
- 푸터의 관리자 직접 링크를 제거하고 `이용안내` 링크로 교체했다.

## 5. 남은 후속 작업

- 홈 화면과 각 카드/바로가기에서 사용하는 기존 링크를 목표 경로 체계로 통일한다.
- `분야별` 허브와 `우리 동` 허브를 실제 요약 데이터 중심 화면으로 고도화한다.
- 공개 라우트와 운영 라우트를 앱 진입점 또는 셸 수준에서 완전히 분리한다.
