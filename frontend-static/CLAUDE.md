# CLAUDE.md — frontend-static

별도 빌드 없이 Node.js 내장 HTTP 서버만으로 실행하는 정적 SPA입니다.

## 실행

```powershell
node serve-static.mjs   # http://localhost:3000
```

프론트 파일만 수정한 경우 서버 재시작 없이 브라우저 새로고침으로 반영됩니다.

## 아키텍처

해시 기반 SPA. `js/core/router.js`가 `#/<route>` 해시를 읽어 `js/pages/<page>.js` 모듈을 마운트·언마운트합니다.

### 핵심 모듈 (`js/core/`)

| 파일 | 역할 |
|------|------|
| `state.js` | 전역 상태 객체(`state`)와 앱 전역 상수. 모든 페이지 모듈이 import해서 읽고 씁니다. `BACKEND_API_BASE = "http://localhost:8080"` 고정. |
| `api.js` | 백엔드 API 우선 호출. 실패 시 `assets/data/*.json` 로컬 mock으로 자동 폴백. |
| `router.js` | 해시 변경 감지 → 페이지 모듈 mount/unmount. |
| `charts.js` | 차트 렌더링 유틸. |
| `dom.js / selectors.js` | DOM 쿼리·조작 헬퍼. |
| `meta.js` | 데이터 출처·갱신 시각 표시 유틸. |
| `icons.js` | SVG 아이콘 유틸. |

### 페이지 모듈 (`js/pages/`)

라우트마다 `mount(container)` / `unmount()` 함수를 export합니다.

`home, map, catalog, admin, api-status, api-logs, indicators, realtime, population, commercial, geo, about`

### Mock 데이터 (`assets/data/`)

백엔드 미연결 시 폴백용 JSON 번들. 실제 API 응답 구조와 동일한 형태로 유지합니다.

- `mock-data.json` — 시설·상권 등 메인 데이터
- `api-sources.json / api-logs.json` — API 수집 현황 mock
- `datasets.json / indicators.json / realtime.json` — 각 페이지 mock
