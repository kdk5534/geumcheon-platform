# 금천구 데이터 플랫폼 환경변수 및 다음 작업 v0.1

## 1. 환경변수 초안

초기 개발에서는 값이 없어도 실행되도록 만든다. 실제 API 연동 시 아래 값을 `.env`, 서버 환경변수, 또는 운영 Secret Manager에 등록한다.

- 프론트 정적 파일에는 API 키를 두지 않는다.
- `DATA_GO_KR_API_KEY`, `SEOUL_OPEN_API_KEY`, `VWORLD_API_KEY`, `SGIS_API_KEY`, `KOSIS_API_KEY`, `WORKNET_API_KEY` 는 서버 환경변수 또는 Secret Manager에서만 주입한다.
- `ADMIN_INITIAL_LOGIN_ID`, `ADMIN_INITIAL_PASSWORD` 를 포함한 `ADMIN_INITIAL_*` 값도 운영에서는 기본값을 그대로 사용하지 않는다.

```env
# Application
APP_ENV=local
APP_BASE_URL=http://localhost:8080
FRONTEND_BASE_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geumcheon_data
DB_USERNAME=geumcheon
DB_PASSWORD=change-me

# Public data APIs
DATA_GO_KR_API_KEY=
SEOUL_OPEN_API_KEY=
VWORLD_API_KEY=
SGIS_API_KEY=
KOSIS_API_KEY=
WORKNET_API_KEY=

# Admin
ADMIN_INITIAL_LOGIN_ID=admin
ADMIN_INITIAL_PASSWORD=replace-with-a-strong-password
ADMIN_INITIAL_NAME=초기 관리자
ADMIN_INITIAL_EMAIL=
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# File upload
# CSV originals are stored under UPLOAD_BASE_PATH/admin-csv/{datasetKey}/{yyyyMMdd}/
UPLOAD_BASE_PATH=./uploads
MAX_UPLOAD_SIZE_MB=50
UPLOAD_PREVIEW_TTL_MINUTES=15
UPLOAD_MAX_PREVIEW_DRAFTS=5

# Batch collection
COLLECTOR_ENABLED=false
COLLECTOR_DEFAULT_TIMEOUT_SECONDS=20
COLLECTOR_RETRY_COUNT=3
COLLECTOR_RETRY_DELAY_SECONDS=5
COLLECTOR_STORE_PAGE_SIZE=500
COLLECTOR_STORE_MAX_PAGES=200
COLLECTOR_STORE_PAGE_DELAY_MILLIS=200
COLLECTOR_SCHEDULE_ENABLED=false
COLLECTOR_CRON=0 0 4 * * *
```

`application.yml` 에서 참조하는 `${...}` 환경변수는 위 예시에 모두 반영했다. DB 모드에서는 Flyway가 시작 시 `V1__baseline`, `V2__admin_upload`, `V3__collection_log_indexes` 를 자동 확인한다.

## 2. API 키 발급 대상

| 환경변수 | 대상 | 사용 데이터 | 발급 시점 |
|---|---|---|---|
| DATA_GO_KR_API_KEY | 공공데이터포털 | 상가업소, 병원, 약국, AED, 대피소, 전기차 충전소, 부동산 등 | 개발 중반 |
| SEOUL_OPEN_API_KEY | 서울 열린데이터광장 | 미세먼지, 지하철, 버스, 생활인구, 서울시 시설 데이터 | 개발 중반 |
| VWORLD_API_KEY | VWorld | 지도 보조, 주소/좌표, 배경지도 일부 | 지도 기능 전 |
| SGIS_API_KEY | 통계지리정보서비스 | 집계구 경계, 통계 공간 분석 | 집계구 분석 전 |
| KOSIS_API_KEY | 국가통계포털 | 사업체/인구/경제 통계 | 2차 고도화 |
| WORKNET_API_KEY | 워크넷 | 일자리맵 | 2차 고도화 |

## 3. 개발 순서

### 1단계: 프로젝트 뼈대

