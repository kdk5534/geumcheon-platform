# P3 PostgreSQL/PostGIS Setup Guide

이 문서는 P3 `실제 DB 모드 전환`을 진행할 때 필요한 순서를 한 번에 볼 수 있게 정리한 안내서입니다.

## 목표

- PostgreSQL/PostGIS를 설치한다
- `geumcheon_data` 데이터베이스를 만든다
- `geumcheon` 사용자를 만든다
- 스키마와 mock seed를 적용한다
- backend DB 모드로 실행한다
- 업로드 검증 스크립트로 실제 저장을 확인한다

## 1. 먼저 확인할 것

- PostgreSQL 서버가 실행 중이어야 합니다
- `psql` 명령이 PowerShell에서 잡혀 있어야 합니다
- PostGIS 확장이 같은 PostgreSQL 인스턴스에 설치되어 있어야 합니다
- Java 17과 Apache Maven 3.9 이상이 필요합니다

확인 명령:

```powershell
psql --version
```

## 2. 권장 로컬 설정

- host: `localhost`
- port: `5432`
- database: `geumcheon_data`
- user: `geumcheon`
- password: 로컬 전용 비밀번호

환경변수 예시:

```powershell
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "geumcheon_data"
$env:DB_USERNAME = "geumcheon"
$env:DB_PASSWORD = "your-local-password"

$env:ADMIN_INITIAL_LOGIN_ID = "admin"
$env:ADMIN_INITIAL_PASSWORD = "replace-with-a-strong-password"
$env:ADMIN_INITIAL_NAME = "초기 관리자"
$env:ADMIN_INITIAL_EMAIL = ""
$env:CORS_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
$env:UPLOAD_BASE_PATH = (Join-Path (Get-Location) "uploads")
```

새 PowerShell 창을 열면 이 값들을 다시 설정해야 합니다.

## 3. PostgreSQL과 PostGIS 설치

1. PostgreSQL을 설치합니다.
2. 같은 버전에 맞는 PostGIS를 설치합니다.
3. `psql`이 PATH에 잡혔는지 다시 확인합니다. 안 잡히면 아래처럼 바로 실행할 수 있습니다.

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version
```

또는 현재 PowerShell 세션에만 경로를 추가할 수 있습니다.

```powershell
$env:PATH = "C:\Program Files\PostgreSQL\18\bin;$env:PATH"
psql --version
```

4. Java 17과 Maven도 확인합니다.

```powershell
java -version
mvn -version
```

둘 중 하나라도 안 되면 `run-backend-db.ps1`가 백엔드를 올리지 못합니다.

설치가 끝나면 데이터베이스에 접속해서 확장을 준비합니다.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## 4. 사용자와 데이터베이스 만들기

관리자 계정으로 접속한 뒤 아래 순서로 실행합니다.

연결 예시:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d postgres
```

비밀번호를 물으면 PostgreSQL 설치 때 설정한 `postgres` 비밀번호를 입력합니다.

```sql
CREATE USER geumcheon WITH PASSWORD 'your-local-password';
CREATE DATABASE geumcheon_data OWNER geumcheon;
\c geumcheon_data
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

이미 DB가 있으면 `CREATE DATABASE` 단계는 건너뛰고, 확장만 다시 확인하면 됩니다.

## 5. 스키마와 seed 적용

새로 시작할 때:

```powershell
cd <repo-root>
.\scripts\apply-db.ps1 -Mode fresh -WithSeed
```

이미 스키마와 마이그레이션은 들어갔고 씨드만 다시 넣어야 할 때:

```powershell
cd <repo-root>
.\scripts\apply-db.ps1 -Mode seed
```

기존 DB에 마이그레이션만 반영할 때:

```powershell
cd <repo-root>
.\scripts\apply-db.ps1 -Mode migrate
```

`fresh`는 baseline 스키마 뒤에 후속 마이그레이션까지 이어서 적용하고, `-WithSeed`를 붙이면 mock 데이터도 넣습니다.
DB 모드 백엔드는 시작 시 Flyway로 같은 순서의 마이그레이션을 다시 확인합니다. 이미 수동으로 구성된 기존 DB라면 `baseline-on-migrate` 로 이력을 맞춘 뒤 idempotent 마이그레이션만 이어서 반영합니다.

## 6. backend DB 모드 실행

```powershell
cd <repo-root>
.\scripts\run-backend-db.ps1
```

이 스크립트는 `DB_*`, `ADMIN_INITIAL_*`, `UPLOAD_BASE_PATH` 환경변수를 읽어서 실행합니다.
환경변수를 바꿨다면 backend와 검증 스크립트에 같은 값이 들어가야 합니다.

## 7. 검증

```powershell
cd <repo-root>
.\scripts\check-db-upload.ps1
```

정상이라면 아래가 모두 통과해야 합니다.

- `/actuator/health`
- `/api/public/datasets`
- `/api/public/facilities`
- `/api/admin/collection-logs`
- CSV preview
- CSV commit
- DB 저장 파일 경로 존재 확인

## 8. 자주 막히는 부분

- `psql was not found`
  - PostgreSQL client tools가 설치되지 않았거나 PATH에 없습니다
- `FATAL: database "geumcheon_data" does not exist`
  - 데이터베이스를 먼저 만들고 다시 실행해야 합니다
- `extension "postgis" is not available`
  - PostGIS 패키지가 아직 설치되지 않았습니다
- `Admin API returned 401`
  - backend와 검증 스크립트의 `ADMIN_INITIAL_*` 값이 서로 다릅니다
- `db_latest_file_exists=False`
  - `UPLOAD_BASE_PATH`가 쓰기 가능한 폴더인지 확인해야 합니다

## 9. 관련 스크립트

- [`scripts/apply-db.ps1`](../scripts/apply-db.ps1)
- [`scripts/run-backend-db.ps1`](../scripts/run-backend-db.ps1)
- [`scripts/check-db-upload.ps1`](../scripts/check-db-upload.ps1)

## 10. 인덱스 메모

- `dataset_collection_log(collection_type, started_at DESC)` 인덱스는 최근 수집 로그 조회 쿼리용으로 반영했습니다.
- `store_business.properties`, `indicator_value.value_json` 용 GIN 인덱스는 아직 보류했습니다.
- 현재 코드베이스에는 이 jsonb 컬럼들을 `WHERE` 조건으로 조회하는 경로가 없고, 선택 목록/원본 파싱 용도로만 읽고 있어 쓰기 비용만 먼저 늘릴 가능성이 큽니다.
- jsonb 조건 검색 API가 추가되면 그때 실제 쿼리 패턴에 맞춰 GIN 인덱스를 넣는 쪽이 안전합니다.
