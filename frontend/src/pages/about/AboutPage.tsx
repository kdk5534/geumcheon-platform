export function AboutPage() {
  return (
    <section className="gdp-about-page" aria-labelledby="about-title">
      <header className="gdp-operational-hero">
        <div>
          <span>GUIDE</span>
          <h1 id="about-title">데이터 이용안내</h1>
          <p>데이터 기준일, 공개 범위, 갱신 지연, 지도 대체 흐름을 투명하게 안내합니다.</p>
        </div>
      </header>
      <section className="gdp-guide-grid">
        <article>
          <span>공개 범위</span>
          <strong>금천구 GEUMCHEON</strong>
          <p>기본 공개 분석은 금천구 범위로 고정하며 인접 지역은 기본 분석에 포함하지 않습니다.</p>
        </article>
        <article>
          <span>갱신 지연</span>
          <strong>마지막 정상 스냅샷 유지</strong>
          <p>수집 실패 시 기존 정상값을 삭제하지 않고 실패 사실과 기준일을 함께 표시합니다.</p>
        </article>
        <article>
          <span>지도 대체</span>
          <strong>목록으로 동일 과업 수행</strong>
          <p>VWorld 타일이나 브라우저 환경 문제로 지도가 실패해도 목록과 표로 같은 정보를 확인합니다.</p>
        </article>
        <article>
          <span>표현 원칙</span>
          <strong>순위·점수·평가 표현 금지</strong>
          <p>지역을 우수/취약으로 판정하지 않고 원값, 단위, 기준일, 수치 차이만 제공합니다.</p>
        </article>
      </section>
    </section>
  );
}
