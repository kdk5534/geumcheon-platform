// 데이터셋 신선도·계약 정보를 공개 API에서 로드하는 데이터 계층 — src/admin에서 승격
import { BACKEND_API_BASE, API_TIMEOUT_MS } from "./env";

/** 데이터셋 운영 상태 — GET /api/public/datasets/status 응답 항목 */
export interface DatasetOperationalStatus {
  datasetKey: string;
  datasetName: string;
  domain: string;
  sourceName: string;
  attemptStatus: string | null;
  attemptedAt: string | null;
  attemptSourceRecordCount: number | null;
  attemptSavedRecordCount: number | null;
  failureType: string | null;
  /** AVAILABLE | STALE | EXPIRED | NO_SUCCESS */
  dataStatus: string;
  collectedAt: string | null;
  lastSuccessSourceRecordCount: number | null;
  lastSuccessSavedRecordCount: number | null;
}

/** 데이터셋 계약(SLA·품질·이용조건) — GET /api/public/datasets/contracts 응답 항목 */
export interface DatasetContract {
  datasetKey: string;
  datasetName: string;
  domain: string;
  sourceName: string;
  refreshCycle: string | null;
  freshnessHours: number | null;
  lastGoodRetentionDays: number | null;
  minimumRows: number | null;
  maximumRows: number | null;
  collectionEnabled: boolean;
  technicalStatus: string | null;
  termsStatus: string | null;
  privacyRisk: string | null;
  accessMode: string | null;
  licenseName: string | null;
}

/** dataStatus 별 한글 라벨 */
export const DATA_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "정상",
  STALE: "갱신 지연",
  EXPIRED: "만료",
  NO_SUCCESS: "수집 실패",
};

/** dataStatus 별 공개 배지 CSS 수정자 클래스 */
export const DATA_STATUS_CLASSES: Record<string, string> = {
  AVAILABLE: "gdp-status-badge--ok",
  STALE: "gdp-status-badge--stale",
  EXPIRED: "gdp-status-badge--expired",
  NO_SUCCESS: "gdp-status-badge--fail",
};

/** 요약 카드 4종에 대응하는 집계 결과 */
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

// ── 공개 API 로더 (인증 불필요) ─────────────────────────────────

async function fetchPublicJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as { success?: boolean; data?: T };
    if (!payload.success || !Array.isArray(payload.data)) return null;
    return payload.data as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** 공개 데이터셋 운영 상태 목록 — GET /api/public/datasets/status */
export async function loadDatasetStatuses(): Promise<DatasetOperationalStatus[]> {
  return (await fetchPublicJson<DatasetOperationalStatus[]>(
    `${BACKEND_API_BASE}/api/public/datasets/status`,
  )) ?? [];
}

/** 데이터셋 계약(SLA·품질·이용조건) 목록 — GET /api/public/datasets/contracts */
export async function loadDatasetContracts(): Promise<DatasetContract[]> {
  return (await fetchPublicJson<DatasetContract[]>(
    `${BACKEND_API_BASE}/api/public/datasets/contracts`,
  )) ?? [];
}
