# GPT 5.4 Mini 작업 상세 계획

## 목적

이 문서는 금천구 데이터 플랫폼을 여러 관점의 페르소나로 검토한 결과를 실제 개발 작업으로 쪼갠 실행 계획이다. 작업자는 GPT 5.4 mini를 기준으로 하며, 한 번에 큰 리팩터링을 시도하지 않고 작은 작업 단위로 구현, 검증, 기록한다.

## 작업 원칙

- 한 번에 하나의 작업 ID만 진행한다.
- 작업 전 관련 파일을 먼저 읽고, 기존 구조와 스타일을 따른다.
- 기능 변경과 문서 변경을 섞지 않는다. 단, 검증 방법 업데이트는 해당 작업 안에서 허용한다.
- 사용자 변경분을 되돌리지 않는다.
- 운영 보안, 데이터 정합성, 화면 신뢰도를 우선한다.
- 각 작업 종료 시 실행한 검증과 남은 위험을 기록한다.

## 전체 우선순위

| 우선순위 | 작업 ID | 주제 | 이유 |
| --- | --- | --- | --- |
| P0 | T00 | 현재 상태 기준선 정리 | 작은 모델이 안전하게 이어받기 위한 출발점 |
| P1 | T01 | 업로드 가능 데이터셋과 실제 저장 동작 일치 | 성공처럼 보이는 허위 저장 위험 |
| P1 | T02 | 공공데이터 API 키 로그 노출 차단 | 운영 비밀값 유출 위험 |
| P1 | T03 | 프론트 HTML 삽입 지점 정리 | 업로드/백엔드 데이터 기반 XSS 위험 |
| P2 | T04 | DB 장애 시 mock 정상 응답 오해 방지 | 데이터 신뢰도와 운영 감시 문제 |
| P2 | T05 | 업로드 미리보기 메모리 보관 제한 | 반복 업로드 시 메모리 압박 |
| P2 | T06 | 시설 지도 마커 좌표 반영 | 지도/GIS 화면 신뢰도 문제 |
| P2 | T07 | 관리자 인증/CSRF/기본값 운영 안전장치 | 배포 실수 방지 |
| P3 | T08 | 공공데이터 수집 재시도/스케줄링 | 운영 자동화 완성도 |
| P3 | T09 | 테스트와 검증 스크립트 보강 | 회귀 방지 |

## 페르소나별 검토 관점

### 주민/일반 사용자

- 화면에 보이는 데이터가 최신인지 알 수 있어야 한다.
- mock 데이터와 실제 데이터가 혼동되지 않아야 한다.
- 지도 위치가 실제 위치와 크게 어긋나지 않아야 한다.
- 오류 상황에서도 의미 있는 안내를 받아야 한다.

### 담당 공무원/관리자

- 업로드 가능한 데이터셋만 선택할 수 있어야 한다.
- 업로드 성공 메시지는 실제 DB 저장과 일치해야 한다.
- 실패한 행, 누락된 필드, 저장된 행 수를 확인할 수 있어야 한다.
- 인증 만료와 권한 실패가 명확히 안내되어야 한다.

### 데이터 품질 담당자

- 필수 컬럼 누락, 중복 매핑, 좌표 오류가 저장 전에 잡혀야 한다.
- 일부 행만 저장되는 경우 저장/스킵 건수가 구분되어야 한다.
- 기존 데이터를 삭제한 뒤 새 데이터 저장에 실패하는 위험을 줄여야 한다.
- 수집 기준시각, 출처, 저장 로그가 일관되어야 한다.

### 보안 담당자

- API 키가 URL, DB 로그, 화면, 콘솔에 남지 않아야 한다.
- 관리자 기본 비밀번호가 운영에서 사용되지 않도록 막아야 한다.
- 업로드된 문자열이 HTML로 실행되지 않아야 한다.
- 관리자 변경 API에 CSRF/인증 정책이 명확해야 한다.

### GIS/공간분석가

- 위도/경도 기반 시설 위치가 지도에 반영되어야 한다.
- 지도 범위를 벗어난 좌표는 별도 표시 또는 제외되어야 한다.
- 행정동/집계구/상권 레이어는 선택 상태가 분명해야 한다.
- 좌표가 없는 시설은 지도와 목록에서 다르게 표현되어야 한다.

