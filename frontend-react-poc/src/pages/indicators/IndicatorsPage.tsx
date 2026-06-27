import { useEffect, useState } from "react";
import { adaptOverviewModel } from "../../data/overviewAdapter";
import { loadPublicData } from "../../data/publicApi";
import { overviewModel } from "../overview/overviewModel";
import type { OverviewModel } from "../overview/overviewTypes";

export function IndicatorsPage() {
  const [model, setModel] = useState<OverviewModel>(overviewModel);

  useEffect(() => {
    const controller = new AbortController();
    loadPublicData(controller.signal)
      .then((bundle) => {
        if (!controller.signal.aborted) setModel(adaptOverviewModel(bundle));
      })
      .catch(() => {
        if (!controller.signal.aborted) setModel(overviewModel);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="gdp-indicators-page" aria-labelledby="indicators-title">
      <header className="gdp-operational-hero">
        <div>
          <span>INDICATOR LIBRARY</span>
          <h1 id="indicators-title">핵심 지표</h1>
          <p>지표의 정의, 단위, 기준일, 출처를 먼저 보여줍니다. 서로 다른 단위를 무리하게 점수화하지 않습니다.</p>
        </div>
      </header>

      <section className="gdp-indicator-grid" aria-label="핵심 지표 목록">
        {model.metrics.map((metric) => (
          <article key={metric.key} className={`is-${metric.accent}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <dl>
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
    </section>
  );
}
