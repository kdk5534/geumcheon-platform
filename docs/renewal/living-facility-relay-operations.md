# 생활시설 격리 중계기 운영

## 운영 구조

생활시설 수집기는 Wi-Fi 중계기와 프로세스·포트·토큰을 분리한다. Spring Boot는 HTTPS 정책을 유지하며 로컬 `http://127.0.0.1:18089`만 호출한다. 중계기는 `openapi.seoul.go.kr:8088`의 다음 서비스만 호출할 수 있다.

- `fcltOpenInfo_GC` 사회복지시설
- `LOCALDATA_114602_GC` 민방위 대피시설
- `LOCALDATA_010101_GC` 병원
- `LOCALDATA_010106_GC` 약국
- `ChildCareInfoGC` 어린이집

다른 서비스 ID는 요청 단계에서 거부된다. API 키와 런타임 토큰은 URL·응답·오류 로그에 기록하지 않는다.

## 실행과 종료

평상시에는 `scripts/run-backend-db.ps1`만 실행한다. 스크립트가 Wi-Fi 중계기(18088)를 준비한 뒤 생활시설 중계기(18089)를 준비하고 Spring Boot를 시작한다. 토큰은 매 실행 시 안전한 난수로 만들고 두 로컬 프로세스에만 전달한다. 이미 정상 중계기가 있으면 토큰 파일로 인증해 재사용하며 소유하지 않은 프로세스는 종료하지 않는다.

Spring Boot가 종료되거나 시작에 실패하면 스크립트가 직접 시작한 두 중계기를 종료하고 런타임 토큰 파일을 삭제한다. Windows 시작 서비스나 별도 계정은 사용하지 않는다.

## 품질 게이트와 장애 대응

중계기는 필수 필드, 자연키 중복, WGS84 좌표 쌍·금천구 범위, 최소 유효 비율, 행 수, 이전 성공 대비 급변을 검사한다. 좌표가 없는 공식 행은 좌표를 추정하지 않으며 저장소에는 geometry 없이 보존할 수 있다. 검증 실패·시간초과·상류 오류 시 Spring Boot의 스냅샷 교체가 실행되지 않아 기존 정상 스냅샷이 유지된다.

상태 확인은 런타임 토큰이 설정된 셸에서 `scripts/check-living-facility-relay.ps1`을 실행한다. 장애 시 `.tmp/logs/living-facility-relay.err.log`의 비밀정보가 제거된 오류 코드, `/v1/status`의 마지막 성공 시각과 서비스별 성공 건수를 확인한다. 개발 진단용 단독 실행은 `scripts/run-living-facility-relay.ps1`을 사용한다.

서울시 TCP 8088이 로컬 방화벽에서 차단될 때는 관리자 PowerShell에서 `scripts/configure-seoul-openapi-firewall.ps1`을 실행한다. 이 스크립트는 중계기에 사용하는 Python 실행 파일, 실행 시점에 확인한 `openapi.seoul.go.kr` IPv4 주소, 원격 TCP 8088에만 적용되는 아웃바운드 허용 규칙을 만든다. DNS 주소가 바뀌면 스크립트를 다시 실행한다. 시스템 전체 아웃바운드 정책이나 Codex 격리 규칙은 변경하지 않는다.

2026-06-21 실제 서버에는 위 규칙을 적용했다. 적용값은 중계기 Python, `115.84.165.45`, TCP 8088로 제한됐다. 적용 후에도 같은 Python의 TCP 연결이 시간 초과했다. 비교 진단에서는 `data.seoul.go.kr:443`, `data.go.kr:443`, 일반 HTTPS는 연결되고 `openapi.seoul.go.kr:443/8088`만 실패했다. Google과 Cloudflare DNS 모두 `115.84.165.45`를 반환했으므로 DNS 문제나 Windows 기본 아웃바운드 정책 문제로 보지 않는다. 당시 활성 네트워크는 iPhone 핫스팟이었다. 유선·일반 광대역망에서 다시 검사한 뒤에도 실패하면 통신사/서울시 경로 문제로 분류하고 외부 중계 위치를 검토한다.
