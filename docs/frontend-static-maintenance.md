# Frontend Static Maintenance Notes

`frontend-static/` 아래에 흩어져 있던 작업 메모를 이 문서로 정리했다. 에이전트 전용 메모 파일보다는 저장소 문서 경로에 두는 편이 현재 구조와 남은 정리 과제를 추적하기 쉽다.

## Current Entry Points

- 앱 셸: `frontend-static/index.html`
- 정적 서버: `frontend-static/serve-static.mjs`
- JS 진입점: `frontend-static/js/main.js`
- 공통 CSS: `frontend-static/styles.css`, `frontend-static/css/tokens.css`, `frontend-static/css/components.css`
- 페이지별 CSS: `frontend-static/css/pages/*.css`

`frontend-static/app.js`는 더 이상 `index.html`에서 로드되지 않았고, 현재 기능은 `js/main.js`와 `js/pages/*.js` 모듈이 모두 대체한다. 보존 사유가 없어 저장소에서 제거했다.

## Security Merge Notes

삭제한 `frontend-static/CLAUDE.md`와 `frontend-static/context-notes.md`에 있던 보안 메모는 여기서 이어서 관리한다.

- 현재 이 워크트리 기준 관리자 인증 코드는 `frontend-static/js/core/state.js`와 `frontend-static/js/pages/admin.js`에서 `sessionStorage`를 읽고 쓴다.
- 병렬 보안 작업의 방향은 브라우저 저장소에 ID, 비밀번호, Basic 헤더를 남기지 않고 모듈 스코프 메모리에서만 유지하는 것이다.
- 그 변경이 병합되면 새로고침 시 재로그인이 필요해질 수 있지만, 관리자 1인 도구라는 전제에서는 허용 가능한 트레이드오프로 본다.
- 중기 목표는 메모리 보관에 머무르지 않고 HttpOnly 세션 쿠키 기반 인증으로 옮겨 가는 것이다.
- 이 문서는 삭제된 작업 메모 대신 위 보안 전환 맥락을 보존하는 최종 위치다.

## styles.css Status

`frontend-static/styles.css`는 아직 `index.html`에서 직접 로드된다. 아래 영역이 실제 화면 클래스와 계속 연결되어 있어 지금 단계에서는 제거하지 않는다.

- 공통 셸과 내비게이션: `.skip-link`, `.topbar`, `.brand`, `.brand-mark`, `.nav`, `.shell`
- 홈/공통 메트릭 카드: `.eyebrow`, `.metric-grid`, `.metric-card`, `.metric-top`, `.metric-value`, `.metric-note`, `.metric-badge`, `.data-stamp`
- 지도/시설 요약 일부 공통 카드: `.facility-item`, `.access-card`
- API 상태/로그 카드: `.api-source-head`, `.api-source-status`, `.api-log-card`, `.api-log-head`, `.api-log-status`, `.api-log-kpis`, `.api-log-actions`
- 지표 상세(geo) 카드군: `.geo-summary`, `.geo-spotlight-*`, `.geo-radius-*`, `.geo-comparison-*`, `.geo-industry-*`, `.geo-workflow`, `.geo-district-panel`, `.district-*`, `.geo-summary-empty`
- 관리자 업로드 UI: `.admin-auth-*`, `.dataset-*`, `.upload-*`, `.column-mapping`, `.mapping-*`, `.preview-warning`, `.csv-preview`, `.sample-link`, `.commit-button`
- 상태 변형 클래스: `.is-info`, `.is-warning`, `.is-error`, `.is-ok`, `.is-state`, `.empty`, `.alt`, `.warm`

`styles.css` 제거 전 조건은 위 셀렉터들이 `css/components.css` 또는 `css/pages/*.css`로 모두 이관되고, `index.html`에서 링크를 제거해도 화면이 깨지지 않는지 확인하는 것이다.

## Verification Notes

- 프런트 문법 검사는 `frontend-static/serve-static.mjs`와 `frontend-static/js/**/*.js`를 대상으로 한다.
- GitHub Actions CI도 같은 범위를 사용한다.
- 루트 디버그 산출물 `geo_boundary_focus.png`, `geo_compare_check.png`, `geumcheon_dom.txt`, `geumcheon_dom2.txt`는 저장소 루트에서만 다시 무시한다.
- 워크플로는 `ubuntu-latest`를 기준으로 검토했다. `backend-test`의 `working-directory`는 `backend-egovframe-skeleton`에만 적용되고, 프런트 문법 검사는 별도 job에서 저장소 루트 기준 경로를 사용한다.
- 로컬 YAML 파서 검증은 이 환경에서 도구 제약이 있었다. `python` 실행은 세션 오류로 실패했고, `ruby`와 PowerShell `ConvertFrom-Yaml`도 없어 구조 검토와 실제 명령 재실행으로 대신 확인했다.
