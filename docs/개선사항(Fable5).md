# 개선사항 작업 지시서 (2026-06-10)

이 문서는 작업용 AI 모델(또는 개발자)이 그대로 실행할 수 있는 작업 지시서입니다.

- 기준: 2026-06-10 워킹트리 전체 검토 결과
- 선행 문서: `docs/code-review-and-improvements.md`(2026-06-06 리뷰). 그 문서의 항목 1·2·3·4·5·8·9·10·15·16·17은 **이미 반영 완료**이므로 다시 작업하지 말 것. 이 문서는 미해결 항목 + 신규 발견 항목만 담는다.
- 작업 규칙: `AGENTS.md`의 코딩 스타일·테스트 규칙을 따른다. 각 항목 완료 시 관련 회귀 테스트를 추가하고, 동작이 바뀌면 `README.md`/`docs/project-roadmap.md`를 갱신한다.
- 우선순위: P1(기능 결함·즉시) → P2(구조) → P3(보안·운영) → P4(테스트·CI) → P5(정리). 같은 등급 안에서는 위에서 아래 순서로 진행한다.

---

## P1. 기능 결함 — 즉시 수정

### A1. 상가 수집에 페이지네이션이 없어 최대 100건만 저장되고, 기존 데이터까지 100건으로 줄어든다

- **파일**: `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/publicdata/PublicDataCollectorService.java` — `buildStoreRequestUrl()` (약 326행), `syncStores()`
- **현상**: 요청 URL이 `pageNo=1&numOfRows=100` 고정이다. `JdbcPublicDataRepository.replaceStoreBusinesses()`는 DELETE 후 INSERT(replace) 방식이므로, 수집을 실행할 때마다 `store_business` 테이블이 **최대 100행으로 교체**된다. 금천구 상가업소는 수만 건 규모이므로 P4(공공데이터 연동)의 핵심 결함이다.
- **추가 문제**: 중심좌표 `cx/cy=126.8954/37.4568`, `radius=3000` 고정이라 금천구 외곽이 누락될 수 있고, 금천구 밖 영역이 섞일 수 있다.
- **작업**:
  1. 응답의 `totalCount`(소상공인시장진흥공단 API 표준 응답 필드)를 읽어 `pageNo`를 증가시키며 전체 페이지를 수집하도록 루프를 구현한다. `numOfRows`는 500~1000 수준으로 올리고 설정값(`geumcheon.collector.store-page-size`)으로 뺀다.
  2. 반경 방식 대신 행정동/시군구 코드 기반 엔드포인트(`storeListInDong` 또는 `storeListInArea`, 금천구 시군구코드 11545) 사용을 검토한다. API 스펙 확인 후 더 정확한 쪽을 선택한다.
  3. 전체 페이지를 메모리에 모은 뒤 한 트랜잭션으로 replace하거나, 페이지 단위 누적 insert 후 마지막에 old 데이터를 정리하는 방식 중 하나로 정합성을 유지한다(현재 `@Transactional` replace 구조 유지가 단순함).
  4. 과도한 호출 방지를 위해 페이지 수 상한(예: 200페이지)과 페이지 간 짧은 대기를 둔다.
- **완료 기준**: 실제 API 키로 `.\scripts\sync-public-data.ps1 -DatasetKey stores` 실행 시 100건 초과 데이터가 저장되고, `dataset_collection_log`에 source/saved 건수가 일치하게 기록된다. 페이지네이션 로직 단위 테스트(모킹) 추가.

### A2. 외부 공공데이터 API를 평문 HTTP로 호출한다 — API 키 노출

