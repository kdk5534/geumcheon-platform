# 공공와이파이 격리 HTTP 중계 운영서

## 1. 현재 승인된 실행 방식

공공와이파이 중계기와 Spring Boot는 기존 Windows 서버 한 대에서 실행한다. Windows 서비스, 시작 프로그램, 작업 스케줄러, 별도 회원가입, 전용 Windows 계정은 사용하지 않는다.

`scripts/run-backend-db.ps1`이 전체 수명주기를 관리한다.

1. 안전한 난수 `WIFI_RELAY_TOKEN`을 자동 생성한다.
2. 중계기를 별도 프로세스로 먼저 실행한다.
3. `127.0.0.1:18088/health`와 인증된 `/v1/status`가 모두 정상인지 확인한다.
4. 같은 토큰을 Spring Boot 환경에 전달하고 백엔드를 전면 실행한다.
5. Spring Boot가 종료되거나 시작에 실패하면 이 실행이 생성한 중계기도 종료한다.

Windows 부팅만으로는 어느 프로세스도 자동 실행되지 않는다.

```text
run-backend-db.ps1
  ├─ wifi-relay 별도 프로세스 ──HTTP──> openapi.seoul.go.kr:8088/TbPublicWifiInfo_GC
  │       └─ 127.0.0.1:18088 + X-Relay-Token
  └─ Spring Boot ──> PostgreSQL / 공개 API
```

## 2. 보안 경계

- 중계기는 `127.0.0.1:18088`에만 바인딩한다.
- 외부 목적지는 코드 상수 `openapi.seoul.go.kr:8088/TbPublicWifiInfo_GC`로 고정되어 요청으로 바꿀 수 없다.
- 메인 플랫폼의 직접 외부 원천 URL은 HTTPS만 사용한다.
- `SEOUL_OPEN_API_KEY`는 중계기 프로세스에만 필요하다.
- `WIFI_RELAY_TOKEN`은 명령행 인자로 전달하지 않고 부모 프로세스 환경을 통해 두 자식 프로세스에 동일하게 전달한다.
- 토큰은 `.tmp/wifi-relay-runtime.token`에만 임시 저장하며 현재 Windows 사용자와 SYSTEM만 읽고 쓸 수 있도록 ACL을 제한한다.
- 중계기 로그는 `.tmp/logs/`에 저장하고 키, 토큰, 전체 원천 URL, 원천 오류 본문을 기록하지 않는다.
- 중계 응답은 ID·명칭·주소·위도·경도·자치구·서비스 ID만 포함한다.

## 3. 설정

운영자가 직접 설정해야 하는 비밀값은 기존 `.env` 또는 실행 셸의 `SEOUL_OPEN_API_KEY`뿐이다. `WIFI_RELAY_TOKEN`은 설정하지 않는다.

```powershell
$env:SEOUL_OPEN_API_KEY = '<registered-key>'
$env:WIFI_RELAY_MIN_REFRESH_SECONDS = '300'
$env:WIFI_RELAY_TIMEOUT_SECONDS = '15'
$env:WIFI_RELAY_RETRY_COUNT = '2'
$env:WIFI_RELAY_RETRY_DELAY_SECONDS = '1'
$env:WIFI_RELAY_SCHEDULE_ENABLED = 'true'
$env:WIFI_RELAY_CRON = '0 10 * * * *'
```

결합 실행 시 호스트·포트·기본 URL은 스크립트가 각각 `127.0.0.1`, `18088`, `http://127.0.0.1:18088`로 강제한다. 최소 호출 간격은 60초 미만으로 설정할 수 없다.

## 4. 실행과 종료

DB 환경 변수를 준비한 뒤 기존 명령 하나만 실행한다.

```powershell
.\scripts\run-backend-db.ps1
```

정상 종료는 실행 중인 터미널에서 `Ctrl+C`를 누른다. Spring Boot가 끝나면 부모 스크립트의 `finally` 정리 단계가 자신이 시작한 중계기를 종료하고 임시 토큰 파일을 삭제한다.

이미 관리 중인 중계기가 18088에서 실행 중이면 임시 토큰 파일을 읽어 인증된 상태 확인까지 성공한 경우에만 재사용한다. 이때 현재 실행은 기존 중계기를 종료하지 않는다. 포트만 열려 있거나 토큰 인증이 실패하면 다른 프로세스로 판단하고 안전하게 중단한다.

