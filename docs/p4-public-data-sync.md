# P4 공공데이터 수집 실행

이 문서는 `stores` 와 `air-quality` 공공 API를 실제 DB로 넣는 방법을 정리합니다.

## 준비

- `DATA_GO_KR_API_KEY`
- `SEOUL_OPEN_API_KEY`
- 필요하면 `COLLECTOR_ENABLED=true`
- 백엔드가 `http://localhost:8080` 에서 실행 중이어야 함
- 관리자 인증은 `ADMIN_INITIAL_LOGIN_ID` / `ADMIN_INITIAL_PASSWORD` 를 사용함

## 실행

1. DB 모드 백엔드를 실행합니다. 예: `.\scripts\run-backend-db.ps1`
2. 새 PowerShell 창에서 아래 스크립트를 실행합니다.

```powershell
cd "C:\Users\Kwon dong geun\Desktop\geumcheon-platform"
.\scripts\sync-public-data.ps1
```

- `stores` 수집기는 `pageNo`/`totalCount` 기반으로 전체 페이지를 순회합니다.
- 필요하면 `COLLECTOR_STORE_PAGE_SIZE`, `COLLECTOR_STORE_MAX_PAGES`, `COLLECTOR_STORE_PAGE_DELAY_MILLIS` 로 호출 크기와 상한을 조정할 수 있습니다.
- 외부 공공데이터 호출은 모두 `https://` URL을 사용합니다.
- Geumcheon district-code endpoint migration remains deferred until the official primary path and parameters are confirmed; no code marker is left for this item.

특정 소스만 다시 수집하려면:

```powershell
.\scripts\sync-public-data.ps1 -DatasetKey stores
.\scripts\sync-public-data.ps1 -DatasetKey air-quality
```

자동 수집을 쓰려면 백엔드 시작 전에 `COLLECTOR_ENABLED=true` 를 넣어 두면 됩니다.  
키가 비어 있으면 상태는 `key-needed` 로 표시되고, 수집은 `skipped` 로 기록됩니다.

## 확인

- `GET /api/public/api-sources`
- `GET /api/public/api-logs`
- `GET /api/public/datasets`
- `GET /api/public/facilities`
- `POST /api/admin/public-data/sync`

실패하면 보통 아래 둘 중 하나입니다.

- API 키가 아직 없음
- 공공 API 응답 형식이 달라서 파싱이 막힘
- 백엔드가 아직 실행되지 않음
## 로그 마스킹 정책

- `dataset_collection_log.request_url`에는 실제 `ServiceKey`와 서울 열린데이터 키를 남기지 않는다.
- 관리자 동기화 응답의 `requestUrl`도 같은 마스킹 값을 사용한다.
- 현재 수집기는 외부 공공데이터 호출도 `https://` 경로로 고정하고, 비밀값은 계속 마스킹한다.

## 확인 방법

1. 더미 API 키를 설정한 뒤 `POST /api/admin/public-data/sync`를 실행한다.
2. 응답 JSON의 `requestUrl`에 실제 키가 없는지 확인한다.
3. `dataset_collection_log.request_url` 조회 결과에 실제 키가 없는지 확인한다.

## Retry and schedule settings

- `COLLECTOR_RETRY_COUNT` controls how many retries happen after the first failed API call.
- `COLLECTOR_RETRY_DELAY_SECONDS` sets the pause between retry attempts.
- `COLLECTOR_STORE_PAGE_SIZE` sets the number of store rows requested per page.
- `COLLECTOR_STORE_MAX_PAGES` caps how many store pages can be collected in one run.
- `COLLECTOR_STORE_PAGE_DELAY_MILLIS` adds a short pause between store page requests.
- `COLLECTOR_SCHEDULE_ENABLED=true` turns on scheduled collection runs.
- `COLLECTOR_CRON` sets the schedule, with a default of `0 0 4 * * *`.
- In mock mode, scheduling stays off even if the cron values are present.
