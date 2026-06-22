# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

금천구 도시·생활·상권 데이터 플랫폼. Spring Boot 백엔드 + Vanilla JS 정적 SPA 구성. Mock 모드(DB 없이 즉시 실행)와 PostgreSQL/PostGIS DB 모드를 모두 지원한다.

## 빠른 실행

```powershell
# 프론트엔드 (PowerShell 창 1)
cd frontend-static
node serve-static.mjs        # http://localhost:3000

# 백엔드 Mock 모드 (PowerShell 창 2)
.\scripts\run-backend-mock.ps1   # http://localhost:8080

# 전체 상태 확인
.\scripts\check-local-status.ps1
```

스크립트가 Maven/Java를 자동 탐색한다. 빌드 전 서버가 실행 중이면 반드시 먼저 종료해야 한다(JAR 잠금).

## 테스트

```powershell
# 전체 테스트 (Maven 경로가 PATH에 있을 때)
mvn -f backend-egovframe-skeleton/pom.xml test

# Maven이 PATH에 없을 경우 (Windows Downloads 폴더 탐색)
$mvn = (Get-ChildItem "$env:USERPROFILE\Downloads" -Recurse -Filter mvn.cmd | Select-Object -First 1).FullName
& $mvn -f backend-egovframe-skeleton/pom.xml test

# 특정 테스트 클래스만 실행
& $mvn -f backend-egovframe-skeleton/pom.xml test -Dtest=PublicDataCollectorServiceTest
```

프론트엔드는 빌드 없이 브라우저 새로고침으로 반영된다.

## 환경 변수

`.env.example` 기준. `.env` 파일로 관리하며 커밋하지 않는다.

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `DB_*` | PostgreSQL 연결 | localhost:5432/geumcheon_data |
| `DATA_GO_KR_API_KEY` | 상가·인구 API | — |
| `SEOUL_OPEN_API_KEY` | 대기질·자전거·CCTV·주차 API | — |
| `COLLECTOR_ENABLED` | 수집 실행 허용 | `false` |
| `CORS_ALLOWED_ORIGINS` | CORS 허용 출처 | `http://localhost:3000` |

공공데이터 수동 수집:
```powershell
$env:COLLECTOR_ENABLED = "true"
.\scripts\sync-public-data.ps1                       # 전체 6종
.\scripts\sync-public-data.ps1 -DatasetKey stores    # 특정 소스만
```

---

## 아키텍처

### 프론트엔드 부트 시퀀스

`main.js`의 `bootData()`가 3단계로 실행된다.

1. **로컬 Mock 우선** — `assets/data/mock-data.json`을 즉시 읽어 `state.data`에 저장 → 홈 페이지 렌더.
2. **API 소스/로그 로드** — `/api/public/api-sources`, `/api/public/api-logs` 병렬 호출.
3. **백엔드 데이터 병합** — `/api/public/stores`, `/api/public/facilities` 등 1.5초 타임아웃 내 응답을 로컬 데이터에 병합. 실패하면 로컬 데이터 유지.

백엔드 연결 실패 시에도 Mock 데이터로 완전히 동작한다.

### 프론트엔드 모듈 구조

해시 기반 SPA. `router.js`가 `#/<route>` 해시를 감지해 `pages/<page>.js`를 마운트·언마운트한다. 각 페이지 모듈은 `mount(container)` / `unmount()` 를 export한다.

**`js/core/`** — 페이지 간 공유 모듈.

| 파일 | 핵심 역할 |
|------|-----------|
| `state.js` | 전역 `state` 객체 + 앱 상수. `BACKEND_API_BASE = "http://localhost:8080"` 고정. 모든 페이지가 여기서 import한다. |
| `api.js` | 백엔드 API 호출 + 폴백 로직. `state`에 직접 쓰지 않고 값을 반환만 한다. |
| `choropleth.js` | Leaflet 단계구분도 레이어 생성·갱신·범례 렌더링. `map.js`와 `home.js` 공용. |
| `assets.js` | `injectPageCss(id, href)` · `loadLeaflet()` — 중복 주입 방지 멱등 로더. |
| `charts.js` | ECharts 래퍼. `loadECharts()` → `createChart()` → `disposeChart()` 패턴. |

**`js/pages/`** — 라우트별 페이지 모듈. `home.js`의 HTML 템플릿 빌더는 `home-templates.js`로 분리되어 있다.

### 백엔드 API 응답 형식

모든 REST 응답은 `ApiResponse<T>` 레코드로 감싼다.

```json
{ "success": true, "data": [...], "message": null, "timestamp": "...", "sourceMode": "mock" | "db" }
```

`sourceMode`는 `geumcheon.runtime.mode` 프로퍼티에서 온다. 프론트엔드 `api.js`는 `payload?.success && Array.isArray(payload.data)` 조건으로 응답을 검증한다.

### 백엔드 Mock/DB 이중 구현

같은 인터페이스에 `Mock*Repository`와 `Jdbc*Repository`가 공존한다.

- `--spring.profiles.active=mock` → `MockPublicDataRepository`, `MockAdminUploadStore` 활성. DataSource 자동 설정이 **exclude**되어 DB 없이 실행된다.
- `--spring.profiles.active=db` → `JdbcPublicDataRepository`, `JdbcAdminUploadStore` 활성.

새 도메인 추가 시 Mock 구현을 먼저 작성하고 Jdbc 구현을 붙이는 패턴을 따른다.

### DatasetRegistry (단일 카탈로그)

`DatasetRegistry`(`@Component`)가 모든 데이터셋의 정의(이름·도메인·API 가능 여부·필드 스키마 등)를 담는 중앙 카탈로그다. `PublicDataCollectorService`, `AdminUploadController`, `DatasetController` 모두 여기서 메타를 조회한다. 새 데이터셋을 추가할 때는 여기에 `DatasetDefinition`을 등록해야 한다.

### 공공데이터 수집 파이프라인

`PublicDataCollectorService.runSyncPipeline()` 템플릿 메서드가 6개 수집 소스(stores·air-quality·bike-stations·cctv-stations·parking-lots·population)의 공통 골격(spec 조회 → URL 생성 → API 키 검사 → 수집 → 저장 → 로그 기록 → 결과 반환)을 처리한다. 각 `syncXxx()` 메서드는 `RowFetcher`·`RowSaver` 람다만 주입한다.

수집은 `COLLECTOR_ENABLED=true` 설정 없이는 실행되지 않는다(Mock 모드에서는 강제로 `false`).

### 관리자 API 인증

`/api/admin/**` 엔드포인트는 HTTP Basic 인증을 요구한다. Mock 모드 기본 자격증명: `admin` / `admin1234`. DB 모드에서는 `AdminCredentialGuard`가 환경 변수에서 자격증명을 읽는다.

---

## 코딩 규칙

- 새 소스 파일 첫 줄: 역할을 설명하는 한 줄 한국어 주석.
- Java 들여쓰기 4칸, 프론트엔드 JS/CSS/HTML 2칸.
- PowerShell 스크립트명: `kebab-case.ps1`.

## 하위 모듈 CLAUDE.md

각 모듈에 세부 지침이 있다.

- `backend-egovframe-skeleton/CLAUDE.md` — 패키지 구조, 테스트 위치, 수집 스크립트
- `frontend-static/CLAUDE.md` — 페이지 모듈 목록, Mock 데이터 파일
- `database/CLAUDE.md` — 스키마 적용, 마이그레이션 절차