| 작업 | 설명 |
|---|---|
| 백엔드 생성 | eGovFrame/Spring 기반 프로젝트 생성 |
| 프론트 생성 | React 또는 Vue 프로젝트 생성 |
| DB 준비 | PostgreSQL + PostGIS 구성 |
| 공통 설정 | 환경변수, CORS, 로그, 예외 처리 |

### 2단계: Mock 데이터 기반 화면

| 작업 | 설명 |
|---|---|
| 메인 대시보드 | 날씨, 미세먼지, 교통, 안전, 인구 Mock 카드 |
| 생활지도 | 시설 Mock GeoJSON/JSON 표시 |
| 상권분석 | 상가 Mock 데이터로 반경 분석 |
| 집계구분석 | 샘플 행정동/집계구 GeoJSON으로 색상 지도 |

### 3단계: 관리자

| 작업 | 설명 |
|---|---|
| 로그인 | 관리자 인증 |
| 데이터셋 관리 | 데이터 목록/출처/갱신주기 관리 |
| CSV 업로드 | 시설/상가/지표 데이터 업로드 |
| 수집 로그 | API/업로드 성공/실패 기록 |

### 4단계: 실제 API 연동

| 작업 | 설명 |
|---|---|
| 공공데이터포털 연동 | 상가업소, 병원, 약국 등 |
| 서울 열린데이터 연동 | 대기, 교통, 생활인구 등 |
| 공간 데이터 반영 | 행정동/집계구/상권 경계 |
| 배치 스케줄 | 수집 주기별 자동 갱신 |

### 5단계: 공공기관 기준 보강

| 작업 | 설명 |
|---|---|
| 웹 접근성 | 키보드 조작, 대체 텍스트, 지도 대체 목록 |
| 보안 | 관리자 권한, API 키 보호, 입력값 검증 |
| 출처 표기 | 화면/상세/다운로드에 데이터 출처 표시 |
| 장애 대응 | API 실패 시 마지막 정상 데이터 유지 |

배포 환경 정리와 비밀값 보관 원칙은 [`docs/deployment-environment.md`](./deployment-environment.md) 에 따로 정리한다.

## 4. 바로 착수할 작업

1. eGovFrame/Spring 백엔드 기본 구조 생성
2. PostgreSQL + PostGIS 기준으로 스키마 적용
3. React 또는 Vue 프론트엔드 생성
4. Mock JSON 데이터 작성
5. 메인 대시보드와 생활지도부터 구현

## 5. 결정 필요 사항

| 항목 | 추천 | 이유 |
|---|---|---|
| 프론트엔드 | React | 지도/차트 라이브러리 자료가 많고 유지보수 인력 확보가 쉬움 |
| 지도 라이브러리 | OpenLayers | 공공/GIS 성격에 적합하고 벡터/경계 레이어 처리에 강함 |
| 차트 | Apache ECharts | 대시보드, 지도 연계, 다양한 차트에 적합 |
| DB | PostgreSQL + PostGIS | 집계구/상권/반경 분석 필수 |
| 초기 데이터 | Mock + CSV 업로드 | API 키 없이 개발 가능 |
## 6. Mock fallback policy

- `geumcheon.runtime.mode=mock`일 때만 `DatasetController`와 `FacilityController`가 샘플 데이터를 반환한다.
- DB 모드에서 예외가 나면 `ApiExceptionHandler`가 500으로 응답하고, 프론트는 이를 감지해 `로컬 샘플` 상태를 표시한다.
- `ApiResponse.sourceMode`는 `db`, `mock`, `local` 중 하나로 화면 상태를 구분한다.
- 상단 배너와 데이터 스탬프는 현재 모드를 보여준다.
## Verification loop

- `Get-ChildItem -Path frontend-static\js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }; node --check frontend-static\serve-static.mjs`
- `.\scripts\check-admin-upload.ps1`
- `.\scripts\check-admin-excel-upload.ps1`
- `.\scripts\check-local-status.ps1`
- `.\scripts\run-backend-mock.ps1`
- `mvn test` when Maven dependencies are already cached