- **파일**: 같은 파일 — `buildStoreRequestUrl()`, `buildAirQualityRequestUrl()` (약 326~343행)
- **현상**: `http://apis.data.go.kr/...`, `http://openAPI.seoul.go.kr:8088/...` 모두 평문 HTTP다. URL 쿼리에 API 키가 들어가므로 네트워크 구간에서 키가 그대로 노출된다. 또한 Java `HttpClient`는 기본적으로 리다이렉트를 따라가지 않으므로, 제공처가 http→https 리다이렉트를 도입하면 수집이 바로 깨진다.
- **작업**: 두 URL을 `https://`로 변경한다 (`https://apis.data.go.kr/...`, `https://openapi.seoul.go.kr:8088/...`). 변경 후 실제 호출이 되는지 확인하고, `RequestUrlMaskerTest`처럼 URL 빌더에 대한 테스트가 있으면 함께 갱신한다.
- **완료 기준**: 코드에 평문 `http://` 외부 API 호출이 남아 있지 않다.

### A3. stores/population 데이터셋: CSV 업로드 UI는 있는데 커밋이 구현돼 있지 않다

- **파일**: `AdminUploadController.datasetSummaries()` (약 216행), `JdbcAdminUploadStore.saveDatasetRows()` (약 180행), `frontend-static/js/core/state.js`의 `datasetFieldSchemas`
- **현상**: `stores`(업로드 방식 "API/CSV")와 `population`(방식 "CSV")은 `supportsUploadCommit=false`라 프리뷰는 되지만 커밋이 거부된다. `JdbcAdminUploadStore.saveDatasetRows()`도 `"facilities"`만 하드코딩으로 지원한다. 프론트에는 두 데이터셋의 필드 스키마(`allowedFields`의 population 항목 포함)가 이미 존재해 사용자 입장에서 "되는 것처럼 보이는" 기능이다.
- **작업** (둘 중 하나를 선택하되, 1안 권장):
  1. **1안(구현)**: `saveDatasetRows()`를 datasetKey별 분기(switch)로 확장해 `store_business`, `indicator_value`(population) 저장을 구현하고 `supportsUploadCommit=true`로 변경한다. 매핑 필드는 `AdminUploadController.allowedFields()` 기준을 따른다.
  2. **2안(차단 명확화)**: 프론트 관리자 화면에서 커밋 불가 데이터셋은 업로드 버튼을 비활성화하고 사유를 표시한다.
- **완료 기준**: UI에서 보이는 동작과 백엔드 실제 지원 범위가 일치한다. 1안이면 `check-db-upload.ps1` 수준의 검증 스크립트/테스트 추가.

---

## P2. 구조·설계 개선

### B1. Mock 저장소가 JDBC 구현을 상속하고, mock 데이터가 3곳에 중복돼 있다 — 인터페이스 추출

- **파일**:
  - `publicdata/MockPublicDataRepository.java` — `extends JdbcPublicDataRepository` + `super(null, null)`
  - `publicdata/JdbcPublicDataRepository.java`
  - `dataset/DatasetController.java`, `facility/FacilityController.java` — `try/catch(RuntimeException)` 후 mock 모드면 `defaultDatasets()`/`defaultFacilities()` 반환
- **현상**: Mock이 JDBC 구현 클래스를 상속하면서 `null` 의존성으로 super를 호출한다. 오버라이드를 빠뜨린 메서드가 호출되면 NPE다. 게다가 mock 데이터가 `MockPublicDataRepository`, `DatasetController`, `FacilityController` 세 곳에 따로 정의돼 있고, 컨트롤러의 예외-폴백 로직은 mock 저장소의 역할과 중복된다.
- **작업**:
  1. `PublicDataRepository` 인터페이스를 추출한다(현재 public 메서드 시그니처 그대로: `listDatasets`, `listFacilities`, `listStores`, `listAirQuality`, `listApiSources`, `recentApiLogs`, `upsertDataset`, `ensureIndicator`, `replaceStoreBusinesses`, `replaceAirQualitySnapshot`, `recordCollectionLog`, `loadDatasetRegistryEntries` 등).
  2. `JdbcPublicDataRepository implements PublicDataRepository`(`@Profile("!mock")`), `MockPublicDataRepository implements PublicDataRepository`(`@Profile("mock")`, 상속 제거).
  3. `DatasetController`, `FacilityController`, `PublicDataController`, `PublicDataCollectorService`가 인터페이스를 주입받게 바꾸고, 컨트롤러의 try/catch mock 폴백과 `default*()` 중복 데이터를 삭제한다(`AdminUploadStore` 인터페이스 패턴과 동일하게).