### 운영/SRE

- DB 장애가 조용히 mock 데이터로 숨겨지지 않아야 한다.
- 수집 실패와 재시도가 로그에 남아야 한다.
- 자동 수집 주기, 타임아웃, 재시도 횟수가 설정으로 조정되어야 한다.
- 메모리 누수 가능성이 있는 임시 데이터는 만료되어야 한다.

### 개발자/유지보수자

- 컨트롤러가 너무 많은 책임을 갖지 않도록 점진적으로 분리한다.
- 테스트가 없는 핵심 흐름부터 얇게라도 회귀 테스트를 추가한다.
- 오류 응답 형식과 HTTP 상태 코드가 예측 가능해야 한다.
- 프론트 데이터 렌더링 규칙을 재사용 가능하게 정리한다.

## T00. 현재 상태 기준선 정리

### 목표

작업 전 프로젝트가 어떤 상태인지 짧게 확인하고, 이후 작업자가 같은 사실을 반복 확인하지 않도록 기준 문서를 남긴다.

### 대상 파일

- `README.md`
- `docs/project-roadmap.md`
- 새 문서 또는 이 문서의 작업 로그 섹션

### 세부 작업

1. `rg --files`로 프로젝트 파일 구조를 확인한다.
2. 백엔드 핵심 파일을 확인한다.
   - `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin/AdminUploadController.java`
   - `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin/JdbcAdminUploadStore.java`
   - `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/publicdata/PublicDataCollectorService.java`
   - `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/config/SecurityConfig.java`
3. 프론트 핵심 파일을 확인한다.
   - `frontend-static/app.js`
   - `frontend-static/index.html`
4. 테스트 파일 존재 여부를 확인한다.
5. Maven 의존성 다운로드가 가능한 환경인지 확인한다.
6. 확인 결과를 이 문서 아래 `작업 로그`에 한 단락으로 남긴다.

### 완료 기준

- 현재 실행/검증 가능 범위가 기록되어 있다.
- 네트워크 제한으로 빌드가 안 되는 경우 그 사실이 명확히 남아 있다.

### 검증

- `node --check frontend-static/app.js`
- 가능한 경우 `mvn test`

## T01. 업로드 가능 데이터셋과 실제 저장 동작 일치

### 문제

관리자 화면은 `stores`, `population`도 업로드 가능하게 보일 수 있지만, DB 저장 코드는 현재 `facilities`만 실제 행을 저장한다. 다른 데이터셋은 성공 로그처럼 보이나 실제 업무 데이터는 적재되지 않는다.

### 목표

실제 저장을 지원하지 않는 데이터셋은 업로드 확정을 막거나, 실제 저장 구현을 추가한다. 우선순위는 "허위 성공 방지"이다.

### 대상 파일

- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin/AdminUploadController.java`
- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin/JdbcAdminUploadStore.java`
- `frontend-static/app.js`
- `docs/admin-upload-flow.md`

### 세부 작업

1. 백엔드의 지원 데이터셋 목록을 명시한다.
   - 1차 범위: `facilities`만 commit 지원.
   - `stores`, `population`, `air-quality`는 preview만 지원하거나 업로드 비활성화.
2. `findDataset`이 알 수 없는 `datasetKey`를 자동 생성하지 않도록 바꾼다.
3. `commitUpload`에서 지원하지 않는 `datasetKey`는 `ApiResponse.fail`로 반환한다.
4. 프론트의 업로드 데이터셋 선택 목록에서 실제 commit 지원 여부를 반영한다.
5. `stores`와 `population` 업로드를 나중에 지원할 경우 별도 TODO를 문서화한다.
6. 성공 메시지에는 `source row count`, `saved row count`, `skipped row count`를 구분해 보여준다.

### 완료 기준

- 실제 저장되지 않는 데이터셋은 업로드 확정이 불가능하다.
- 알 수 없는 `datasetKey`로 commit 요청해도 새 데이터셋이 생성되지 않는다.
- 시설 업로드는 기존처럼 정상 동작한다.

### 검증

- `facilities` 샘플 CSV preview/commit 성공.
- `stores` 또는 임의 `datasetKey` commit 요청 실패.
- 최근 업로드 로그가 실패/성공을 정확히 표시.

