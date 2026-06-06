# Excel Upload Plan

Excel 업로드는 백엔드에서 첫 번째 시트를 읽어 CSV와 같은 preview/commit 흐름으로 처리합니다.
API 키 발급 전에는 이 흐름을 먼저 안정화하고, API 키 발급 후 P4 실수집 검증으로 돌아갑니다.

## 현재 상태

- CSV는 백엔드 preview, 컬럼 매핑, commit까지 동작합니다.
- Excel은 백엔드 preview에서 Apache POI로 첫 번째 시트를 읽습니다.
- 백엔드가 꺼진 경우 CSV만 브라우저 로컬 미리보기로 전환하고, Excel은 백엔드 실행 안내를 표시합니다.
- Excel 검증 스크립트는 문자열, 숫자, 날짜 셀을 함께 넣어 preview/commit을 확인합니다.

## 구현 방향

- 백엔드에 Apache POI 기반 Excel 파서를 사용합니다.
- 우선 첫 번째 시트만 읽습니다.
- 첫 번째 행을 헤더로 사용합니다.
- 셀 값은 화면에 보이는 값에 가깝게 문자열로 변환합니다.
- 날짜/숫자/빈 셀 처리를 CSV 미리보기와 같은 구조로 맞춥니다.
- CSV와 Excel 모두 같은 `CsvUploadPreview`, `CsvUploadDraft`, commit 흐름을 사용합니다.

## 검토할 제한

- 파일 크기 제한
- 최대 행 수와 최대 컬럼 수
- 빈 시트, 병합 셀, 수식 셀 처리
- `.xls` 구형 포맷 지원 여부
- 압축 폭탄 방어 설정
- 매크로 파일은 실행하지 않고 값만 읽기

## 필요한 후속 작업

1. Maven 의존성 다운로드가 가능한 환경에서 빌드 확인
2. `scripts/check-admin-excel-upload.ps1` 로 Excel preview/commit 검증
3. 한글, 날짜, 숫자 셀이 포함된 업로드 테스트 추가
