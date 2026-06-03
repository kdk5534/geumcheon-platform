# Geumcheon Data Platform Roadmap

금천구 데이터 플랫폼의 전체 진행 상황과 다음 작업 우선순위를 정리합니다.

## 현재 결론

현재 프로젝트는 **Mock 데이터 기반 MVP + 관리자 CSV 업로드 흐름**까지 만들어진 상태입니다.

PostgreSQL/PostGIS는 아직 로컬에 설치하지 않기로 했기 때문에, 당분간은 **mock 모드에서 화면/관리자 기능을 먼저 완성**하고, DB 설치 이후 실제 저장/공간 분석/API 수집으로 넘어갑니다.

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

현재 제약: 로컬 PostgreSQL 서버가 아직 설치되어 있지 않아 DB 모드 실제 검증은 보류입니다.

### 6. Excel 업로드 준비

- `.xlsx`, `.xls` 파일 선택 허용
- Excel 파일을 CSV처럼 잘못 읽지 않도록 프론트/백엔드에서 형식 감지
- Excel 선택 시 CSV 변환 안내 표시
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

## 현재 보류

### PostgreSQL/PostGIS 설치 및 실제 DB 검증

보류 이유: 사용자가 나중에 설치하기로 결정했습니다.

재개 조건:

- PostgreSQL Windows Installer 설치
- PostGIS 설치
- `geumcheon_data` DB 생성
- `geumcheon` 사용자 생성
- `scripts/apply-db.ps1 -Mode fresh -WithSeed` 실행
- `scripts/run-backend-db.ps1` 실행
- `scripts/check-db-upload.ps1` 실행

### 실제 Excel 파싱

보류 이유: Apache POI 의존성이 필요하고, 현재 Maven 외부 다운로드가 안정적으로 되지 않습니다.

재개 조건:

- Maven 의존성 다운로드 가능
- Apache POI 추가
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

### P3. 실제 DB 모드 전환

목표: 업로드한 CSV가 실제 DB와 파일 저장소에 남게 만듭니다.

작업:

- PostgreSQL/PostGIS 설치
- 스키마/seed 적용
- DB 모드 백엔드 실행
- CSV 업로드 후 `facility` 테이블 적재 확인
- 저장된 원본 파일 확인

### P4. 실제 공공데이터 API 연동

목표: API 키를 환경변수로 등록하고 자동 수집 구조를 만듭니다.

작업:

- 공공데이터포털 상가/시설 데이터 연동
- 서울 열린데이터 대기/교통/생활인구 연동
- API 수집 로그 저장
- 실패 시 마지막 정상 데이터 유지

### P5. 지도/분석 고도화

목표: 금천구 플랫폼의 핵심 가치를 높이는 분석 기능을 만듭니다.

작업:

- 행정동/집계구/상권 경계 데이터 반영
- 반경 분석
- 업종별 밀도/경쟁 지표
- 지도 대체 목록과 접근성 보강

### P6. 운영/공공기관 기준 보강

목표: 실제 운영 가능한 수준으로 안정성, 보안, 접근성을 보강합니다.

작업:

- 관리자 권한 분리
- 입력값 검증 강화
- API 키 서버 보관
- 출처/기준시각 표기
- 웹 접근성 점검
- 배포 환경 문서화

## 지금 바로 다음 단계

다음은 **P4 API 수집 로그 mock 화면**입니다.

단, P3는 PostgreSQL/PostGIS 설치가 필요하므로 계속 보류합니다. 설치 전까지는 API 상태/로그 mock 화면과 관리자 업로드 UX를 더 다듬을 수 있습니다.
