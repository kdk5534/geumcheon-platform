// 핵심 지표 페이지 — KPI 카드 + 인구·상권 분포 차트 제공
import { useState } from "react";
import { usePublicData } from "../../data/PublicDataContext";
import { ChartFrame, SeriesChart } from "../../components/charts";

export function IndicatorsPage() {
  const { model } = usePublicData();
  const [selectedPop, setSelectedPop] = useState("");
  const [selectedStore, setSelectedStore] = useState("");

  return (
    <section className="gdp-indicators-page" aria-labelledby="indicators-title">
      <header className="gdp-operational-hero">
        <div>
          <span>INDICATOR LIBRARY</span>
          <h1 id="indicators-title">핵심 지표</h1>
          <p>지표의 정의, 단위, 기준일, 출처를 먼저 확인합니다. 서로 다른 단위를 무리하게 점수화하지 않습니다.</p>
        </div>
      </header>

      <section className="gdp-indicator-grid" aria-label="핵심 지표 목록">
        {model.metrics.map((metric) => (
          <article key={metric.key} className={`gdp-indicator-card is-${metric.accent}`}>
            <span className="gdp-indicator-card__label">{metric.label}</span>
            <strong className="gdp-indicator-card__value">{metric.value}</strong>
            <dl className="gdp-indicator-card__meta">
              <div>
                <dt>상태</dt>
                <dd>{metric.status}</dd>
              </div>
              <div>
                <dt>출처</dt>
                <dd>{metric.source}</dd>
              </div>
              <div>
                <dt>기준</dt>
                <dd>{model.asOf}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      {model.populationSeries.length > 0 && (
        <section className="gdp-indicators-charts" aria-label="분포 차트">
          <ChartFrame
            title="행정동별 인구 분포"
            caption="주민등록 기준 행정동별 원값. 막대를 클릭하면 행정동을 선택합니다."
            height={220}
          >
            <SeriesChart
              data={model.populationSeries}
              kind="bar"
              selectedName={selectedPop}
              onSelect={setSelectedPop}
              height={220}
              ariaLabel="행정동별 인구 분포 막대 차트"
            />
          </ChartFrame>

          {model.storeCategorySeries.length > 0 && (
            <ChartFrame
              title="상가업소 업종 구성"
              caption="GEUMCHEON 범위 상가업소 업종별 건수 상위 8개. 추천·순위 없음."
              height={220}
            >
              <SeriesChart
                data={model.storeCategorySeries}
                kind="pie"
                selectedName={selectedStore}
                onSelect={setSelectedStore}
                height={220}
                ariaLabel="상가업소 업종 구성 파이 차트"
              />
            </ChartFrame>
          )}
        </section>
      )}
    </section>
  );
}
