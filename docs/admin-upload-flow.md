# Admin Upload Flow

관리자 CSV 업로드 기능의 현재 진행 상태와 다음 작업을 정리합니다.

## 현재 구현

- 위치: `frontend-static` 관리자 영역
- 방식: 백엔드 preview API를 먼저 호출하고, 백엔드 연결 실패 시 브라우저에서 CSV 파일을 읽어 로컬 미리보기로 전환
- 파일 형식: CSV는 미리보기/매핑/확정 가능, Excel은 파일 선택과 형식 감지만 지원하며 CSV 변환 안내 표시
- 데이터셋 관리: 관리자 영역에서 데이터명, 분야, 출처, 갱신주기, 업로드 방식, 공개 여부, 매핑 필요 여부를 mock으로 편집
- 업로드 대상 반영: 화면 공개 상태이고 업로드 방식에 CSV가 포함된 데이터셋만 파일 업로드 선택 목록에 표시
- 인코딩: UTF-8 BOM CSV와 EUC-KR/MS949 계열 CSV를 모두 읽을 수 있도록 처리
- 컬럼 매핑: 데이터셋별 표준 필드 자동 매핑, 관리자 수동 변경, 필수 필드 누락/중복 검증
- 저장: mock commit API 우선 호출, 실패 시 최근 업로드 로그 5건을 브라우저 `localStorage`에 저장
- DB 저장 일반 프로파일: `uploaded_file`, `dataset_collection_log`에 업로드 확정 기록 저장
- 시설 반영: `facilities` 데이터셋은 preview에서 발급된 `uploadId`로 CSV 행을 찾아 `facility` 테이블에 적재
- 원본 보관: 일반 프로파일에서는 CSV 원본을 `UPLOAD_BASE_PATH/admin-csv/{datasetKey}/{yyyyMMdd}/{fileId}-{fileName}`에 저장
- 로그 표시: 성공/실패/로컬 저장 상태를 관리자 최근 업로드 로그에서 구분 표시
- API 로그: 최근 수집 실행 내역을 mock 데이터로 필터/검색 가능하게 표시
- 확정 후 갱신: 시설 데이터셋 업로드 확정 성공 시 생활시설 목록과 지도를 다시 불러옴
- 오류 안내: 백엔드 검증 실패, 인증 실패, 로컬 미리보기를 구분해 화면에 표시
- 샘플 파일: `frontend-static/assets/data/sample-facilities.csv`
- 백엔드 코드: `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin`

## 1차 사용자 흐름

1. 관리자가 데이터셋을 선택합니다.
2. CSV 파일을 선택합니다.
3. 화면에서 파일명, 행 수, 컬럼 수를 확인합니다.
4. 첫 5행 미리보기로 컬럼 구조를 확인합니다.
5. 컬럼 매핑에서 CSV 컬럼과 표준 필드를 확인하거나 수정합니다.
6. 필수 필드 매핑이 끝나면 업로드 확정이 가능합니다.
7. 최근 업로드 로그가 쌓입니다.

## 시설 CSV 권장 컬럼

```text
id
category
name
address
phone
latitude
longitude
source
```

## 백엔드 전환 필요 API

```text
GET  /api/admin/datasets
POST /api/admin/uploads/preview
POST /api/admin/uploads/commit
GET  /api/admin/collection-logs
```

현재 프론트는 CSV 선택 후 `/api/admin/uploads/preview`를 먼저 호출합니다. 백엔드가 꺼져 있거나 preview API가 실패하면 브라우저 로컬 미리보기로 자동 전환합니다.

업로드 확정 버튼은 `/api/admin/uploads/commit`을 호출합니다. 백엔드 preview가 성공한 경우 응답의 `uploadId`를 commit 요청에 포함해 실제 CSV 행을 저장합니다.

Mock 프로파일 관리자 계정:

```text
ID: admin
PW: admin1234
```

백엔드가 실행 중일 때 관리자 업로드 API 확인:

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\check-admin-upload.ps1
```

DB 모드 통합 확인:

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\apply-db.ps1 -Mode fresh -WithSeed
.\scripts\run-backend-db.ps1
```

다른 PowerShell 창에서:

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform
.\scripts\check-db-upload.ps1
```

## DB 연결 대상

- `dataset`
- `uploaded_file`
- `dataset_collection_log`
- `facility`

## CSV 원본 저장 정책

- 환경변수: `UPLOAD_BASE_PATH`
- 기본값: `./uploads`
- 저장 경로: `UPLOAD_BASE_PATH/admin-csv/{datasetKey}/{yyyyMMdd}/{fileId}-{fileName}`
- DB 기록: `uploaded_file.stored_file_path`
- 로컬 개발에서는 `uploads/` 폴더를 버전 관리하지 않습니다.

초기 mock 데이터는 아래 순서로 적용합니다.

```text
database/schema.sql
database/seed-mock.sql
```

이미 `schema.sql`을 적용한 DB라면 아래 파일로 업로드 저장 컬럼만 추가합니다.

```text
database/migration-20260602-admin-upload.sql
```

## 다음 작업

1. PostgreSQL/PostGIS 설치 후 DB 모드 통합 검증
2. Excel 파서 도입 검토 및 구현
3. 업로드 실패 로그의 상세 사유 DB 저장