- **완료 기준**: mock 모드(`run-backend-mock.ps1`)와 db 모드가 모두 기동·동작하고, mock 데이터 정의처가 `MockPublicDataRepository` 한 곳이다. `mvn test` 통과.

### B2. AdminUploadController(444줄)에 파싱·인코딩·드래프트 관리·검증이 모두 들어 있다

- **파일**: `admin/AdminUploadController.java`
- **현상**: CSV 수제 파서(`parseCsv`), 인코딩 감지(`decodeCsv`/`decodeText`), 드래프트 수명 관리(`storeUploadDraft`/`cleanup*`/`trim*`), 검증(`validate*`), 데이터셋 메타까지 한 클래스다. 선행 리뷰 항목 19 미해결.
- **작업**: 다음 단위로 분리한다(패키지 `admin` 유지, 기존 동작 변경 금지):
  - `CsvParser` — `parseCsv`, `decodeCsv`, `decodeText`, `stripBom`, `looksMisdecoded` (기존 `ExcelUploadParser`와 대칭)
  - `UploadDraftManager` — `uploadDrafts` 맵과 TTL/상한 정리 로직
  - `UploadValidator` — `validatePreview`, `validateCommitMapping`, `validateCommitCounts`, `requiredFields`, `allowedFields`
  - 각 클래스 단위 테스트 추가 (`CsvParserTest` 등, 기존 `AdminUploadControllerTest` 케이스는 유지)
- **완료 기준**: 컨트롤러는 요청/응답 흐름만 남고, `mvn test` 통과, 기존 API 응답 형식 불변.

### B3. 데이터셋 메타데이터가 4곳에 하드코딩 — 단일 출처화

- **파일**: `AdminUploadController.datasetSummaries()`, `DatasetController.defaultDatasets()`, `MockPublicDataRepository`의 `defaultDatasets()`, `frontend-static/js/core/state.js`의 `datasetFieldSchemas`
- **현상**: 동일한 데이터셋 키/이름/업로드 방식/필드 스키마가 백엔드 3곳 + 프론트 1곳에 중복돼 있다. 선행 리뷰 항목 20 미해결(모듈 분할로 위치만 이동).
- **작업**:
  1. 백엔드: 데이터셋 정의(키, 이름, 도메인, 출처, 주기, 업로드 방식, 필수/허용 필드)를 단일 클래스(예: `dataset/DatasetRegistry`) 또는 DB `dataset` 테이블 기반으로 통합하고 나머지는 거기서 읽는다. B1 완료 후 진행하면 중복 2곳은 자동 제거된다.
  2. 프론트: `GET /api/admin/datasets` 응답에 필수/허용 필드를 포함시켜 `datasetFieldSchemas` 하드코딩을 대체한다(백엔드 응답 실패 시에만 현재 값을 폴백으로 유지).
- **완료 기준**: 데이터셋 메타 수정 지점이 백엔드 1곳이다.

### B4. 업로드 드래프트가 통째로 힙에 올라간다 (최악 ~250MB)

- **파일**: `admin/AdminUploadController.java`(`readAllBytes`, `uploadDrafts`), `admin/CsvUploadDraft.java`(`byte[] content` + 전체 `rows`)
- **현상**: 프리뷰가 최대 50MB 파일을 `byte[]`로 보관하고 파싱된 전체 행도 함께 보관한다. 드래프트 5개면 수백 MB. 재시작하면 드래프트가 사라져 커밋이 실패한다. 선행 리뷰 항목 12·13 미해결.
- **작업**: 드래프트 본문을 `Files.createTempFile()` 기반 디스크 저장으로 바꾸고, `CsvUploadDraft`는 경로·헤더·행수·해시만 보관한다. 커밋 시 파일을 다시 읽어 파싱한다. TTL 만료 시 임시파일도 삭제한다. (B2의 `UploadDraftManager` 분리와 함께 진행 권장)
- **완료 기준**: 50MB 파일 프리뷰 5건 후에도 힙 증가가 수 MB 수준. 만료/정리 시 임시파일이 남지 않는다.

