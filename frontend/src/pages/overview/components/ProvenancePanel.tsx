// 데이터 출처·신선도 공개 패널 — 정상/갱신지연/만료 현황을 시민에게 노출
import type { OverviewModel } from "../overviewTypes";
import { useDatasetHealth } from "../../../data/useDatasetHealth";
import { DATA_STATUS_LABELS, DATA_STATUS_CLASSES, relativeTime } from "../../../data/datasetHealth";

interface Props {
  model: OverviewModel;
}

export function ProvenancePanel({ model }: Props) {
  const { summary, statuses, loading } = useDatasetHealth();

  // 가장 최근 정상 수집 시각
  const latestCollectedAt = statuses
    .map((s) => s.collectedAt)
    .filter(Boolean)
    .sort((a, b) => (b ?? "").localeCompare(a ?? ""))
    .at(0) ?? null;

  return (
    <section className="gdp-provenance" aria-labelledby="gdp-provenance-title">
      <div className="gdp-section-head">
        <div>
          <span>DATA PROVENANCE</span>
          <h2 id="gdp-provenance-title">데이터 상태와 근거</h2>
        </div>
        <a href="#/datasets">카탈로그에서 확인</a>
      </div>

      {!loading && summary.publicCount > 0 && (
        <div className="gdp-provenance-freshness" aria-label="수집 신선도 요약">
          <span>
            <span className={`gdp-status-badge ${DATA_STATUS_CLASSES.AVAILABLE}`}>
              {DATA_STATUS_LABELS.AVAILABLE}
            </span>
            {summary.ok}종
          </span>
          {summary.stale > 0 && (
            <span>
              <span className={`gdp-status-badge ${DATA_STATUS_CLASSES.STALE}`}>
                {DATA_STATUS_LABELS.STALE}
              </span>
              {summary.stale}종
            </span>
          )}
          {summary.badCount > 0 && (
            <span>
              <span className={`gdp-status-badge ${DATA_STATUS_CLASSES.EXPIRED}`}>
                만료·실패
              </span>
              {summary.badCount}종
            </span>
          )}
          {latestCollectedAt && (
            <span className="gdp-provenance-freshness-time">
              마지막 정상 수집 {relativeTime(latestCollectedAt)}
            </span>
          )}
        </div>
      )}

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