### GPT 5.4 mini 작업 지시 예시

```text
T01만 수행해줘. 업로드 commit이 실제 저장되는 데이터셋과 화면 선택지를 일치시켜줘. 지금은 facilities만 실제 저장되므로 다른 datasetKey는 commit에서 실패하게 만들고, 프론트 선택 목록도 그 사실을 반영해줘. 관련 테스트 또는 확인 스크립트도 가능하면 보강해줘.
```

## T02. 공공데이터 API 키 로그 노출 차단

### 문제

공공데이터 요청 URL에 API 키가 포함되고, 이 URL이 `dataset_collection_log.request_url`에 저장될 수 있다.

### 목표

API 키가 DB 로그, 화면, 오류 메시지에 남지 않도록 마스킹한다.

### 대상 파일

- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/publicdata/PublicDataCollectorService.java`
- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/publicdata/JdbcPublicDataRepository.java`
- `database/schema.sql`
- `docs/p4-public-data-sync.md`

### 세부 작업

1. 실제 호출용 URL과 로그 저장용 URL을 분리한다.
2. `ServiceKey`, 서울 열린데이터 키 구간을 `***` 또는 `{API_KEY}`로 마스킹한다.
3. 가능하면 API 호출 URL을 `https://`로 전환할 수 있는지 확인한다.
4. 외부 API가 `http://`만 지원하는 경우 문서에 제한을 기록한다.
5. 실패 메시지에 전체 URL이 포함되지 않도록 한다.
6. 기존 로그 조회 API가 마스킹된 URL만 제공하도록 확인한다.

### 완료 기준

- 새로 생성되는 `dataset_collection_log.request_url`에 실제 키가 없다.
- API 수집 실패 응답에도 키가 없다.
- 문서에 로그 마스킹 정책이 적혀 있다.

### 검증

- 더미 API 키로 URL 생성 후 로그 값에 키 원문이 없는지 확인.
- `rg`로 실제 키 패턴 또는 테스트 키가 저장 파일에 남지 않는지 확인.

### GPT 5.4 mini 작업 지시 예시

```text
T02만 수행해줘. PublicDataCollectorService에서 실제 요청 URL과 로그용 URL을 분리하고, ServiceKey/API 키가 DB 로그와 응답 메시지에 남지 않게 마스킹해줘. 동작 검증 방법도 문서에 남겨줘.
```

## T03. 프론트 HTML 삽입 지점 정리

### 문제

백엔드 또는 업로드 데이터가 `innerHTML`에 직접 들어가는 위치가 있다. 시설명, 주소, 지표명 등에 HTML이 섞이면 화면에 삽입될 수 있다.

### 목표

외부 데이터는 모두 escape 후 렌더링하거나 DOM API로 안전하게 삽입한다.

### 대상 파일

- `frontend-static/app.js`

### 세부 작업

1. `innerHTML` 사용 지점을 전체 검색한다.
2. 정적 템플릿과 외부 데이터 삽입을 구분한다.
3. 다음 함수부터 우선 정리한다.
   - `renderMetrics`
   - `renderFacilities`
   - `renderAccess`
   - `renderApiStatus`
   - `renderApiLogs`
   - `renderUploadLogs`
4. 문자열 보간에 들어가는 외부 데이터에 `escapeHtml`을 적용한다.
5. SVG 속성에 들어가는 값도 escape 또는 안전 변환한다.
6. 오류 화면에서 `error.message`도 escape 처리한다.
7. 악성 문자열이 포함된 임시 mock 데이터로 화면이 깨지지 않는지 확인한다.

### 완료 기준

- 백엔드/업로드/mock JSON 데이터가 HTML로 실행되지 않는다.
- 기존 화면 레이아웃과 기능은 유지된다.
- `node --check frontend-static/app.js`가 통과한다.

### 검증

- `node --check frontend-static/app.js`
- 시설명에 `<img src=x onerror=alert(1)>` 같은 값이 들어와도 텍스트로 보이는지 확인.

### GPT 5.4 mini 작업 지시 예시

