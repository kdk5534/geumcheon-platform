# 금천구청 포털 탑재 및 React 전환 호환성 점검

작성일: 2026-06-24

## 결론

React 사용 자체는 금천구청 대표 홈페이지 탑재에 본질적인 문제가 아니다. React/Vite로 개발하더라도 최종 산출물은 정적 HTML, CSS, JavaScript, 이미지 파일이므로 기존 공공기관 포털의 특정 경로 아래에 배치할 수 있다.

다만 포털 내부에 직접 삽입되는 화면이라면 React 여부보다 다음 조건이 더 중요하다.

- 빌드 산출물이 상대 경로 또는 포털 하위 경로 기준으로 동작해야 한다.
- 브라우저 라우팅은 서버 rewrite가 필요 없는 hash routing을 우선 사용한다.
- 포털의 기존 CSS, 전역 JavaScript, jQuery 플러그인과 충돌하지 않도록 앱 루트와 CSS 범위를 격리한다.
- VWorld, ECharts, 지도 라이브러리 같은 외부 자산은 공공망/보안 정책에서 허용되거나 로컬 정적 자산으로 포함되어야 한다.
- 접근성, 키보드 조작, 200% 확대, 색상 외 상태 표현, 개인정보/위치정보 처리 고지가 검수 기준을 통과해야 한다.

## 현재 포털 관찰

- 대상 URL: `https://www.geumcheon.go.kr/portal/index.do`
- 공식 전자정부 누리집 안내와 본문 바로가기 링크가 있는 기존 포털 페이지다.
- URL 형태가 `.do` 기반이므로 전통적인 공공기관 CMS/eGov 계열 페이지로 보고, 정적 SPA를 별도 하위 경로 또는 iframe/콘텐츠 영역에 탑재하는 방식을 우선 가정한다.
- 기존 포털은 자체 헤더, 검색, 메뉴, 다국어, 패밀리 사이트 영역을 갖고 있으므로 대시보드가 포털 전체 전역 스타일을 오염시키면 안 된다.

## 권장 탑재 방식

### 1순위: 별도 하위 경로 정적 앱

예:

```text
https://www.geumcheon.go.kr/data-platform/
https://www.geumcheon.go.kr/portal/data-platform/
```

권장 이유:

- React/Vite 빌드 산출물을 그대로 배치하기 쉽다.
- 포털 전역 JS/CSS와 충돌 가능성이 낮다.
- hash routing을 쓰면 서버 rewrite 없이 여러 화면 탭을 유지할 수 있다.
- 성능/접근성/오류 모니터링을 독립적으로 검증하기 쉽다.

필수 설정:

- Vite `base`를 실제 배포 경로에 맞춘다.
- 라우터는 `HashRouter` 또는 동등한 hash 기반 라우팅을 사용한다.
- 모든 정적 자산 경로는 절대 루트 `/`가 아니라 배포 base를 기준으로 생성한다.

### 2순위: 포털 콘텐츠 영역에 mount

예:

```html
<div id="geumcheon-data-platform-root"></div>
<script type="module" src="/data-platform/assets/index.js"></script>
```

권장 조건:

- 포털 공통 헤더/푸터를 그대로 쓰고 본문 콘텐츠만 대시보드로 넣어야 할 때 사용한다.
- React 앱은 `#geumcheon-data-platform-root` 밖의 DOM을 변경하지 않는다.
- CSS는 `.gdp-app` 같은 최상위 namespace 아래로 제한한다.

주의:

- 포털 기존 스크립트가 전역 이벤트, `body` class, form submit, hashchange를 사용하면 충돌할 수 있다.
- 우리 앱의 `hashchange` 라우팅과 포털의 앵커 이동 로직이 충돌하는지 사전 검증해야 한다.

### 3순위: iframe 임베드

보안·운영 분리가 최우선이면 가능하다.

장점:

- CSS/JS 충돌이 가장 적다.
- 기존 포털 운영사와 책임 경계를 나누기 쉽다.

단점:

- 높이 자동 조정, 접근성, 공유 URL, 포털 검색 연동이 번거롭다.
- `X-Frame-Options`, `frame-ancestors` 정책 확인이 필요하다.

