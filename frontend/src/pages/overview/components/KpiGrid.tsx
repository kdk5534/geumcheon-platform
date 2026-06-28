import type { MetricCard } from "../overviewTypes";

interface Props {
  metrics: MetricCard[];
}

export function KpiGrid({ metrics }: Props) {
  return (
    <section className="gdp-kpi-section" aria-labelledby="gdp-kpi-title">
      <div className="gdp-section-head">
        <div>
          <span>KEY MEASURES</span>
          <h2 id="gdp-kpi-title">대표 지표</h2>
        </div>
        <p>평가 표현 없이 원값, 단위, 기준, 출처를 함께 표시합니다.</p>
      </div>
      <div className="gdp-kpi-grid">
        {metrics.map((metric) => (
          <article className={`gdp-kpi-card is-${metric.accent}`} key={metric.key}>
            <div>
              <span>{metric.label}</span>
              <em>{metric.status}</em>
            </div>
            <strong>{metric.value}</strong>
            <small>{metric.source}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