## 5. 개발·진단용 개별 실행

개별 중계기 실행 스크립트는 개발과 장애 진단 용도로 유지한다. 이 경우에만 운영자가 32자 이상의 임시 토큰을 직접 환경 변수로 제공한다.

```powershell
.\scripts\run-wifi-relay.ps1
.\scripts\check-wifi-relay.ps1
```

결합 실행 중에는 자동 생성 토큰을 콘솔에 표시하지 않으므로 별도 상태 스크립트 대신 다음 공개 상태를 사용한다.

- 백엔드: `GET http://127.0.0.1:8080/actuator/health`
- 데이터 상태: `GET /api/public/datasets/status`의 `public-wifi`
- 공개 데이터: `GET /api/public/facilities?category=WIFI&scope=GEUMCHEON`

## 6. 품질 게이트와 스냅샷 보존

중계기에서 다음 조건을 모두 통과한 행만 메인으로 보낸다.

- 필수 필드: 원천 ID, 설치장소명, 위도, 경도
- WGS84 범위: 위도 `37.42..37.51`, 경도 `126.85..126.93`
- 자연키 중복 제거: `X_SWIFI_WRDNFC_NO`
- 유효 행 비율 70% 이상
- 정상 건수 `1..50,000`
- 직전 성공 건수 대비 변동 30% 이하
- 최대 1,000건씩 50페이지 이내 완전 수집

Spring Boot는 서비스 ID, 자치구, 필수 필드, 좌표, 중복, 건수 변동을 다시 검증한다. 어느 단계에서든 실패하면 `replaceFacilitySnapshot`을 호출하지 않아 기존 정상 스냅샷을 유지한다.

## 7. 장애 대응

| 상태 | 의미 | 조치 |
| --- | --- | --- |
| 중계 준비 실패 | Python 종료, 포트 충돌, 잘못된 설정 | Spring Boot를 시작하지 않으며 중계기와 토큰 파일을 정리한다. `.tmp/logs/wifi-relay.err.log`를 확인한다. |
| 미관리 18088 프로세스 | 포트는 열렸지만 관리 토큰 인증 실패 | 해당 프로세스의 출처를 확인하고 종료한 뒤 다시 실행한다. 임의 재사용하지 않는다. |
| Spring Boot 시작 실패 | JAR·DB·포트·설정 문제 | 이번 실행이 생성한 중계기를 자동 종료하고 백엔드 오류를 그대로 반환한다. |
| `TIMEOUT` | 서울시 HTTP 응답 지연 | 기존 스냅샷을 유지하고 서울시 원천 상태를 재확인한다. |
| `CONNECTION_REFUSED`·`NETWORK_ERROR` | 서울시 연결 또는 DNS 문제 | 네트워크와 서울시 서비스 상태를 확인한다. |
| `UPSTREAM_CONTRACT` | JSON 또는 필드 계약 변화 | 자동 반영하지 않고 비밀 제거 샘플로 계약을 재검토한다. |
| `QUALITY_GATE` | 좌표·필수값·중복·건수 급변 | 기존 기준선을 유지하고 원천 변경 여부를 확인한다. |

비정상 강제 종료로 관리 중계기가 고아 프로세스로 남아도 다음 실행은 임시 토큰으로 인증한 후 안전하게 재사용한다. 토큰 파일만 남고 프로세스가 없으면 새 토큰으로 교체한다.

## 8. 테스트와 검증

```powershell
.\scripts\test-wifi-relay.ps1
.\scripts\test-backend-wifi-lifecycle.ps1
cd backend-egovframe-skeleton
mvn test
```

수명주기 테스트는 중복 실행 방지, 준비 실패 정리, 정상 종료 정리, Spring Boot 시작 실패 정리를 검증한다.

2026-06-20 실연결에서는 서울시 TCP 8088 연결 후 HTTP 응답이 시간 초과됐다. 메인 운영 상태는 `FAILED/TIMEOUT`, 정상자료는 `AVAILABLE`, 마지막 성공 원천/저장 건수는 `1,644/1,644`로 보존됐다. 이는 신규 원천 성공 기준선이 아니라 기존 정상 스냅샷이다.