### B5. (선택) JdbcPublicDataRepository 819줄 — 도메인별 분리

- **현상**: dataset/facility/store/air-quality/수집로그 5개 도메인의 SQL이 한 클래스에 있다.
- **작업**: B1의 인터페이스 추출 후 여력이 있으면 도메인별 저장소로 나눈다. 강제는 아니며, B1~B4보다 후순위.

---

## P3. 보안·운영

### C1. 관리자 자격증명이 sessionStorage에 평문(JSON)으로 저장된다

- **파일**: `frontend-static/js/pages/admin.js` (약 249·308행), `frontend-static/js/core/state.js` (약 136행)
- **현상**: ID/비밀번호를 sessionStorage에 저장하고 매 요청 `Basic btoa(...)` 헤더를 만든다. XSS 한 번이면 그대로 탈취된다. 선행 리뷰 항목 6 미해결.
- **작업**: 단기 — 자격증명을 모듈 스코프 메모리 변수로만 유지하고 sessionStorage 저장을 제거한다(새로고침 시 재로그인은 감수, 관리자 1인 도구이므로 수용 가능). 중기 — C2와 함께 세션 쿠키(HttpOnly, SameSite=Lax) 기반 로그인으로 전환.
- **완료 기준**: 브라우저 저장소 어디에도 비밀번호/Basic 헤더가 남지 않는다.

### C2. `admin_user` 테이블이 미사용 — 인메모리 단일 계정

- **파일**: `database/schema.sql`(약 207행), `application.yml`의 `spring.security.user`
- **현상**: 스키마에는 `admin_user(login_id, password_hash, ...)`가 있으나 인증은 환경변수 단일 계정이다. 선행 리뷰 항목 7 미해결.
- **작업**: `UserDetailsService` + BCrypt(`password_hash`)로 DB 계정 인증을 구현하고, 초기 계정은 `ADMIN_INITIAL_*` 환경변수로 시드한다. 로그인 성공 시 `last_login_at` 갱신. C1 중기안(세션 쿠키)과 함께 진행하면 한 번에 끝난다.
- **완료 기준**: DB 계정으로 로그인되고, 기본 계정/비밀번호 가드(`AdminCredentialGuard`)는 유지된다.

### C3. `.env.example`에 실제 사용 중인 환경변수가 빠져 있다

- **파일**: `.env.example`, `backend-egovframe-skeleton/src/main/resources/application.yml`
- **현상**: `application.yml`이 참조하는 `COLLECTOR_RETRY_DELAY_SECONDS`, `COLLECTOR_SCHEDULE_ENABLED`, `COLLECTOR_CRON`, `CORS_ALLOWED_ORIGINS`, `UPLOAD_PREVIEW_TTL_MINUTES`, `UPLOAD_MAX_PREVIEW_DRAFTS`가 `.env.example`에 없다.
- **작업**: 누락 변수를 기본값·주석과 함께 추가하고, `docs/env-and-next-steps.md`와 일치시킨다.
- **완료 기준**: `application.yml`의 `${...}` 변수 전부가 `.env.example`에 존재한다.

### C4. DB 마이그레이션이 수동 SQL + PowerShell이다 — Flyway 도입

