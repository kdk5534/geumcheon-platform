# 목표 사이트맵 및 URL 전환

- 작성일: 2026-06-18
- 상태: 1차 구현 반영 완료

## 1. 목표 공개 사이트맵

| 깊이 | 메뉴 | 사용자 질문 | 목표 URL | 현재 1차 구현 |
| --- | --- | --- | --- | --- |
| 1 | 오늘의 금천 | 지금 확인해야 할 변화는 무엇인가 | `/today` | `#/home` |
| 1 | 내 주변 | 내 주변에서 바로 이용 가능한 시설은 무엇인가 | `/nearby` | `#/nearby` |
| 1 | 우리 동 | 우리 동은 다른 동과 어떻게 다른가 | `/dong` | `#/dong` 허브 |
| 1 | 분야별 | 안전, 경제, 복지, 교통 데이터를 한 번에 보고 싶은가 | `/topics/:topic` | `#/topics` 허브 |
| 1 | 데이터 찾기 | 원본 데이터와 출처를 찾고 싶은가 | `/datasets` | `#/datasets` |

## 2. 레거시 URL 전환 규칙

| 기존 URL | 현재 동작 | 목표 방향 |
| --- | --- | --- |
| `#/home` | 유지 | 이후 `/today` 대응 |
| `#/map` | `#/nearby`와 동일 처리 | 이후 `/nearby`로 수렴 |
| `#/population` | 유지 | `#/dong?section=population`로 수렴 |
| `#/geo` | 유지 | `#/dong?section=accessibility&district=...`로 수렴 |
| `#/realtime` | 유지 | `#/topics?topic=safety`로 수렴 |
| `#/indicators` | 유지 | `#/topics`로 수렴 |
| `#/commercial` | 유지 | `#/topics?topic=economy`로 수렴 |
| `#/catalog` | 유지 | `#/datasets`로 수렴 |
| `#/about` | 유지 | 상단 메뉴 밖 보조 경로 유지 |
| `#/api` | 유지하되 비노출 | 운영 경로로 별도 분리 예정 |
| `#/api-logs` | 유지하되 비노출 | 운영 경로로 별도 분리 예정 |
| `#/admin` | 유지하되 비노출 | 운영 경로로 별도 분리 예정 |

## 3. 파라미터 규칙

| 화면 | 파라미터 | 목적 |
| --- | --- | --- |
| `#/nearby` | `category` | 시설 카테고리 필터 복원 |
| `#/dong` | `district` | 허브에서 선택한 동과 구 평균 비교 복원 |
| `#/dong?section=accessibility` | `metric`, `district` | 생활권 세부 비교 기준과 선택 동 복원 |
| `#/dong?section=population` | `district` | 인구 화면의 선택 동 복원 |
| `#/topics?topic=economy` | `industry` | 상권 업종 복원 |

## 4. 다음 구현 순서

1. 실제 참여자 과업 테스트와 첫 클릭 테스트
2. 브라우저 실제 200% 확대·키보드·스크린리더 수동 검사
3. 공개/운영 별도 실행 경계를 02 단계에서 구현
4. 해시 기반 임시 경로를 최종 URL 체계로 치환할 준비
