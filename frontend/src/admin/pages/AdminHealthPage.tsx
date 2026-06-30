// 데이터 건강 패널 — 수집 신선도·SLA·품질 상태를 백엔드 API로 표시
import { useEffect, useState } from "react";
import { loadDatasetStatuses, loadDatasetContracts } from "../adminApi";
import type { DatasetOperationalStatus, DatasetContract } from "../adminApi";
import {
  summarizeHealth,
  mergeStatusContracts,
  DATA_STATUS_LABELS,
  DATA_STATUS_CLASSES,
  freshnessLabel,
  relativeTime,
  termsStatusLabel,
} from "../healthModel";

export function AdminHealthPage() {
  const [statuses, setStatuses] = useState<DatasetOperationalStatus[]>([]);
  const [contracts, setContracts] = useState<DatasetContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // status + contracts를 병렬 로드. 한쪽 실패해도 가능한 만큼 렌더.
    Promise.allSettled([loadDatasetStatuses(), loadDatasetContracts()])
      .then(([statusResult, contractResult]) => {
        if (statusResult.status === "fulfilled") setStatuses(statusResult.value);
        if (contractResult.status === "fulfilled") setContracts(contractResult.value);
        if (statusResult.status === "rejected" && contractResult.status === "rejected") {
          setError("데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="gdp-admin-loading" role="status" aria-live="polite">
        <span className="gdp-admin-spinner" aria-hidden="true" />
        데이터 건강 정보를 불러오는 중…
      </div>
    );
  }

  if (error) {
    return <p className="gdp-admin-load-error">{error}</p>;
  }

  const summary = summarizeHealth(statuses);
  const merged = mergeStatusContracts(statuses, contracts);

  return (
    <div className="gdp-admin-health-page">
      <h1 className="gdp-admin-section-title">데이터 건강 현황</h1>

      {/* 4카드 요약 — 수집정상 / 갱신지연 / 만료·실패 / 공개대상 */}
      <div className="gdp-admin-health-summary" role="list" aria-label="건강 상태 요약">
        <div className="gdp-admin-health-card gdp-admin-health-card--ok" role="listitem">
          <span className="gdp-admin-health-card-count">{summary.ok}</span>
          <span className="gdp-admin-health-card-label">수집 정상</span>
        </div>
        <div className="gdp-admin-health-card gdp-admin-health-card--stale" role="listitem">
          <span className="gdp-admin-health-card-count">{summary.stale}</span>
          <span className="gdp-admin-health-card-label">갱신 지연</span>
        </div>
        <div className="gdp-admin-health-card gdp-admin-health-card--fail" role="listitem">
          <span className="gdp-admin-health-card-count">{summary.badCount}</span>
          <span className="gdp-admin-health-card-label">만료·실패</span>
        </div>
        <div className="gdp-admin-health-card gdp-admin-health-card--total" role="listitem">
          <span className="gdp-admin-health-card-count">{summary.publicCount}</span>
          <span className="gdp-admin-health-card-label">공개 대상</span>
        </div>
      </div>

      {/* 데이터셋별 상세 표 */}
      {merged.length === 0 ? (
        <p className="gdp-admin-empty">표시할 데이터셋이 없습니다.</p>
      ) : (
        <div className="gdp-admin-health-table-wrap">
          <table className="gdp-admin-health-table">
            <thead>
              <tr>
                <th scope="col">데이터셋</th>
                <th scope="col">도메인</th>
                <th scope="col">상태</th>
                <th scope="col">마지막 정상 수집</th>
                <th scope="col">저장 건수</th>
                <th scope="col">SLA</th>
                <th scope="col">이용조건</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((row) => (
                <tr key={row.datasetKey} className="gdp-admin-health-row">
                  <td>
                    <span className="gdp-admin-health-ds-name">{row.datasetName}</span>
                    {row.failureType && (
                      <span className="gdp-admin-health-failure-type"> ({row.failureType})</span>
                    )}
                  </td>
                  <td>{row.domain}</td>
                  <td>
                    <span
                      className={`gdp-admin-health-badge ${DATA_STATUS_CLASSES[row.dataStatus] ?? "gdp-admin-health-badge--unknown"}`}
                    >
                      {DATA_STATUS_LABELS[row.dataStatus] ?? row.dataStatus}
                    </span>
                  </td>
                  <td>{relativeTime(row.collectedAt)}</td>
                  <td>
                    {row.lastSuccessSavedRecordCount != null
                      ? row.lastSuccessSavedRecordCount.toLocaleString()
                      : "-"}
                  </td>
                  <td>{freshnessLabel(row.freshnessHours)}</td>
                  <td>{termsStatusLabel(row.termsStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
