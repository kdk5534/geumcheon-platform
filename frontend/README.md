# 금천 데이터플랫폼 React/Vite PoC

이 디렉터리는 기존 `frontend-static`을 대체하지 않는다. `종합 현황` 1개 화면만 React/Vite로 병행 구현해 품질, 성능, 접근성, 포털 탑재성을 비교하기 위한 PoC다.

## 전제

- React + Vite + TypeScript
- HashRouter 사용
- VWorld는 백엔드 프록시 사용
- 정적 빌드 산출물을 포털 하위 경로에 배치 가능해야 함
- CSS는 `.gdp-app` namespace 아래로 제한

## 실행

의존성 설치가 필요한 단계다.

```powershell
npm install
npm run dev
```

운영 경로 테스트:

```powershell
$env:GDP_BASE_PATH="/data-platform/"
npm run build
npm run preview
```

## 통과 기준

- `npm run build` 성공
- hash route 동작
- VWorld 지도 정상 또는 목록 fallback 정상
- 390px, 768px, 1440px에서 overflow 없음
- axe 중대/심각 오류 0건
- 기존 정적 `#/home`보다 컴포넌트/상태 구조가 명확함
