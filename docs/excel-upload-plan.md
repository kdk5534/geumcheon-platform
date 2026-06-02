# Excel Upload Plan

Excel 업로드는 현재 파일 선택과 형식 감지만 지원합니다. 실제 `.xlsx`/`.xls` 파싱은 의존성 준비 후 별도 단계로 구현합니다.

## 현재 상태

- CSV는 백엔드 preview, 컬럼 매핑, commit까지 동작합니다.
- Excel 파일을 선택하면 깨진 미리보기 대신 CSV 변환 안내를 표시합니다.
- 백엔드 API에 Excel 파일을 직접 보내도 CSV 파서가 처리하지 않고 실패 메시지를 반환합니다.

## 구현 방향

- 백엔드에 Apache POI 기반 Excel 파서를 추가합니다.
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

1. Maven 의존성 다운로드가 가능한 환경에서 Apache POI 추가
2. `AdminUploadController`의 preview 단계에서 CSV/Excel 파서 분기
3. Excel 샘플 파일과 검증 스크립트 추가
4. 한글, 날짜, 숫자 셀이 포함된 업로드 테스트 추가
