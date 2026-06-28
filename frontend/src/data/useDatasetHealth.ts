// 데이터셋 신선도·계약 정보를 공개 API에서 병렬 로드하는 훅
import { useEffect, useState } from "react";
import {
  loadDatasetStatuses,
  loadDatasetContracts,
  mergeStatusContracts,
  summarizeHealth,
} from "./datasetHealth";
import type { DatasetOperationalStatus, DatasetContract, MergedDatasetHealth, HealthSummary } from "./datasetHealth";

export interface DatasetHealthState {
  statuses: DatasetOperationalStatus[];
  contracts: DatasetContract[];
  merged: MergedDatasetHealth[];
  summary: HealthSummary;
  loading: boolean;
}

const EMPTY_SUMMARY: HealthSummary = { ok: 0, stale: 0, badCount: 0, publicCount: 0 };

/**
 * 데이터셋 신선도·계약 정보를 공개 API에서 병렬 로드하는 훅.
 * 실패 시 빈 배열로 graceful 폴백.
 */
export function useDatasetHealth(): DatasetHealthState {
  const [state, setState] = useState<DatasetHealthState>({
    statuses: [],
    contracts: [],
    merged: [],
    summary: EMPTY_SUMMARY,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([loadDatasetStatuses(), loadDatasetContracts()]).then(
      ([statusResult, contractResult]) => {
        if (cancelled) return;
        const statuses =
          statusResult.status === "fulfilled" ? statusResult.value : [];
        const contracts =
          contractResult.status === "fulfilled" ? contractResult.value : [];
        setState({
          statuses,
          contracts,
          merged: mergeStatusContracts(statuses, contracts),
          summary: summarizeHealth(statuses),
          loading: false,
        });
      },
    );
    return () => { cancelled = true; };
  }, []);

  return state;
}
