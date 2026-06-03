# Geumcheon Data Platform

금천구 도시·생활·상권 데이터 플랫폼 개발 뼈대입니다.

현재 단계는 API 키 없이도 개발 가능한 MVP 구조입니다. 지금은 PostgreSQL/PostGIS 설치를 보류하고, mock 모드에서 화면과 관리자 업로드 기능을 먼저 다듬는 흐름입니다.

전체 진행 상황과 다음 우선순위는 아래 문서를 기준으로 봅니다.

```text
docs/project-roadmap.md
```

## Structure

```text
backend-egovframe-skeleton/
  eGovFrame/Spring 기반 백엔드 뼈대

frontend-static/
  별도 설치 없이 바로 실행 가능한 프론트 MVP

database/
  PostgreSQL + PostGIS 스키마 초안

docs/
  기능정의서, 데이터 목록표, 환경변수, 다음 작업 문서
```

## Quick Start: Mock Mode

PowerShell 창을 2개 열어 실행합니다.

### 1. Frontend

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform\frontend-static
node serve-static.mjs
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000
```

프론트는 `http://localhost:8080` 백엔드 mock API가 켜져 있으면 해당 API를 우선 사용하고, 꺼져 있으면 기존 로컬 Mock JSON으로 자동 전환됩니다.

### 2. Backend Mock API

프로젝트 내부 `.tools`에 포함된 Java 17과 Maven을 사용합니다.

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\run-backend-mock.ps1
```

이 창은 서버가 켜져 있는 동안 계속 열어둡니다.

Mock API:

```text
GET http://localhost:8080/api/public/datasets
GET http://localhost:8080/api/public/facilities
GET http://localhost:8080/actuator/health
```

다른 PowerShell 창에서 응답 확인:

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\check-backend.ps1
```

전체 로컬 상태를 한 번에 확인:

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\check-local-status.ps1
```

## Current Development Status

완료:

- 프론트 MVP 화면
- 백엔드 mock API
- 관리자 CSV 업로드 UI
- CSV 한글 인코딩 대응
- 컬럼 매핑/검증
- 업로드 로그
- 데이터셋 목록/상세 mock 관리 화면
- 공개/숨김, 업로드 방식, 컬럼 매핑 필요 여부의 mock 반영
- API 수집 상태 mock 화면
- API 수집 로그 mock 화면
- API 로그 재수집 mock 액션
- DB 저장용 스키마와 코드 준비
- Excel 파일 선택 시 깨진 미리보기가 나오지 않도록 안내 처리

보류:

- PostgreSQL/PostGIS 설치 및 실제 DB 모드 검증
- 실제 Excel 파싱
- 외부 공공데이터 API 자동 수집

지금의 다음 우선순위는 `docs/project-roadmap.md`의 P4 API 수집 로그 mock 화면입니다. P3 실제 DB 모드 전환은 PostgreSQL/PostGIS 설치 전까지 계속 보류합니다.

## Important Files

```text
.env.example
docs/mvp-spec.md
docs/project-roadmap.md
docs/data-inventory.csv
docs/admin-upload-flow.md
docs/env-and-next-steps.md
database/schema.sql
database/seed-mock.sql
backend-egovframe-skeleton/pom.xml
backend-egovframe-skeleton/src/main/resources/application-mock.yml
backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin
frontend-static/index.html
frontend-static/assets/data/sample-facilities.csv
scripts/run-backend-mock.ps1
scripts/check-backend.ps1
scripts/check-local-status.ps1
scripts/check-admin-upload.ps1
```

## Backend Note

Java/Maven은 시스템 전역이 아니라 프로젝트 내부 `.tools`에 구성했습니다.

운영형 개발 전에 필요한 설치 항목:

- PostgreSQL
- PostGIS

현재 백엔드는 Maven 기준 `pom.xml`로 만들어져 있어 Gradle은 필수가 아닙니다.

## When Backend Jar Is Locked

백엔드를 실행 중인 PowerShell 창이 있으면 `target\data-platform-0.1.0-SNAPSHOT.jar` 파일이 잠깁니다. 이 상태에서는 새로 빌드하거나 jar 파일을 갱신할 수 없습니다.

백엔드 변경사항을 반영할 때는 아래 순서로 진행합니다.

1. 백엔드를 실행 중인 PowerShell 창에서 `Ctrl + C`로 서버를 종료합니다.
2. 필요한 빌드/반영 작업을 진행합니다.
3. 다시 mock 모드로 실행합니다.

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\run-backend-mock.ps1
```

프론트 파일만 바뀐 경우에는 백엔드를 재시작할 필요가 없습니다. 브라우저에서 `http://localhost:3000`을 새로고침하면 됩니다.

## Run Backend DB Mode

PostgreSQL/PostGIS가 준비된 뒤 DB 스키마를 적용합니다.

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\apply-db.ps1 -Mode fresh -WithSeed
```

기존 DB에 업로드 컬럼만 반영할 때는 아래를 사용합니다.

```powershell
.\scripts\apply-db.ps1 -Mode migrate
```

DB 모드 백엔드 실행:

```powershell
.\scripts\run-backend-db.ps1
```

다른 PowerShell 창에서 업로드-DB 저장 흐름 확인:

```powershell
.\scripts\check-db-upload.ps1
```
