# 금천구 데이터 플랫폼 배포 환경 가이드 v0.1

이 문서는 현재 저장소 기준으로 로컬 실행, 운영 배포, 비밀값 보관 원칙을 한 번에 정리한 안내서입니다.

## 1. 배포 구성

- `frontend-static/`: 정적 프론트엔드
- `backend-egovframe-skeleton/`: Spring Boot/eGovFrame 백엔드
- `database/`: PostgreSQL + PostGIS 스키마 초안
- `docs/`: 운영 절차와 데이터 정책 문서

권장 구조는 아래와 같습니다.

1. 프론트엔드는 정적 호스팅 또는 웹 서버에서 제공
2. 백엔드는 별도 애플리케이션 서버 또는 컨테이너로 실행
3. 데이터는 PostgreSQL + PostGIS에서 관리
4. 업로드 원본은 `UPLOAD_BASE_PATH` 아래 영구 저장소에 보관

## 2. 환경변수와 비밀값

초기 개발은 mock 값으로 돌아가지만, 운영에서는 아래 값을 서버 환경변수 또는 운영 Secret Manager에 넣습니다.

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geumcheon_data
DB_USERNAME=geumcheon
DB_PASSWORD=change-me

DATA_GO_KR_API_KEY=
SEOUL_OPEN_API_KEY=
VWORLD_API_KEY=
SGIS_API_KEY=
KOSIS_API_KEY=
WORKNET_API_KEY=

ADMIN_INITIAL_LOGIN_ID=admin
ADMIN_INITIAL_PASSWORD=replace-with-a-strong-password
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

UPLOAD_BASE_PATH=./uploads
MAX_UPLOAD_SIZE_MB=50
```

- API 키는 프론트 정적 파일에 두지 않습니다.
- 외부 API 키와 관리자 초기 계정은 서버 환경변수 또는 Secret Manager로만 주입합니다.
- 운영 환경에서는 저장소의 기본값 `change-me`를 그대로 쓰지 않습니다.

## 3. 로컬 실행

### 프론트만 실행

```powershell
cd <repo-root>\frontend-static
node serve-static.mjs
```

### 백엔드 mock 실행

```powershell
cd <repo-root>
.\scripts\run-backend-mock.ps1
```

### 상태 확인

```powershell
cd <repo-root>
.\scripts\check-local-status.ps1
```

## 4. 운영 배포

### 프론트엔드

- 정적 파일을 CDN, 웹 서버, 또는 정적 호스팅에 올립니다.
- `frontend-static`은 백엔드 주소만 바꾸면 재빌드 없이도 읽기 쉬운 구조를 유지합니다.

### 백엔드

- Spring Boot jar를 별도 프로세스로 실행합니다.
- 운영 프로필에서는 `application.yml`의 환경변수 값을 읽습니다.
- API 키는 서버 프로세스 밖으로 노출하지 않습니다.

### 데이터베이스

- PostgreSQL + PostGIS를 준비한 뒤 스키마를 적용합니다.
- 운영 전에는 백업과 복구 절차를 확인합니다.

### 업로드 원본

- `UPLOAD_BASE_PATH/admin-csv/{datasetKey}/{yyyyMMdd}/{fileId}-{fileName}` 구조를 유지합니다.
- 운영 파일 저장소는 백업 정책과 함께 관리합니다.

## 5. 배포 체크리스트

- [ ] 프론트 정적 파일에 비밀값이 남아 있지 않은지 확인
- [ ] `ADMIN_INITIAL_*` 기본값을 운영용 값으로 교체
- [ ] `DB_*`, `DATA_GO_KR_API_KEY`, `SEOUL_OPEN_API_KEY` 등 서버 환경변수 설정
- [ ] `UPLOAD_BASE_PATH`가 영구 저장소를 가리키는지 확인
- [ ] 백엔드 헬스 체크가 정상 응답하는지 확인
- [ ] 메인 화면과 관리자 화면에서 출처/기준시각이 보이는지 확인

## 6. 참고 문서

- [`README.md`](../README.md)
- [`docs/env-and-next-steps.md`](./env-and-next-steps.md)
- [`docs/admin-upload-flow.md`](./admin-upload-flow.md)
- [`backend-egovframe-skeleton/README.md`](../backend-egovframe-skeleton/README.md)

## Security notes

- The admin flow currently sends Basic auth from the browser rather than using cookie-based session auth, so classic CSRF risk is lower than with session cookies.
- Keep `CORS_ALLOWED_ORIGINS` limited to trusted admin origins and keep HTTPS/reverse-proxy rules in place for production.
- If the auth model moves to cookies or sessions later, re-enable CSRF protection as part of that migration.
