# 분석 근거와 재현 메모

- 생성 기준시각: 2026-06-20 07:20 KST
- 분석 대상: 로컬 PostgreSQL DB 모드 백엔드와 현재 저장소 코드·운영 문서
- 전달 형식: 제품·운영 의사결정자를 위한 단일 HTML 보고서
- 차트 맵:
  - `collection_outcomes.png`: 데이터셋별 수집 성공·실패·정책 중단 누적 실행 횟수 비교
  - `address_scope.png`: 상가·기존 주차장 저장 행의 금천구/기타 주소 구성비 비교

## 주요 SQL 정의

- 최신 상태: `dataset_collection_log`를 데이터셋별 `started_at DESC`로 정렬한 첫 행
- 최종 성공 스냅샷: `status='SUCCESS'` 중 데이터셋별 최신 `finished_at`
- 수집 실행 결과: 데이터셋별 전체 로그의 `SUCCESS`, `FAILED`, `SKIPPED` 건수
- 주소 범위: `COALESCE(address_road,address_jibun,'')`에 `금천구`가 포함되는지 여부
- 시설 식별자: `COUNT(DISTINCT NULLIF(source_original_id,''))`

## 제어 근거

- DB 집계: `dataset`, `dataset_collection_log`, `facility`, `store_business`
- 코드: `DatasetRegistry.java`, `DatasetPolicyRegistry.java`, `PublicDataCollectorService.java`, `JdbcPublicDataRepository.java`
- 문서: `docs/renewal/03-public-data-expansion-progress.md`, `docs/renewal/03-public-data-expansion-plan.md`
- 공개 API 점검: `GET /actuator/health`, `GET /api/public/datasets`, `GET /api/public/air-quality`, `GET /api/public/population`

## 해석 주의

- 2026-06-20 공간 정책 승인 후 `administrative_boundary`에 프런트 동 경계를 합친 간이 금천구 경계를 적재하고, 주소 우선·도형 보조 방식으로 `GEUMCHEON / BORDER_AREA / EXTERNAL_REFERENCE`를 분류했다. 공식 경계로 교체 시 경계 인접 행을 재검증한다.
- 상가 분류 실측은 GEUMCHEON 15,516행, BORDER_AREA 8,529행, EXTERNAL_REFERENCE 0행이며 삭제된 행은 없다.
- 주차장 기존 131행은 11개 원천 ID이며, 125개 노상 공간 좌표와 6개 시설 행이 섞인 원천이다. 신규 25개 시설 응답과 원시 행 수를 직접 비교하지 않는다.
- 수집 성공률은 개발·검증 기간의 전체 로그 비율이며 운영 SLA 달성률로 해석하지 않는다.
- CCTV 935건은 관리자 CSV 업로드 성공 스냅샷이다. 자동 API 성공으로 해석하지 않는다.
- `heat-shelters`, `school-zones`, `ev-chargers`는 확정 원천이 없어 우선순위 산정에서 운영 데이터셋으로 취급하지 않았다.