```text
T03만 수행해줘. frontend-static/app.js의 외부 데이터 렌더링 지점에 escapeHtml을 일관되게 적용해서 XSS 가능성을 줄여줘. 큰 구조 변경 없이 기존 함수 중심으로 고쳐줘.
```

## T04. DB 장애 시 mock 정상 응답 오해 방지

### 문제

`DatasetController`, `FacilityController`가 DB 오류를 잡고 mock 데이터를 정상 성공 응답처럼 반환한다. 운영 장애가 숨겨질 수 있다.

### 목표

mock 모드와 DB 모드를 분리하고, DB 모드에서는 DB 오류를 오류로 드러낸다.

### 대상 파일

- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/dataset/DatasetController.java`
- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/facility/FacilityController.java`
- `backend-egovframe-skeleton/src/main/resources/application-mock.yml`
- `backend-egovframe-skeleton/src/main/resources/application.yml`
- `frontend-static/app.js`

### 세부 작업

1. `geumcheon.runtime.mode=mock`일 때만 fallback 데이터를 반환하도록 한다.
2. DB 모드에서는 예외를 숨기지 않고 공통 예외 처리로 넘긴다.
3. API 응답에 `sourceMode` 또는 `fallback=true` 같은 표시가 필요한지 검토한다.
4. 프론트는 fallback 데이터 사용 시 화면에 "Mock" 또는 "로컬 샘플"을 명확히 표시한다.
5. 문서에 mock fallback 정책을 추가한다.

### 완료 기준

- mock 프로파일에서는 기존처럼 샘플 데이터가 동작한다.
- DB 모드 DB 오류는 성공 응답으로 보이지 않는다.
- 프론트에서 로컬 샘플 사용 여부가 사용자에게 드러난다.

### 검증

- mock 모드 API 호출.
- DB 모드에서 DB 연결 실패 시 오류 응답 확인.
- 프론트 백엔드 미실행 상태에서 로컬 데이터 표시와 안내 확인.

### GPT 5.4 mini 작업 지시 예시

```text
T04만 수행해줘. DatasetController와 FacilityController의 mock fallback을 mock 모드에서만 허용하고, DB 모드 오류는 숨기지 않게 바꿔줘. 프론트에는 로컬 샘플 사용 표시가 드러나게 해줘.
```

## T05. 업로드 미리보기 메모리 보관 제한

### 문제

업로드 미리보기 파일 원본과 파싱 데이터가 서버 메모리에 저장되고, commit하지 않으면 제거되지 않는다.

### 목표

업로드 draft에 만료 시간과 최대 보관 개수를 둔다.

### 대상 파일

- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin/AdminUploadController.java`
- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/admin/CsvUploadDraft.java`
- `backend-egovframe-skeleton/src/main/resources/application.yml`

### 세부 작업

1. `CsvUploadDraft`에 `createdAt` 필드를 추가한다.
2. 설정값을 추가한다.
   - `geumcheon.upload.preview-ttl-minutes`
   - `geumcheon.upload.max-preview-drafts`
3. preview 요청 전후로 만료 draft를 정리한다.
4. 최대 개수를 넘으면 오래된 draft부터 제거한다.
5. commit 시 draft가 만료된 경우 명확한 실패 메시지를 반환한다.
6. 대용량 파일은 preview 단계에서 행/열/파일 크기 제한 안내를 강화한다.

### 완료 기준

- commit하지 않은 draft가 무기한 보관되지 않는다.
- 만료된 `uploadId`로 commit하면 재업로드 안내가 나온다.
- 설정값으로 TTL과 개수를 조정할 수 있다.

### 검증

- preview 여러 번 호출 후 draft 개수 제한 확인.
- TTL을 짧게 설정한 뒤 만료 commit 실패 확인.

### GPT 5.4 mini 작업 지시 예시

```text
T05만 수행해줘. AdminUploadController의 uploadDrafts에 TTL과 최대 개수 제한을 추가해서 미리보기 데이터가 메모리에 무기한 쌓이지 않게 해줘.
```

## T06. 시설 지도 마커 좌표 반영

### 문제

백엔드 시설 데이터에는 위도/경도가 있지만 프론트 지도는 목록 순서로 `x/y`를 배치한다.

### 목표

금천구 주변 위경도를 SVG viewBox 좌표로 변환해 시설 마커 위치에 반영한다.

