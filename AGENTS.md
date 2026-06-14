# Repository Guidelines

## Project Structure & Module Organization
이 저장소는 실행 경계 기준으로 구성되어 있습니다. `frontend-static/`에는 정적 MVP UI(`index.html`, `styles.css`, `js/`, `assets/data`)가 있습니다. `backend-egovframe-skeleton/`은 Spring Boot 3.4 / Java 17 기반 백엔드이며, 소스는 `src/main/java/kr/go/geumcheon/dataplatform/...`, 테스트는 `src/test/java`에 있습니다. `database/`는 스키마와 마이그레이션 SQL, `scripts/`는 로컬 실행용 PowerShell 스크립트, `docs/`는 로드맵과 운영 문서를 담습니다. `target/`, `uploads/`, `.tmp/`는 생성 산출물로 보고 직접 수정하지 않습니다.

## Build, Test, and Development Commands
가능하면 개별 명령보다 저장소의 스크립트를 우선 사용합니다.

- `cd frontend-static && node serve-static.mjs`: 정적 프런트엔드를 `http://localhost:3000`에서 실행합니다.
- `.\scripts\run-backend-mock.ps1`: 백엔드를 mock 모드로 `http://localhost:8080`에서 실행합니다.
- `.\scripts\build-backend.ps1`: 저장소 내 Java/Maven 설정으로 백엔드 JAR를 빌드합니다.
- `.\scripts\apply-db.ps1 -Mode fresh -WithSeed`: PostgreSQL/PostGIS 스키마를 재생성하고 시드 데이터를 넣습니다.
- `.\scripts\run-backend-db.ps1`: DB 연결 모드로 백엔드를 실행합니다.
- `cd backend-egovframe-skeleton && mvn test`: Maven이 준비된 환경에서 JUnit 테스트를 실행합니다.

## Coding Style & Naming Conventions
각 모듈의 기존 스타일을 우선 따릅니다. Java는 4칸 들여쓰기, 프런트엔드 JS/CSS/HTML은 2칸 들여쓰기를 사용합니다. Java 패키지는 `kr.go.geumcheon.dataplatform.<domain>` 형식을 유지하고, 클래스명은 `PascalCase`, 메서드와 필드는 `lowerCamelCase`를 사용합니다. PowerShell 스크립트는 `check-local-status.ps1`처럼 kebab-case로 작성합니다. 클래스는 `FacilityController`, `RequestUrlMasker`처럼 도메인 역할이 분명하게 드러나도록 작게 유지합니다.

## Testing Guidelines
백엔드 테스트는 `spring-boot-starter-test` 기반의 JUnit 5를 사용하며, 단언은 AssertJ 스타일을 따릅니다. 테스트 파일은 `backend-egovframe-skeleton/src/test/java` 아래에 두고, `ExcelUploadParserTest`처럼 대상 클래스명에 맞춰 `*Test.java`로 작성합니다. 컨트롤러, 파서, 보안 설정, 공공데이터 수집 로직을 변경할 때는 관련 회귀 테스트를 함께 추가하거나 갱신합니다. 별도 커버리지 기준은 없으므로, 변경된 동작을 직접 검증하는 집중형 테스트를 우선합니다.

## Commit & Pull Request Guidelines
현재 작업 스냅샷에서는 `.git` 이력이 노출되지 않아 저장소 고유의 커밋 규칙을 확인할 수 없었습니다. 따라서 `Add DB upload validation`, `Fix public data sync error handling`처럼 짧은 명령형 제목을 기본 규칙으로 사용합니다. Pull Request에는 변경 요약, 영향받는 경로, 로컬 검증 방법, 연결된 이슈를 포함하고, `frontend-static/`의 UI가 바뀌면 스크린샷도 함께 첨부합니다.

## Security & Configuration Tips
환경 변수는 `.env.example`을 기준으로 맞추고, 실제 API 키는 절대 저장소에 커밋하지 않습니다. 공공데이터 동기화를 실행할 때는 `.\scripts\sync-public-data.ps1` 실행 전에 셸에서 `DATA_GO_KR_API_KEY`, `SEOUL_OPEN_API_KEY`, `COLLECTOR_ENABLED`를 먼저 설정합니다.
