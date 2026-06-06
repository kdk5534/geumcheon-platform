# Geumcheon Data Platform — 코드 리뷰 & 개선 계획

작성일: 2026-06-06  
대상 커밋 기준: 최초 리뷰 시점의 워킹트리 (이후 일부 항목 반영)

---

## 프로젝트 개요

| 구분 | 내용 |
|------|------|
| 백엔드 | Spring Boot + JDBC, ~3,540 LOC, 32개 클래스 |
| 프론트엔드 | 빌드 없는 정적 HTML/JS, `app.js` 단일 파일 3,325 LOC |
| DB | PostgreSQL + PostGIS 스키마 270행 |
| 운영 | PowerShell 스크립트, mock/db 이중 모드 |
| 핵심 기능 | 관리자 CSV/Excel 업로드, 공공데이터 API 수집(stores, air-quality) |

---

## Part 1. 최초 코드 리뷰

### A. 데이터 정합성 / 트랜잭션 — 심각도 High

#### 1. 공공데이터 수집이 비원자적이다 — 부분 실패 시 데이터 유실

**파일** `JdbcPublicDataRepository.java` 300행, 311행  
**현상** `replaceStoreBusinesses()`와 `replaceAirQualitySnapshot()`이 `DELETE` 후 행별 `INSERT` 루프로 동작한다. 메서드에도, 호출부 `PublicDataCollectorService.syncStores/syncAirQuality`에도 `@Transactional`이 없다.  
**결과** autocommit 상태에서 DELETE가 먼저 커밋되고 중간 INSERT에서 예외가 나면 **기존 데이터는 지워지고 신규는 일부만 남는다.** 수집 실패가 곧 서비스 데이터 공백이 된다.  
**수정 방향** 수집 단위를 `@Transactional`로 묶어 all-or-nothing 보장. (`JdbcAdminUploadStore.recordUpload`에는 이미 `@Transactional`이 있어 좋은 대비 사례다.)

```java
// JdbcPublicDataRepository.java
@Transactional
public int replaceStoreBusinesses(UUID datasetId, List<Map<String, String>> rows) { ... }

@Transactional
public int replaceAirQualitySnapshot(UUID datasetId, List<Map<String, String>> rows) { ... }
```

---

#### 2. 행 단위 INSERT 루프 — 배치 미사용

**파일** `JdbcPublicDataRepository.java` 300~308행, `JdbcAdminUploadStore.java` 179~195행  
**현상** `jdbcTemplate.update`를 행마다 호출한다. numOfRows=100 수준이면 체감은 작지만, CSV 시설 업로드는 수천 행이 들어올 수 있어 라운드트립이 선형으로 늘어난다.  
**수정 방향** `jdbcTemplate.batchUpdate`로 전환하거나, 대용량은 PostgreSQL `COPY` 활용.

---

#### 3. `toJson()` 수제 JSON 직렬화 — 제어문자에서 깨진다

**파일** `JdbcPublicDataRepository.java` 694행  
**현상** `JdbcPublicDataRepository`에는 아직 `ObjectMapper`가 주입되어 있지 않은데, 문자열을 직접 조립하는 `toJson()` 때문에 `escapeJson`이 `\r \n \t \" \\`만 처리한다. 그 외 제어문자(U+0000~U+001F)가 API 응답값에 있으면 잘못된 JSON이 된다.  
**결과** `CAST(? AS jsonb)`가 실패해 해당 행이 유실된다. 항목 1의 비원자성과 결합하면 더 위험하다.  
**수정 방향** `ObjectMapper`를 저장소에 주입한 뒤 `objectMapper.writeValueAsString(row)`로 교체한다.

```java
// 수정 전
private String toJson(Map<String, String> row) { /* 수제 조립 */ }

// 수정 후
private final ObjectMapper objectMapper;

private String toJson(Map<String, String> row) {
    try {
        return objectMapper.writeValueAsString(row);
    } catch (JsonProcessingException e) {
        throw new IllegalStateException("Row serialization failed", e);
    }
}
```

---

#### 4. 대기질 세부 지표가 통째로 버려진다

