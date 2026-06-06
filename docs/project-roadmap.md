# Geumcheon Data Platform Roadmap

금천구 데이터 플랫폼의 전체 진행 상황과 다음 작업 우선순위를 정리합니다.

## 현재 결론

현재 프로젝트는 **Mock 데이터 기반 MVP + 관리자 파일 업로드 흐름 + 실제 PostgreSQL/PostGIS DB 모드 검증**까지 완료된 상태입니다.

이제 mock 모드와 DB 모드를 모두 실행할 수 있습니다. 다음 큰 흐름은 외부 공공데이터 API 연동과 실제 Excel 파싱입니다.

## 현재까지 완료

### 1. 프로젝트 뼈대

- 프론트 정적 MVP 구조 생성: `frontend-static`
- Spring Boot/eGovFrame 성격의 백엔드 뼈대 생성: `backend-egovframe-skeleton`
- 프로젝트 내장 Java/Maven 도구 구성
- 프론트 실행 스크립트와 백엔드 mock 실행 스크립트 준비
- 기본 확인 스크립트 준비: `scripts/check-backend.ps1`

### 2. Mock 데이터 기반 화면

- 메인 대시보드 화면
- 생활시설 지도/목록 화면
- 상권/시설 Mock 데이터 표시
- 프론트가 백엔드 mock API를 우선 사용하고, 실패 시 로컬 Mock JSON으로 전환

### 3. 백엔드 Mock API

- `GET /actuator/health`
- `GET /api/public/datasets`
- `GET /api/public/facilities`
- `GET /api/admin/datasets`
- `GET /api/admin/collection-logs`
- `POST /api/admin/uploads/preview`
- `POST /api/admin/uploads/commit`

### 4. 관리자 CSV 업로드

- 관리자 업로드 UI
- CSV 파일 선택
- UTF-8 BOM, EUC-KR/MS949 계열 한글 CSV 인코딩 대응
- 첫 5행 미리보기
- 데이터셋별 컬럼 자동 매핑
- 필수 필드 누락/중복 검증
- 업로드 확정 버튼
- 성공/실패/로컬 저장 상태 로그 표시
- 샘플 CSV 다운로드

상세 문서: `docs/admin-upload-flow.md`

### 5. DB 저장 준비

- PostgreSQL/PostGIS 기준 스키마 초안 작성: `database/schema.sql`
- mock seed 작성: `database/seed-mock.sql`
- 업로드 저장 migration 작성: `database/migration-20260602-admin-upload.sql`
- DB 모드 실행/검증 스크립트 작성
- CSV 원본 파일 저장 경로 정책 정리
- DB 모드에서 `uploaded_file`, `dataset_collection_log`, `facility` 저장 코드 준비
- PostgreSQL/PostGIS 로컬 설치
- 스키마/seed 적용
- DB 모드 백엔드 실행
- CSV 업로드 후 `uploaded_file`, `dataset_collection_log`, `facility` 저장 검증
- 저장된 원본 CSV 파일 존재 확인

### 6. Excel 업로드 준비

- `.xlsx`, `.xls` 파일 선택 허용
- Excel 파일을 CSV처럼 잘못 읽지 않도록 프론트/백엔드에서 형식 감지
- Excel 선택 시 백엔드에서 첫 번째 시트 미리보기 지원
- 실제 Excel 파싱 계획 문서 작성

상세 문서: `docs/excel-upload-plan.md`

### 7. API 수집 상태 mock 화면

- 공공데이터 연결 준비 현황 보드 추가
- 준비됨/Mock/키 필요/확인 필요 상태를 카드로 표시
- 메인 대시보드와 연결되는 주요 소스의 갱신 주기, 환경변수, 대상 화면을 표시
- 로컬 JSON으로 로드되는 mock 상태 화면 구성

### 8. API 수집 로그 mock 화면

- 최근 수집 실행 내역 보드 추가
- 성공/실패/대기/수동 상태를 카드로 표시
- 대상 화면, 수집 시각, 소요 시간, 다음 실행 시점 표시
- 상태 필터와 검색이 가능한 로컬 JSON 기반 mock 로그 화면 구성
- 실패/대기/수동 항목을 재수집하는 mock 액션 추가

### 9. P5 지도/분석 고도화 - 완료

- 행정동/집계구/상권 경계 데이터를 mock 레이어로 반영
- 경계 레이어 전환과 선택 권역 강조 규칙 구현
- 반경 분석, 업종 밀도, 권역 비교 카드 추가
- 지도 대체 목록과 키보드 접근성 보강
- 선택 권역의 spotlight 카드와 추천 포인트 표시

