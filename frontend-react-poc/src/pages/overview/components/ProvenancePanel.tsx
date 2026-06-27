import type { OverviewModel } from "../overviewTypes";

interface Props {
  model: OverviewModel;
}

export function ProvenancePanel({ model }: Props) {
  return (
    <section className="gdp-provenance" aria-labelledby="gdp-provenance-title">
      <div className="gdp-section-head">
        <div>
          <span>DATA PROVENANCE</span>
          <h2 id="gdp-provenance-title">데이터 상태와 근거</h2>
        </div>
        <a href="#/datasets">카탈로그에서 확인</a>
      </div>
      <dl>
        {model.provenance.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="gdp-provenance-note">
        공개 화면은 마지막 정상 스냅샷을 우선 표시하며, 수집 실패나 빈 결과는 데이터 상태와 함께 안내합니다.
      </p>
    </section>
  );
}