- **파일**: `database/schema.sql`, `database/migration-20260602-admin-upload.sql`, `scripts/apply-db.ps1`
- **현상**: 마이그레이션 적용 여부를 추적할 수 없고, 순서·중복 적용이 사람 손에 달려 있다.
- **작업**: `flyway-core` + `flyway-database-postgresql` 의존성을 추가하고 기존 SQL을 `V1__baseline.sql`, `V2__admin_upload.sql`로 이관한다. 기존 DB에는 baseline 처리. `apply-db.ps1`은 호환 유지 또는 Flyway 호출로 단순화.
- **완료 기준**: 새 DB에서 백엔드 기동만으로 스키마가 구성된다.

### C5. 선행 리뷰에서 제안된 DB 인덱스가 아직 미적용이다

- **확인 결과**: `database/` 디렉터리에 `idx_collection_log_type_started`, GIN 인덱스 마이그레이션이 없다.
- **작업**: 마이그레이션 파일(C4 도입 시 `V3__indexes.sql`)로 추가한다:
  - `CREATE INDEX idx_collection_log_type_started ON dataset_collection_log(collection_type, started_at DESC);` — `latestApiLogsByDataset`/`recentApiLogs` 쿼리용
  - GIN 인덱스(`store_business.properties`, `indicator_value.value_json`)는 해당 jsonb를 조건절로 조회하는 기능이 생길 때 추가(현재는 보류 가능).

### C6. 검증 실패가 HTTP 200으로 반환된다

- **파일**: `api/ApiResponse.java`, `AdminUploadController`의 모든 `ApiResponse.fail(...)` 반환, 프론트 `js/pages/admin.js`·`js/core/api.js`의 `payload.success` 처리
- **현상**: 잘못된 요청(빈 파일, 알 수 없는 datasetKey 등)도 200 OK + `success:false`로 내려간다. 표준 HTTP 시맨틱과 어긋나 모니터링·클라이언트 분기가 어렵다.
- **작업**: 검증 실패는 400, 리소스 없음은 404로 내려가게 `ResponseEntity<ApiResponse<T>>` 또는 예외 + `ApiExceptionHandler` 확장으로 변경한다. **프론트의 `response.ok` 체크와 반드시 함께 수정**한다(현재 프론트는 `!response.ok`면 폴백하는 경로가 있어 단독 변경 시 동작이 깨진다).
- **완료 기준**: 실패 응답 상태코드가 4xx이고, 프론트 업로드 흐름·폴백이 기존대로 동작한다.

---

## P4. 테스트·CI

### D1. 핵심 경로 테스트 공백

- **현상**: 메인 클래스 33개 대비 테스트 5개. 다음 경로가 무테스트다:
  - `PublicDataCollectorService` — 재시도, 키 마스킹, busy 가드(`collectorRunning`), 키 누락 시 SKIPPED 처리. (A1 페이지네이션 구현 시 필수)
  - `JdbcPublicDataRepository` — replace 경로의 트랜잭션 롤백(중간 실패 시 기존 데이터 보존)
  - 보안 경로 — `/api/admin/**` 무인증 401, `/api/public/**` 200, 그 외 deny
- **작업**: 외부 HTTP는 인터페이스로 추상화하거나 `HttpClient` 주입으로 모킹한다. DB 의존 테스트는 Testcontainers(PostGIS 이미지) 도입을 권장하되, 환경상 어렵다면 JDBC 호출을 검증 가능한 단위로 분리해 모킹한다.
- **완료 기준**: 위 3개 영역에 각각 최소 1개 테스트 클래스, `mvn test` 통과.

### D2. CI가 없다

- **작업**: GitHub Actions 워크플로 추가 — push/PR 시 `mvn -B test`(temurin 17) + 프론트 문법 검사(`node --check`를 `frontend-static/js/**/*.js`, `serve-static.mjs`에 대해 실행). 캐시는 `~/.m2`.
- **완료 기준**: PR에서 빌드·테스트가 자동 실행된다.

---

## P5. 저장소 위생·소소한 정리

### E1. 디버그 산출물이 git에 커밋돼 있다

