// admin 데이터 건강 패널 모델 — 순수 로직은 src/data/datasetHealth로 승격, admin 전용 클래스 유지
export type {
  MergedDatasetHealth,
  HealthSummary,
} from "../data/datasetHealth";
export {
  DATA_STATUS_LABELS,
  summarizeHealth,
  mergeStatusContracts,
  freshnessLabel,
  relativeTime,
} from "../data/datasetHealth";

/** admin 전용 dataStatus CSS 배지 클래스 — 공개 gdp-status-badge--* 와 구분 */
export const DATA_STATUS_CLASSES: Record<string, string> = {
  AVAILABLE: "gdp-admin-health-badge--ok",
  STALE: "gdp-admin-health-badge--stale",
  EXPIRED: "gdp-admin-health-badge--expired",
  NO_SUCCESS: "gdp-admin-health-badge--fail",
};

/** 이용조건 코드 → 한글 라벨 (admin 전용) */
export function termsStatusLabel(status: string | null): string {
  if (status === "CONFIRMED") return "확인됨";
  if (status === "REVIEW_REQUIRED") return "검토 필요";
  return status ?? "-";
}
