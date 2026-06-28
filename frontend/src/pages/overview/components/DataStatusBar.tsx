import type { OverviewModel, OverviewTopic } from "../overviewTypes";

interface Props {
  model: OverviewModel;
  loadState: "loading" | "ready" | "fallback" | "error";
  topic: OverviewTopic;
  district: string;
  breakdown: string;
  expanded: boolean;
  onToggle: () => void;
}

const loadStateLabel = {
  loading: "데이터 연결 중",
  ready: "운영 데이터 연결",
  fallback: "대체 데이터 표시",
  error: "연결 오류",
};

export function DataStatusBar({ model, loadState, topic, district, breakdown, expanded, onToggle }: Props) {
  return (
    <section className={`gdp-data-status is-${loadState} ${expanded ? "is-expanded" : ""}`} aria-label="데이터 상태">
      <button type="button" onClick={onToggle} aria-expanded={expanded}>
        <span>{loadStateLabel[loadState]}</span>
        <strong>{model.sourceMode}</strong>
        <small>{model.asOf}</small>
      </button>
      {expanded ? (
        <div className="gdp-data-status-detail">
          <div>
            <span>활성 필터</span>
            <strong>
              {topic} · {district || "금천구 전체"}
              {breakdown ? ` · ${breakdown}` : ""}
            </strong>
          </div>
          <div>
            <span>시설 행</span>
            <strong>{model.facilities.length.toLocaleString("ko-KR")}행</strong>
          </div>
          <div>
            <span>행정동</span>
            <strong>{model.districts.length.toLocaleString("ko-KR")}개</strong>
          </div>
          <div>
            <span>공급 방식</span>
            <strong>VWorld backend proxy</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}