- **대상**: `geo_boundary_focus.png`, `geo_compare_check.png`, `geumcheon_dom.txt`, `geumcheon_dom2.txt` (루트, 총 ~430KB, `git ls-files`로 추적 확인됨)
- **작업**: `git rm` 후 `.gitignore`에 `*.png`(루트 한정) 또는 명시 패턴 추가. 필요하면 `docs/assets/`로 옮겨 의도를 명시한다.

### E2. 레거시 프론트 파일과 작업 메모의 모순 정리

- **현상**: `frontend-static/app.js`(2,104줄)는 `index.html`에서 로드되지 않는데, `frontend-static/checklist.md`에는 "[x] app.js 삭제"로 체크돼 있고 `context-notes.md`에는 "보존 결정"이라 적혀 있다. `styles.css`(1,911줄)는 아직 로드 중이며 "점진적 제거" 주석이 있다.
- **작업**:
  1. `app.js`는 git 이력에 남아 있으므로 삭제한다(보존 사유가 없다면). checklist/context-notes 기술을 실제 상태와 일치시킨다.
  2. `styles.css` → `css/` 토큰·페이지 CSS로의 마이그레이션을 마치고 `index.html`에서 제거한다. 마이그레이션 전이라면 어떤 셀렉터가 아직 styles.css에 의존하는지 목록화부터 한다.
  3. `frontend-static/CLAUDE.md`, `checklist.md`, `context-notes.md` 같은 작업 메모는 `docs/` 이동 또는 삭제를 결정한다.

### E3. 업로드 로그 조회가 5건 고정이다

- **파일**: `JdbcAdminUploadStore.recentLogs()` — `LIMIT 5` (API 로그는 20건)
- **작업**: limit을 파라미터화(쿼리 파라미터 `?limit=`, 기본 20, 상한 100)하거나 최소한 20으로 통일한다.

### E4. `syncDataset()`의 default 분기 메시지가 오해를 부른다

- **파일**: `PublicDataCollectorService.syncDataset()` (약 148행)
- **현상**: spec은 존재하나 수집 루틴이 없는 datasetKey가 들어오면 `busyResult`("already running")를 반환한다. 현재는 도달 불가지만, 수집 소스를 추가할 때 디버깅을 방해하는 함정이다.
- **작업**: default 분기를 "No collector routine for datasetKey: ..." 류의 skipped 결과로 교체한다.

---

## 기능 제안 (선행 문서 Part 2 중 미착수, 로드맵 P5/P7 연계)

1. **지도 목록 API에 bbox·카테고리 서버 필터 + 페이징** — `listFacilities`/`listStores`가 `LIMIT 1000` 고정. PostGIS `ST_MakeEnvelope` + 쿼리 파라미터(`bbox`, `category`, `page`, `size`). A1로 상가 데이터가 수만 건이 되면 사실상 필수가 된다.
2. **공개 데이터 CSV/GeoJSON 다운로드 + OpenAPI(springdoc) 문서** — 데이터 플랫폼 정체성에 부합, 난이도 낮음.
3. **수집 동시성 가드의 DB 락 전환**(선행 항목 14) — 다중 인스턴스 배포 계획이 생기기 전까지는 보류 가능.

---

## 검증 방법 (각 작업 공통)

```powershell
# 백엔드 테스트
cd backend-egovframe-skeleton
mvn test          # 또는 .\scripts\build-backend.ps1

# 프론트 문법 검사
node --check frontend-static/js/main.js   # 변경한 모듈별로 실행

# 로컬 통합 확인
.\scripts\run-backend-mock.ps1            # mock 모드 기동 확인 (B1 작업 시 필수)
.\scripts\check-local-status.ps1
.\scripts\check-admin-upload.ps1          # 업로드 흐름 (A3, B2, B4, C6 작업 시)
.\scripts\check-db-upload.ps1             # DB 모드 (A1, C4, C5 작업 시)
```

주의: 백엔드 변경 후에는 실행 중인 서버를 종료해야 jar가 갱신된다(`README.md`의 "When Backend Jar Is Locked" 절 참고).
