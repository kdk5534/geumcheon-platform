// admin 데이터 건강 패널 — 순수 모델 로직(UI·DOM 비의존)
import type { DatasetOperationalStatus, DatasetContract } from "./adminApi";

/** dataStatus 별 한글 라벨 */
export const DATA_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "정상",
  STALE: "갱신 지연",
  EXPIRED: "만료",
  NO_SUCCESS: "수집 실패",
};

/** dataStatus 별 CSS 배지 수정자 클래스 */
export const DATA_STATUS_CLASSES: Record<string, string> = {
  AVAILABLE: "gdp-admin-health-badge--ok",
  STALE: "gdp-admin-health-badge--stale",
  EXPIRED: "gdp-admin-health-badge--expired",
  NO_SUCCESS: "gdp-admin-health-badge--fail",
};

/** 요약 카드 4개에 대응하는 집계 결과 */
export interface HealthSummary {
  ok: number;
  stale: number;
  /** EXPIRED + NO_SUCCESS 합산 */
  badCount: number;
  publicCount: number;
}

/** status 배열을 4카드 요약으로 집계 */
export function summarizeHealth(statuses: DatasetOperationalStatus[]): HealthSummary {
  const ok = statuses.filter((s) => s.dataStatus === "AVAILABLE").length;
  const stale = statuses.filter((s) => s.dataStatus === "STALE").length;
  const badCount = statuses.filter(
    (s) => s.dataStatus === "EXPIRED" || s.dataStatus === "NO_SUCCESS",
  ).length;
  return { ok, stale, badCount, publicCount: statuses.length };
}

/** 데이터셋별 건강 정보 — status + contract 병합 결과 */
export interface MergedDatasetHealth {
  datasetKey: string;
  datasetName: string;
  domain: string;
  dataStatus: string;
  collectedAt: string | null;
  lastSuccessSavedRecordCount: number | null;
  attemptStatus: string | null;
  failureType: string | null;
  freshnessHours: number | null;
  termsStatus: string | null;
  privacyRisk: string | null;
}

/** status + contract를 datasetKey 기준으로 병합 */
export function mergeStatusContracts(
  statuses: DatasetOperationalStatus[],
  contracts: DatasetContract[],
): MergedDatasetHealth[] {
  const contractMap = new Map(contracts.map((c) => [c.datasetKey, c]));
  return statuses.map((s) => {
    const c = contractMap.get(s.datasetKey);
    return {
      datasetKey: s.datasetKey,
      datasetName: s.datasetName,
      domain: s.domain,
      dataStatus: s.dataStatus,
      collectedAt: s.collectedAt,
      lastSuccessSavedRecordCount: s.lastSuccessSavedRecordCount,
      attemptStatus: s.attemptStatus,
      failureType: s.failureType,
      freshnessHours: c?.freshnessHours ?? null,
      termsStatus: c?.termsStatus ?? null,
      privacyRisk: c?.privacyRisk ?? null,
    };
  });
}

/** SLA 시간(hours) → 한글 표시 ("N시간" / "N일") */
export function freshnessLabel(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}

/** ISO 날짜 문자열 → 상대시각 ("N분 전" / "N시간 전" / "N일 전") */
export function relativeTime(iso: string | null): string {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
}

/** 이용조건 코드 → 한글 라벨 */
export function termsStatusLabel(status: string | null): string {
  if (status === "CONFIRMED") return "확인됨";
  if (status === "REVIEW_REQUIRED") return "검토 필요";
  return status ?? "-";
}