**파일** `JdbcPublicDataRepository.java` 651행  
**현상** `mapAirQuality()`가 pm10/pm25/nitrogen/ozone 등 모든 세부값을 `null`로 반환한다. INSERT 시 `value_json`에 원본이 들어가지만 SELECT에서 파싱하지 않는다.  
**결과** 화면은 등급·통합지수만 표시하고 미세먼지·초미세먼지를 쓰지 못한다. README의 "미세먼지/초미세먼지" 목표와 어긋난다.  
**수정 방향** `value_json`을 `ObjectMapper`로 다시 읽어 pm10/pm25 필드를 채운다.

---

### B. 보안 — 심각도 High~Medium

#### 5. `anyRequest().permitAll()` 캐치올이 위험하다

**파일** `SecurityConfig.java` 33행  
**현상** `/api/admin/**`만 인증이고 나머지는 전부 공개다. 현재 actuator는 health만 노출하지만, `management.endpoints.web.exposure.include`를 넓히는 순간 인증 없이 노출된다.  
**수정 방향** 기본을 `denyAll()`로 두고 공개 경로만 명시적으로 허용.

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/public/**", "/actuator/health", "/error").permitAll()
    .requestMatchers("/api/admin/**").authenticated()
    .anyRequest().denyAll()   // 기본 거부
)
```

---

#### 6. 관리자 자격증명(Basic 헤더)을 클라이언트에 저장한다

**파일** `app.js` 3275행 `saveStoredAdminAuth()`  
**현상** `Basic base64(id:pw)`를 `sessionStorage`에 저장한다. 탭 종료 시 사라지는 점은 그나마 낫지만, base64는 평문과 동치이고 XSS 한 번이면 그대로 탈취된다.  
**수정 방향** 중기적으로 세션 쿠키(HttpOnly/SameSite) 기반 로그인으로 전환. 단기적으로 위험을 README에 명시.

---

#### 7. DB 스키마의 `admin` 테이블이 미사용이다

**파일** `database/schema.sql` 207~217행, `application.yml` 11~14행  
**현상** 인증은 `spring.security.user`의 단일 인메모리 계정으로만 동작한다. 스키마에는 `admin_user(login_id, password_hash)` 테이블이 있으나 코드 경로가 없다. 다중 관리자·권한·감사 로그 설계가 구현과 불일치한다.

---

#### 8. DB 비밀번호에는 기동 가드가 없다

**파일** `AdminCredentialGuard.java`, `.env.example`  
**현상** `AdminCredentialGuard`가 admin 비번이 `change-me`/`admin1234`/빈값이면 db 모드 기동을 막는 건 좋다. 다만 `DB_PASSWORD=change-me`에는 같은 가드가 없다.  
**수정 방향** `AdminCredentialGuard`에서 DB 비밀번호도 동일하게 검사.

---

### C. 성능 — 심각도 Medium

#### 9. 프론트 백엔드 타임아웃이 과도하게 짧다

**파일** `app.js` 24행 `API_TIMEOUT_MS = 450`  
**현상** datasets/facilities를 450ms 안에 못 받으면 즉시 로컬 샘플로 폴백한다. JVM 콜드 스타트나 약간의 부하만으로도 실데이터 대신 mock이 노출된다.  
**수정 방향** 1,500~2,000ms로 완화하거나 점진적 표시(먼저 온 것부터 렌더).

---

#### 10. `loadBackendData`가 all-or-nothing이다

**파일** `app.js` 276행  
**현상** `Promise.all` 4개 중 하나라도(예: air-quality 1,200ms 타임아웃) 실패하면 성공한 datasets/facilities까지 버리고 통째로 로컬 폴백(305행)한다.  
**수정 방향** `Promise.allSettled`로 부분 성공을 활용하고, 실패한 항목만 mock으로 채운다.

---

#### 11. 공개 목록 쿼리에 페이징/공간 필터가 없다

**파일** `JdbcPublicDataRepository.java` `listFacilities()`/`listStores()`  
**현상** `LIMIT 1000` 고정에 bbox·카테고리 서버 필터가 없다. 지도 줌·이동 시 매번 전량을 받아 프론트에서 거른다. 데이터가 늘면 페이로드·렌더 비용이 선형 증가한다.  
**수정 방향** bbox·카테고리 쿼리 파라미터 추가, PostGIS `ST_MakeEnvelope` 활용.

---

#### 12. 업로드 파일이 메모리에 다중 적재된다

**파일** `AdminUploadController.java` 86행, `CsvUploadDraft.java`  
**현상** 프리뷰가 `readAllBytes()`로 최대 50MB를 통째로 읽고 `CsvUploadDraft`의 `content(byte[])`로 보관한다. `max-preview-drafts=5`개면 최악 ~250MB 힙. Excel은 `WorkbookFactory.create`가 XSSF 전체를 메모리에 올려 추가 가중된다.  
**수정 방향** 드래프트는 시스템 임시파일(`Files.createTempFile`)로 저장, Excel은 스트리밍 파서(`SAX`/`SXSSFWorkbook`) 활용.

---

### D. 견고성 — 심각도 Medium~Low

#### 13. 프리뷰 드래프트가 인메모리라 재시작·다중 인스턴스에 취약하다

**파일** `AdminUploadController.java` 45행 `ConcurrentHashMap`  
**현상** 프리뷰→커밋 사이 백엔드 재시작 시 커밋이 항상 실패한다(152행). 다중 인스턴스 로드밸런싱 시 다른 노드로 라우팅되면 드래프트를 찾지 못한다.

---

#### 14. 수집 동시성 가드가 단일 인스턴스 한정이다

**파일** `PublicDataCollectorService.java` 41행 `AtomicBoolean`  
**현상** `collectorRunning`은 프로세스 내 락이다. 스케일아웃 시 여러 인스턴스가 동시에 수집을 시작하면 중복 DELETE+INSERT가 발생한다.  
**수정 방향** DB advisory lock 또는 `dataset_collection_log` 기반 가드로 전환.

---

#### 15. `parseObservedAt` 실패 시 `Instant.now()`로 대체한다

**파일** `JdbcPublicDataRepository.java` 733행, 759행, 778행  
**현상** 파싱 실패한 관측시각과 `null` 타임스탬프를 "지금"으로 채운다. `DISTINCT ON ... ORDER BY observed_at DESC NULLS LAST`에서는 순서가 덜 흔들리지만, 저장된 데이터의 실제 시각이 왜곡되고 최신값 판정이 더러 부정확해질 수 있다.  
**수정 방향** 실패 시 `null`을 반환하고, 저장·조회 양쪽에서 `NULL`을 관찰 시각의 부재로 다룬다.

---

#### 16. 죽은 코드 — `safeLower`

**파일** `PublicDataCollectorService.java` 532행  
**현상** `safeLower()` 메서드가 정의되어 있으나 호출처가 없다. 제거 권장.

---

#### 17. `facility.color`가 미이스케이프로 innerHTML에 들어간다

**파일** `app.js` 486행  
**현상** `fill="${facility.color}"` 부분에 `escapeHtml`이 없다. 색상은 내부 팔레트에서 오므로 현재는 안전하지만, 다른 동적값과 일관성이 깨진다. 향후 색을 데이터에서 받게 되면 속성 인젝션 위험이 생긴다.  
**수정 방향** `escapeHtml(facility.color)`로 통일.

---

### E. 설계 / 유지보수 — 심각도 Low (MVP 감안)

#### 18. `app.js` 3,325줄 단일 파일

상태·렌더·페치·관리자 로직이 한 파일에 섞여 있다. 빌드 없는 제약은 이해하나 ES module 분할(`state.js`/`api.js`/`render-*.js`)만 해도 탐색성이 크게 향상된다.

---

#### 19. `AdminUploadController`에 너무 많은 책임이 응집되어 있다

파싱(CSV/Excel), 인코딩 감지, 검증, 드래프트 관리가 444줄 단일 컨트롤러에 집중되어 있다. `CsvParser`/`UploadValidator` 클래스로 분리하면 단위테스트 작성이 쉬워진다.

---

#### 20. 데이터셋 메타가 두 곳에 하드코딩되어 있다

`AdminUploadController.datasetSummaries()`(216행)와 `app.js` `datasetFieldSchemas`(99행)에 동일한 메타가 이중 정의되어 있다. 한쪽을 바꿀 때 다른 쪽을 놓치면 불일치가 발생한다.  
**수정 방향** DB `dataset` 테이블 또는 공유 설정을 단일 출처로 사용.

---

### F. 테스트 커버리지 — 심각도 Medium

| 구분 | 개수 |
|------|------|
| 메인 클래스 | 32개 |
| 테스트 클래스 | 5개 |

JDBC 저장소(트랜잭션·DELETE+INSERT 경로), 수집 서비스(재시도·마스킹·busy 가드), 컨트롤러 인증 경로에 테스트가 없다. 프론트는 0개. 항목 A·B는 테스트로 회귀를 고정해야 한다.

---

### 잘 된 점 — 유지할 것

| 항목 | 위치 | 내용 |
|------|------|------|
| CSV 인코딩 폴백 | `AdminUploadController.decodeCsv()` | UTF-8 실패 시 MS949로 재시도, BOM 처리까지 견고함 |
| API 키 마스킹 | `RequestUrlMasker`, `maskKnownSecrets()` | 로그·URL에서 키를 일관되게 숨김 |
| PostGIS 공간 인덱스 | `schema.sql` 83·111·180행 | GIST 인덱스가 주요 geometry 컬럼에 모두 잡혀 있음 |
| 정적 서버 경로 탈출 방어 | `serve-static.mjs` 26행 | `filePath.startsWith(rootWithSeparator)` 검사가 정확함 |
| 업로드 행/열 수 대조 | `AdminUploadController.validateCommitCounts()` 307행 | 클라이언트 위변조를 프리뷰 데이터와 대조해 차단 |
| 기동 가드 | `AdminCredentialGuard.java` | 기본 비밀번호로 DB 모드 기동 차단 |

---

## Part 2. 추가 기능 제안

| 우선순위 | 기능 | 가치 | 난이도 | 근거 |
|----------|------|------|--------|------|
| 1 | **지도 bbox·카테고리 서버사이드 필터 + 페이징** | 高 | 中 | 리뷰 항목 11 해결, 데이터 증가에 대응 |
| 2 | **대기질 세부 지표 완성** (pm10/pm25 노출) | 高 | 低 | 리뷰 항목 4. `value_json` 파싱만으로 즉시 구현 가능 |
| 3 | **DB 기반 관리자 계정 + 감사 로그** | 高 | 中 | 이미 있는 `admin` 테이블 활용, 인메모리 계정 탈피 |
| 4 | **PostGIS 실연산 반경/권역 상권 분석** | 高 | 中 | `commercial_analysis_snapshot`·`ST_DWithin` 기반 mock 대체 |
| 5 | **데이터셋 메타 단일화 API** | 中 | 低 | 리뷰 항목 20. 하드코딩 이중 관리 제거 |
| 6 | **공개 데이터 CSV/GeoJSON 다운로드 + OpenAPI 문서** | 中 | 低 | 데이터 플랫폼 정체성에 부합 |
| 7 | **수집 스케줄 상태 대시보드** | 中 | 低 | 이미 쌓는 `dataset_collection_log` 활용, 다음 실행·최근 실패 사유 표시 |

---

## Part 3. 성능 개선 방안

### 단기 (코드 변경만 필요)

| 방안 | 파일 | 예상 효과 |
|------|------|-----------|
| 수집 경로 `@Transactional` + `batchUpdate` 전환 | `JdbcPublicDataRepository.java` | 정합성 보장 + INSERT 처리량 수 배 향상 |
| 프론트 타임아웃 450ms → 1,500ms, `Promise.allSettled` 도입 | `app.js` 24행, 276행 | 실데이터 노출률 상승, 부분 실패 시 폴백 최소화 |
| `toJson` → `objectMapper.writeValueAsString` | `JdbcPublicDataRepository.java` 694행 | 직렬화 안전성 확보, 성능도 동등 이상 |
| `facility.color` escapeHtml 적용 | `app.js` 486행 | 일관성 확보 |

### 중기 (설계 변경 필요)

| 방안 | 파일 | 예상 효과 |
|------|------|-----------|
| 목록 API bbox/카테고리/페이징 파라미터 | `JdbcPublicDataRepository.java`, `FacilityController`, `PublicDataController` | 데이터 증가에 페이로드·렌더 비용 선형 차단 |
| 업로드 드래프트 디스크화 | `AdminUploadController.java`, `CsvUploadDraft.java` | 힙 사용량 ~250MB → ~수 MB 급감, OOM 방지 |
| Excel 스트리밍 파서 (`SXSSFWorkbook`/SAX) | `ExcelUploadParser.java` | 대용량 Excel 업로드 메모리 부담 제거 |

### DB 인덱스 추가 (마이그레이션)

```sql
-- API 로그 최신 조회 최적화 (latestApiLogsByDataset 쿼리)
CREATE INDEX idx_collection_log_type_started
    ON dataset_collection_log(collection_type, started_at DESC);

-- jsonb 컬럼 GIN 인덱스 (properties/value_json 조회 시)
CREATE INDEX idx_store_business_properties ON store_business USING GIN (properties);
CREATE INDEX idx_indicator_value_json ON indicator_value USING GIN (value_json);
```

---

## 권장 실행 순서

```
1단계 — 데이터 정합성 핫픽스
  ├─ 수집 replaceStoreBusinesses/replaceAirQualitySnapshot @Transactional 추가 (항목 1)
  ├─ toJson → objectMapper 교체 (항목 3)
  └─ 회귀 테스트 추가

2단계 — 보안 하드닝
  ├─ anyRequest().denyAll() 로 변경 (항목 5)
  └─ AdminCredentialGuard DB 비밀번호 검사 추가 (항목 8)

3단계 — 체감 성능 개선
  ├─ 프론트 타임아웃 완화 + allSettled (항목 9·10)
  └─ 대기질 세부값 노출 (항목 4)

4단계 — 확장성 대응
  ├─ 배치 인서트 전환 (항목 2)
  ├─ 목록 API bbox 페이징 (항목 11)
  └─ 업로드 드래프트 디스크화 (항목 12)

5단계 — 구조/기능
  ├─ 데이터셋 메타 단일화 (항목 20)
  └─ DB 기반 관리자 계정 (항목 7)
```

---

## 검증 방법

```powershell
# 백엔드 단위/통합 테스트 (현재 4개, 위 핫픽스 후 회귀 케이스 추가)
cd backend-egovframe-skeleton
.\.tools\mvn\bin\mvn test

# 로컬 전체 상태 확인
.\scripts\check-local-status.ps1

# 업로드 흐름 확인
.\scripts\check-admin-upload.ps1
```

트랜잭션 롤백 검증은 중간 INSERT에 강제 예외를 주입해 DELETE까지 롤백되는지 확인한다.  
프론트는 백엔드를 끈 상태와 인위적 지연 상태 두 경우로 `http://localhost:3000` 폴백·점진 렌더 동작을 육안 확인한다.

## 이번 반영

- 공공데이터 저장 경로에 `@Transactional`을 적용하고, `toJson()`을 `ObjectMapper` 기반 직렬화로 교체했다.
- `store_business`와 `indicator_value` 저장 경로, 그리고 관리자 업로드 저장 경로를 배치 인서트로 바꿨다.
- 대기질 조회에서 `pm10`, `pm25`, `nitrogen`, `ozone`, `carbon`, `sulfurous`를 다시 채우고, 관측시각 파싱 실패 시 `null`을 보존하도록 바꿨다.
- 보안 설정을 `denyAll()` 기본 거부로 바꾸고, DB 비밀번호 가드도 추가했다.
- 프론트의 공공데이터 폴백을 `Promise.allSettled` 기반 부분 성공 처리로 바꾸고, 타임아웃을 1,500ms로 완화했다.
- 부분 성공/실패 원인(`sourceModeError`)은 데이터 모드에 "일부 지연"으로 표시하고, 상세 원인은 `title`로 확인할 수 있게 연결했다.
- `facility.color`를 HTML 이스케이프로 통일하고, 죽은 `safeLower` 메서드를 제거했다.
- 좌표가 없는 행도 안전하게 처리되도록 PostGIS geometry INSERT의 좌표 파라미터에 `double precision` 캐스팅을 명시했다.
- Maven 테스트 컴파일이 메인 클래스를 안정적으로 참조하도록 테스트 소스 루트에 `src/main/java`를 추가했다.
- `mvn test`와 `node --check frontend-static/app.js`가 통과했다.