### 대상 파일

- `frontend-static/app.js`
- `frontend-static/assets/data/mock-data.json`
- 필요 시 `docs/mvp-spec.md`

### 세부 작업

1. 금천구 지도 SVG의 대략적인 위경도 bounding box를 정한다.
2. `projectFacilityToMapPoint(latitude, longitude)` 함수를 만든다.
3. 유효한 좌표만 변환한다.
4. 좌표가 없거나 범위를 벗어난 시설은 목록에는 표시하되 지도 마커는 별도 위치 또는 숨김 처리한다.
5. mock 데이터와 백엔드 데이터 모두 같은 변환 함수를 쓰게 한다.
6. 마커 `aria-label`에 시설명과 주소를 포함한다.
7. 좌표 정확도 한계를 문서에 기록한다.

### 완료 기준

- 백엔드 시설 좌표가 지도 위치에 반영된다.
- 좌표 없는 시설이 잘못된 위치 `(0,0)`에 찍히지 않는다.
- 기존 카테고리 필터가 유지된다.

### 검증

- `node --check frontend-static/app.js`
- 샘플 시설 3개가 서로 다른 실제 좌표 기반 위치에 표시되는지 확인.

### GPT 5.4 mini 작업 지시 예시

```text
T06만 수행해줘. backend facilities의 latitude/longitude를 SVG 지도 좌표로 변환해서 마커 위치에 반영해줘. 좌표 없는 데이터는 잘못된 위치에 찍지 않게 처리해줘.
```

## T07. 관리자 인증/CSRF/기본값 운영 안전장치

### 문제

개발용 Basic Auth와 기본 비밀번호가 운영에 남을 수 있고, `/api/**` CSRF가 제외되어 있다.

### 목표

운영 프로파일에서 기본 관리자 비밀번호 사용을 막고, 관리자 변경 API 보호 정책을 명확히 한다.

### 대상 파일

- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/config/SecurityConfig.java`
- `backend-egovframe-skeleton/src/main/resources/application.yml`
- `backend-egovframe-skeleton/src/main/resources/application-mock.yml`
- `scripts/run-backend-db.ps1`
- `docs/deployment-environment.md`

### 세부 작업

1. 운영 또는 DB 모드에서 `ADMIN_INITIAL_PASSWORD=admin1234`를 사용하지 못하게 한다.
2. `run-backend-db.ps1`의 기본 관리자 비밀번호 자동 설정을 제거하거나 경고 후 중단한다.
3. CSRF 제외 범위를 재검토한다.
   - 당장 토큰 기반 구현이 어렵다면 운영 문서에 reverse proxy, HTTPS, SameSite 정책을 명확히 적는다.
4. CORS 허용 origin을 설정값으로 분리한다.
5. 관리자 인증 정보는 브라우저 `sessionStorage`에 Basic header 형태로 저장 중이므로, 운영 전 토큰/세션 방식 전환 작업을 별도 항목으로 남긴다.

### 완료 기준

- 운영/DB 모드 실행 시 기본 비밀번호가 자동 사용되지 않는다.
- CORS origin이 코드 하드코딩만으로 고정되지 않는다.
- 문서에 운영 인증 정책과 남은 전환 과제가 적혀 있다.

### 검증

- 비밀번호 미설정 DB 모드 실행 시 명확한 실패 또는 경고 확인.
- 로컬 mock 모드에서는 개발 편의가 유지되는지 확인.

### GPT 5.4 mini 작업 지시 예시

```text
T07만 수행해줘. DB/운영 모드에서 admin1234 같은 기본 관리자 비밀번호가 자동 사용되지 않게 하고, CORS origin을 설정으로 분리해줘. 문서도 함께 업데이트해줘.
```

## T08. 공공데이터 수집 재시도/스케줄링

### 문제

자동 수집은 애플리케이션 시작 시 1회만 실행된다. `COLLECTOR_RETRY_COUNT` 설정은 있지만 실제 로직에 연결되어 있지 않다.

### 목표

수집 실패 시 재시도하고, 운영에서 주기 수집을 설정할 수 있게 한다.

### 대상 파일

- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/publicdata/PublicDataAutoSyncRunner.java`
- `backend-egovframe-skeleton/src/main/java/kr/go/geumcheon/dataplatform/publicdata/PublicDataCollectorService.java`
- `backend-egovframe-skeleton/src/main/resources/application.yml`
- `docs/p4-public-data-sync.md`

