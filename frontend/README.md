# 금천 데이터플랫폼 프론트엔드

React 19+Vite+TypeScript 정식 메인 프론트엔드. 공개 화면 16개 + 관리자 콘솔(별도 엔트리 admin.html)로 구성된다.

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
