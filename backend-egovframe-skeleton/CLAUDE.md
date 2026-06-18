# CLAUDE.md — backend-egovframe-skeleton

Spring Boot 3.4 / Java 17 기반 백엔드. Java·Maven은 시스템 전역이 아닌 프로젝트 내부 `.tools`에 구성되어 있으므로 항상 루트 스크립트를 통해 실행합니다.

## 실행·빌드·테스트

```powershell
# Mock 모드 실행 (루트에서)
.\scripts\run-backend-mock.ps1          # http://localhost:8080

# DB 모드 실행
.\scripts\run-backend-db.ps1

# 빌드
.\scripts\build-backend.ps1

# 테스트
mvn test   # .tools/maven이 설정된 환경에서만 직접 실행 가능
```

> **JAR 잠금 주의.** 서버 실행 중에는 `target/data-platform-0.1.0-SNAPSHOT.jar`가 잠겨 빌드 불가. 백엔드 코드 변경 전 반드시 `Ctrl+C`로 서버를 먼저 종료하세요.

## 패키지 구조

루트 패키지: `kr.go.geumcheon.dataplatform`

| 패키지 | 역할 |
|--------|------|
| `admin` | CSV/Excel 업로드 파싱·컬럼 매핑·검증·드래프트 관리 |
| `publicdata` | 공공데이터 API 수집, 스케줄러, 수집 로그 |
| `dataset` | 데이터셋 메타 관리 |
| `facility` | 시설 데이터 CRUD |
| `config` | Spring Security, CORS, 관리자 인증 |
| `api` | 공개 API 컨트롤러 |

## Mock/DB 이중 구현 패턴

각 도메인에 `Mock*Repository`와 `Jdbc*Repository`가 공존합니다. `application-mock.yml`의 `geumcheon.runtime.mode` 프로퍼티로 활성 구현체를 전환합니다.

- Mock 모드: `--spring.profiles.active=mock` → `MockAdminUploadStore`, `MockPublicDataRepository` 활성.
- DB 모드: `--spring.profiles.active=db` → `JdbcAdminUploadStore`, `JdbcPublicDataRepository` 활성.

새 도메인 추가 시 같은 패턴으로 Mock 구현을 먼저 작성하고 Jdbc 구현을 붙입니다.

## 테스트

`src/test/java` 아래 `*Test.java` 파일. JUnit 5 + AssertJ 기반. 컨트롤러·파서·보안 설정·수집 로직 변경 시 관련 테스트를 함께 추가하거나 갱신합니다.

## 공공데이터 수동 수집 (P4)

```powershell
$env:DATA_GO_KR_API_KEY = "..."
$env:SEOUL_OPEN_API_KEY = "..."
$env:COLLECTOR_ENABLED = "true"
.\scripts\sync-public-data.ps1                       # 전체
.\scripts\sync-public-data.ps1 -DatasetKey stores    # 특정 소스만
```

상세 문서: `docs/p4-public-data-sync.md`