### 10. P6 운영/공공기관 기준 보강 - 완료

- 관리자 권한은 브라우저 세션 기반으로 분리
- 관리자 데이터셋 입력값 검증과 `aria-invalid` 안내 보강
- 외부 API 키는 서버 환경변수 또는 Secret Manager로만 보관
- 화면/상세에 출처와 기준시각을 표시
- 스킵 링크와 상태 영역 `aria-live`를 넣어 접근성 보강
- 배포 환경 문서를 추가해 운영 절차를 분리

## 현재 보류

### 실제 Excel 파싱 검증

보류 이유: Apache POI 의존성이 필요해서 Maven 외부 다운로드가 가능한 환경에서 최종 빌드 확인이 필요합니다.

재개 조건:

- Maven 의존성 다운로드 가능
- Excel 샘플 파일과 테스트 추가

## 다음 우선순위

### P0. 현재 실행/반영 상태 정리 - 완료

목표: 사용자가 같은 실수를 반복하지 않도록 실행 순서와 상태를 더 쉽게 만듭니다.

작업:

- 현재 실행 중인 백엔드 jar가 잠겨 있을 때 업데이트 방법 정리
- `README.md`에 mock 모드 기준 실행 순서와 DB 보류 상태 명확화
- `docs/project-roadmap.md`를 기준 문서로 연결
- 로컬 실행 상태 확인 스크립트 추가: `scripts/check-local-status.ps1`

### P1. 관리자 업로드 UX 보강 - 완료

목표: DB 없이도 mock 모드에서 관리자 업로드 기능을 더 완성도 있게 만듭니다.

작업:

- 업로드 실패 메시지를 더 읽기 좋게 표시
- Excel 선택 시 안내를 더 친절하게 개선
- 업로드 확정 후 시설 목록/지도 갱신 흐름 개선
- 최근 업로드 로그에서 파일명, 데이터셋, 상태를 더 명확하게 표시

### P2. 데이터셋 관리 화면 - 완료

목표: 업로드 대상 데이터셋을 코드에 고정하지 않고 화면에서 관리할 수 있게 만듭니다.

작업:

- 데이터셋 목록/상세 화면 구성
- 출처, 갱신주기, 공개 여부 표시
- mock 데이터셋 수정 흐름
- 화면 공개 여부와 업로드 방식에 따라 CSV 업로드 선택 목록 자동 반영
- 컬럼 매핑 필요 여부에 따른 업로드 검증 반영
- DB 설치 후 `dataset` 테이블과 연결

### P3. 실제 DB 모드 전환 - 완료

목표: 업로드한 CSV가 실제 DB와 파일 저장소에 남게 만듭니다.

작업:

- PostgreSQL/PostGIS 설치
- 스키마/seed 적용
- DB 모드 백엔드 실행
- CSV 업로드 후 `facility` 테이블 적재 확인
- 저장된 원본 파일 확인

### P4. 실제 공공데이터 API 연동 - 진행 중

목표: API 키를 환경변수로 등록하고 자동 수집 구조를 만듭니다.

작업:

- `stores` 와 `air-quality` 수집기 및 수동 동기화 스크립트 준비
- 공공데이터포털 상가/시설 데이터 연동
- 서울 열린데이터 대기/교통/생활인구 연동
- API 수집 로그 저장
- 실패 시 마지막 정상 데이터 유지
- 우선 `stores` 와 `air-quality` 를 실제 키로 수집해 DB 적재를 안정화
- 다음으로 교통/생활인구 같은 추가 소스를 순차 확장
- 마지막으로 자동 재수집과 운영용 스케줄링을 붙여 반복 수집 구조를 완성

## 남은 우선순위

### 1. P4 실제 공공데이터 API 연동

- 먼저 `DATA_GO_KR_API_KEY` 와 `SEOUL_OPEN_API_KEY` 를 넣고 `stores`, `air-quality` 를 실제 수집
- 수집 성공/실패를 `dataset_collection_log` 에 남기고 마지막 정상 데이터 유지 확인
- 공공데이터포털 상가/시설 데이터 범위를 넓혀 시설/상권 화면을 채움
- 서울 열린데이터 대기/교통/생활인구 소스를 순차적으로 추가
- 자동 재수집 주기와 실패 재시도 규칙을 정리

### 2. 실제 Excel 파싱

- Apache POI 의존성을 받을 수 있는 환경에서 빌드 확인
- CSV와 같은 preview/commit 흐름으로 통합된 Excel 업로드 검증
- 한글, 날짜, 숫자 셀 처리와 테스트 파일 추가
- 파일 크기와 시트/행 수 제한을 정해 안전장치 마련