### 세부 작업

1. `COLLECTOR_RETRY_COUNT`를 실제 수집 호출에 적용한다.
2. 재시도 간격 설정을 추가한다.
   - `geumcheon.collector.retry-delay-seconds`
3. 스케줄링 사용 여부와 cron 설정을 추가한다.
   - `geumcheon.collector.schedule-enabled`
   - `geumcheon.collector.cron`
4. 중복 수집이 동시에 실행되지 않도록 guard를 둔다.
5. 각 재시도 실패와 최종 실패를 로그에 남긴다.
6. 수동 동기화 스크립트와 자동 수집의 로그 `created_by`를 구분한다.

### 완료 기준

- 수집 실패 시 설정된 횟수만큼 재시도한다.
- 스케줄링을 켜면 정해진 주기로 실행된다.
- 동시에 여러 수집이 겹치지 않는다.

### 검증

- 잘못된 API 키로 재시도 로그 확인.
- schedule disabled 상태에서 시작 1회 동작 유지.
- schedule enabled 상태에서 주기 실행 확인.

### GPT 5.4 mini 작업 지시 예시

```text
T08만 수행해줘. 공공데이터 수집에 retry-count를 실제 적용하고, schedule-enabled/cron 설정으로 주기 수집이 가능하게 해줘. 중복 실행 방지도 넣어줘.
```

## T09. 테스트와 검증 스크립트 보강

### 문제

현재 핵심 업로드/수집/렌더링 흐름에 자동 테스트가 거의 없다. 네트워크 제한 환경에서는 Maven 의존성 다운로드도 막힐 수 있다.

### 목표

변경 위험이 큰 부분부터 작고 빠른 회귀 검증을 추가한다.

### 대상 파일

- `backend-egovframe-skeleton/src/test/java/...`
- `scripts/check-admin-upload.ps1`
- `scripts/check-admin-excel-upload.ps1`
- `scripts/check-local-status.ps1`
- `frontend-static/app.js`

### 세부 작업

1. 백엔드 단위 테스트 우선순위를 정한다.
   - CSV 파서
   - Excel 파서
   - 업로드 매핑 검증
   - API 키 마스킹
   - draft TTL 정리
2. 프론트는 최소한 `node --check`를 검증 절차에 포함한다.
3. 관리자 업로드 확인 스크립트에 실패 케이스를 추가한다.
   - 알 수 없는 `datasetKey`
   - 지원하지 않는 데이터셋 commit
   - 필수 매핑 누락
4. Maven 의존성 다운로드가 안 되는 환경을 위해 문서에 대체 확인 절차를 남긴다.
5. 각 작업별 검증 명령을 README 또는 관련 문서에 연결한다.

### 완료 기준

- 최소 3개 이상의 핵심 회귀 테스트 또는 확인 스크립트가 추가된다.
- 네트워크 제한 시에도 가능한 검증과 불가능한 검증이 구분된다.

### 검증

- `node --check frontend-static/app.js`
- 가능한 경우 `mvn test`
- 업로드 확인 스크립트 실행

### GPT 5.4 mini 작업 지시 예시

```text
T09만 수행해줘. 업로드 매핑 검증, API 키 마스킹, 지원하지 않는 datasetKey 실패 케이스를 중심으로 테스트나 확인 스크립트를 추가해줘. 네트워크 제한으로 mvn test가 안 될 수 있는 점도 문서화해줘.
```

## 권장 작업 순서

1. T00으로 기준선을 잡는다.
2. T01, T02, T03을 먼저 끝낸다.
3. T04, T05, T06으로 데이터 신뢰도와 운영 안정성을 보강한다.
4. T07은 배포 전 반드시 끝낸다.
5. T08은 실제 API 키와 DB 운영 흐름이 준비된 뒤 진행한다.
6. T09는 각 작업이 끝날 때 조금씩 같이 진행하고, 마지막에 누락분을 정리한다.

## 작업별 산출물 형식

각 작업 완료 후 아래 형식으로 기록한다.