## React 전환 시 문제될 수 있는 지점

| 항목 | 위험 | 권장 대응 |
| --- | --- | --- |
| 서버 라우팅 | `/population` 같은 history route는 `.do` 포털에서 404 가능 | hash routing 유지 |
| 정적 자산 경로 | `/assets/...` 절대 경로가 포털 root와 충돌 가능 | Vite `base` 설정 및 상대 경로 검증 |
| CSS 충돌 | 포털 `.nav`, `.container`, `button` 스타일과 충돌 가능 | 앱 루트 namespace, CSS module 또는 scoped token |
| 전역 JS 충돌 | 포털 jQuery/전역 이벤트와 충돌 가능 | React 앱은 root 내부만 조작 |
| CSP | CDN, inline script/style 차단 가능 | 외부 CDN 최소화, self-hosted asset 우선 |
| VWorld | API key 도메인 제한, HTTPS, 공공망 차단 가능 | 백엔드 프록시 유지, 타일 상태 API 제공 |
| 접근성 | 공공기관 검수에서 중대 오류 불가 | axe, 키보드, 확대, 스크린리더 기준 유지 |
| 구형 브라우저 | 일부 내부망 환경에서 ES module 미지원 가능 | 지원 브라우저 확정, 필요 시 legacy build 검토 |

## 현재 코드 기준 판단

현재 정적 프론트는 이미 hash route를 사용한다. 이 점은 포털 탑재에 유리하다.

```text
#/home
#/population
#/commercial
#/welfare
#/safety
#/datasets
```

React로 전환해도 hash route를 유지하면 기존 URL 운영과 큰 충돌이 없다. 반대로 React Router의 browser history 방식으로 바꾸면 서버 rewrite가 필요하므로 포털 탑재 리스크가 커진다.

## React 전환 권장 조건

React 전환은 다음 조건을 지킬 때 권장한다.

1. Vite 빌드 결과를 포털 하위 경로에 정적 배치할 수 있다.
2. 라우팅은 HashRouter로 시작한다.
3. 앱 최상위 루트는 `#geumcheon-data-platform-root`처럼 고유 ID를 사용한다.
4. 전역 CSS는 최소화하고, 디자인 토큰과 컴포넌트 스타일을 앱 namespace 아래로 제한한다.
5. Leaflet/ECharts 등 외부 라이브러리는 CDN이 아니라 번들 또는 자체 정적 파일로 제공한다.
6. VWorld API key는 브라우저에 노출하지 않고 현재처럼 백엔드 프록시를 사용한다.
7. 포털 운영환경에서 다음 검증을 통과해야 한다.
   - 390, 768, 1280, 1440px 시각 회귀
   - axe 중대/심각 오류 0건
   - 키보드 전체 조작
   - VWorld 타일 상태 API 정상
   - 외부 CDN 차단 시 대체 UI 정상
   - 포털 헤더/푸터/검색/메뉴와 충돌 없음

## 권장 실행 순서

1. 현재 정적 앱을 먼저 포털 하위 경로와 동일한 로컬 base path로 테스트한다.
2. Leaflet, ECharts, 아이콘, 폰트 등 외부 CDN 의존성을 자체 정적 자산 또는 번들로 줄인다.
3. 공통 디자인 토큰, 라우터, 지도, 차트, 검색, 필터 상태를 React 컴포넌트로 옮길 경계를 확정한다.
4. 공개 대시보드 1개 화면부터 React/Vite로 병행 구현한다.
5. 포털 탑재 방식별로 PoC를 비교한다.
   - 하위 경로 단독 앱
   - 포털 콘텐츠 영역 mount
   - iframe
6. 운영 검수 기준을 통과한 뒤 나머지 화면을 이전한다.

## 최종 권장안

React는 사용해도 된다. 단, 금천구청 포털 탑재를 고려하면 `React + Vite + HashRouter + self-hosted assets + VWorld backend proxy` 조합이 가장 안전하다.

처음부터 전체를 React로 갈아엎기보다 현재 정적 앱의 품질·데이터·지도 안정화를 유지하면서, 공개 대시보드 핵심 화면부터 React/Vite로 병행 전환하는 단계적 접근을 권장한다.
