import type { OverviewModel, OverviewTopic } from "../overviewTypes";
import { LinkedChart } from "./LinkedChart";

interface Props {
  model: OverviewModel;
  topic: OverviewTopic;
  district: string;
  activeLabel: string;
  selectedBreakdown: string;
  onTopicChange: (topic: OverviewTopic) => void;
  onDistrictChange: (district: string) => void;
  onBreakdownChange: (breakdown: string) => void;
}

const topics: Array<{ key: OverviewTopic; label: string; desc: string }> = [
  { key: "population", label: "인구", desc: "거주와 구성" },
  { key: "commercial", label: "상권", desc: "업종과 변화" },
  { key: "welfare", label: "복지", desc: "도움과 시설" },
  { key: "safety", label: "안전", desc: "환경과 상황" },
];

export function OverviewAnalysisPanel({
  model,
  topic,
  district,
  activeLabel,
  selectedBreakdown,
  onTopicChange,
  onDistrictChange,
  onBreakdownChange,
}: Props) {
  return (
    <aside className="gdp-analysis-panel">
      <header className="gdp-panel-head">
        <div>
          <span>CONTROL PANEL</span>
          <h2>분석 조건</h2>
        </div>
        <span className="gdp-state-pill">{model.sourceMode}</span>
      </header>

      <section className="gdp-topic-control" aria-labelledby="gdp-topic-title">
        <div className="gdp-control-row">
          <div>
            <span>STEP 01</span>
            <strong id="gdp-topic-title">관심 주제 선택</strong>
          </div>
          <label>
            지역
            <select value={district} onChange={(event) => onDistrictChange(event.target.value)}>
              <option value="">금천구 전체</option>
              {model.districts.map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="gdp-topic-buttons" role="group" aria-label="관심 주제">
          {topics.map((item) => (
            <button
              className={topic === item.key ? "is-active" : ""}
              key={item.key}
              type="button"
              aria-pressed={topic === item.key}
              onClick={() => onTopicChange(item.key)}
            >
              <span>{item.label}</span>
              <small>{item.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="gdp-active-filter" aria-live="polite">
        <span>현재 선택</span>
        <strong>{activeLabel}</strong>
        <button type="button" onClick={() => onDistrictChange("")}>
          전체 해제
        </button>
      </section>

      {selectedBreakdown ? (
        <section className="gdp-filter-chip-row" aria-label="활성 교차 필터">
          <span className="gdp-filter-chip">
            차트 선택: <strong>{selectedBreakdown}</strong>
            <button type="button" aria-label="차트 선택 해제" onClick={() => onBreakdownChange("")}>
              ×
            </button>
          </span>
        </section>
      ) : null}

      <section className="gdp-district-shortcuts" aria-label="행정동 빠른 선택">
        {model.districts.slice(0, 7).map((name) => (
          <button
            key={name}
            className={district === name ? "is-active" : ""}
            type="button"
            aria-pressed={district === name}
            onClick={() => onDistrictChange(name)}
          >
            {name}
          </button>
        ))}
      </section>

      <section className="gdp-linked-chart" aria-label="연동 차트 자리">
        <div className="gdp-linked-chart-copy">
          <span>LINKED CHART</span>
          <strong>차트·지도·표 교차 필터</strong>
          <p>주제 선택에 따라 같은 모델에서 차트가 갱신됩니다.</p>
        </div>
        <LinkedChart
          model={model}
          topic={topic}
          selectedBreakdown={selectedBreakdown}
          onSelectBreakdown={onBreakdownChange}
        />
      </section>
    </aside>
  );
}
