# 공공 Wi-Fi 스냅샷 운영 기준

- 확정일: 2026-06-22
- 기본값: `WIFI_REALTIME_COLLECTION_ENABLED=false`
- 공공 Wi-Fi: 마지막 성공 스냅샷 1,644행 사용
- 서울시 HTTP 8088 호출: 비활성화
- 생활시설용 서울 8088 중계기: 기본 비활성화 (`LIVING_FACILITY_RELAY_ENABLED=false`)
- 외부 중계 서버: 사용하지 않음
- 일반 HTTPS 수집기와 로컬 백엔드: 정상 운영

## 실행 원칙

비활성 모드에서는 `scripts/run-backend-db.ps1`가 Wi-Fi 중계기를 시작하지 않는다. 기존 `WIFI_RELAY_TOKEN`을 런타임에서 비우고 `WIFI_RELAY_SCHEDULE_ENABLED=false`를 강제하므로, 전체 수집이나 수동 동기화가 실행되어도 공공 Wi-Fi는 외부 요청 없이 건너뛴다. 기존 성공 스냅샷은 삭제하거나 0행으로 대체하지 않는다.

화면에서는 공공 Wi-Fi 선택 시 다음을 함께 표시한다.

- `마지막 성공 데이터`
- 전체 보존 스냅샷 1,644행
- 기준일 2026-06-19
- 서울시 8088 실시간 수집 비활성화
- 화면 목록에는 금천구 범위 필터가 적용된다는 설명

1,644행은 마지막 수집 배치의 원천 행 수이며 화면에 표시되는 금천구 시설 수와 같은 지표가 아니다.

## 재활성화

접속 가능한 회선을 확보한 뒤 아래 조건을 모두 충족할 때 Wi-Fi 수집만 다시 켠다.

1. `SEOUL_OPEN_API_KEY`를 운영 비밀로 설정한다.
2. `WIFI_REALTIME_COLLECTION_ENABLED=true`를 명시한다.
3. 예약 수집이 필요하면 `WIFI_RELAY_SCHEDULE_ENABLED=true`를 별도로 설정한다.
4. TCP 8088, 중계기 인증 상태, 소량 응답을 먼저 검증한다.
5. 1,644행 기준 대비 품질 게이트 결과를 확인한 뒤 스냅샷 교체를 승인한다.