```text
작업 ID:
변경 파일:
핵심 변경:
검증:
남은 위험:
다음 작업:
```

## 작업 로그

### 2026-06-05

- T00: 기준선 확인 완료. 핵심 백엔드/프론트 파일과 업로드·수집·보안 흐름을 검토했고, Maven 빌드는 네트워크 제한으로 의존성 다운로드가 막혔다.
- T01: 업로드 가능 데이터셋과 실제 저장 동작을 분리했다. `facilities`만 확정 저장 가능하게 만들고, `stores`와 `population`은 미리보기만 가능하도록 맞췄다. 관련 문서와 검증 스크립트도 같이 정리했다.
- T02: 공공데이터 요청 URL과 로그 URL을 분리하고, `ServiceKey`와 서울 열린데이터 키를 마스킹했다. `PublicDataCollectorService`의 응답과 `dataset_collection_log.request_url` 모두 실제 키가 남지 않도록 바꿨고, `docs/p4-public-data-sync.md`에 확인 방법도 남겼다. HTTP 샘플 URL은 공식 문서가 `http://` 형식을 쓰는 점을 기준으로 유지했다. `mvn -q -DskipTests compile`은 Maven Central 네트워크 접근이 막혀서 실패했다.
- T03: 프론트의 대표적인 외부 데이터 렌더링 지점인 `renderMetrics`, `renderFacilities`, `renderCommercial`, `renderAccess`와 초기 에러 화면을 `escapeHtml` 기준으로 정리했다. `facility.id` 같은 속성 값도 escape하고, 로딩 실패 메시지도 텍스트로 처리해서 원시 HTML 삽입을 줄였다. `node --check frontend-static/app.js`는 통과했다.
- T04: `ApiResponse.sourceMode`와 `ApiExceptionHandler`를 정리해서 DB 모드 예외가 500으로 드러나게 하고, `DatasetController`/`FacilityController`는 mock 모드에서만 샘플 데이터를 돌려주도록 바꿨다. 프론트는 `Mock`, `DB 데이터`, `로컬 샘플`을 상단 배너에 표시하게 했고, 문서에도 mock fallback 정책을 적었다.
- T05: upload preview draft retention is now controlled by `CsvUploadDraft.createdAt`, `geumcheon.upload.preview-ttl-minutes`, and `geumcheon.upload.max-preview-drafts`. `AdminUploadController` cleans old drafts before storing new previews and rejects expired `uploadId` values at commit time. The upload flow doc now records the retention policy.
- T06: facility markers now use latitude/longitude when available and skip rows without coordinates instead of placing them in a fake grid. `FacilitySummary` latitude/longitude became nullable, `JdbcPublicDataRepository` now preserves null geometry, and the mock local data includes real coordinates for the first facilities so the offline sample exercises the same projection path.
- T07: DB/production startup now refuses placeholder admin passwords through `AdminCredentialGuard`, `run-backend-db.ps1` requires an explicit `ADMIN_INITIAL_PASSWORD`, and `geumcheon.security.cors.allowed-origins` moves allowed origins into configuration instead of hard-coding them in `SecurityConfig`. The deployment docs now show the real env values needed for a safe startup.

### 2026-06-06

- T08: Public data collection now honors `retry-count` with a configurable retry delay, can be enabled on a cron schedule through `geumcheon.collector.schedule-enabled` and `geumcheon.collector.cron`, and skips overlapping runs with a collector lock. The retry and schedule settings are documented in `docs/p4-public-data-sync.md`.
- T09: Added regression tests for upload mapping validation, unsupported dataset keys, Excel parsing, request URL masking, and draft TTL expiry. The admin upload check script now includes failure cases for missing mappings and unknown dataset keys, and the local status/help docs now point to `node --check`, the upload checks, and `mvn test` with a network-limited fallback. Maven still cannot resolve `spring-boot-dependencies` in offline mode here, so the scripted checks are the practical verification path.
- Follow-up: mock public-data repository now boots without a JDBC datasource in `mock` mode, the API exception handler returns a generic 500 message, facility markers use a fixed Geumcheon bounding box, upload commits validate preview counts, and upload logs show source/saved/skipped counts. The validation scripts were updated to assert those counts directly.
