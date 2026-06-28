// 거버넌스·2인 결재 순수 로직 — DOM·React 의존 없음. static admin.js 포팅.

import type { ChangeRequestSummary } from "./adminApi";

// ── 상태 라벨 / CSS ────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안",
  PENDING_REVIEW: "검토 대기",
  APPROVED: "승인",
  REJECTED: "반려",
  APPLIED: "반영",
  ROLLED_BACK: "복구",
};

/** 변경요청 상태 코드를 한국어 라벨로 변환 */
export function changeRequestStatusLabel(status: string | null | undefined): string {
  const key = String(status ?? "").trim().toUpperCase();
  return STATUS_LABELS[key] ?? (status ?? "");
}

/** 변경요청 상태 CSS 클래스 접미사 — "is-draft", "is-pending-review" 등 */
export function changeRequestStatusClass(status: string | null | undefined): string {
  const key = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  return key ? `is-${key}` : "";
}

// ── 역할 판정 ─────────────────────────────────────────────────

/** ADMIN 또는 REVIEWER 역할 보유 여부 */
export function hasReviewRole(roles: string[]): boolean {
  return roles.some((r) =>
    ["ADMIN", "REVIEWER", "ROLE_ADMIN", "ROLE_REVIEWER"].includes(r),
  );
}

/** ADMIN 또는 OPERATOR 역할 보유 여부 */
export function hasOperatorRole(roles: string[]): boolean {
  return roles.some((r) =>
    ["ADMIN", "OPERATOR", "ROLE_ADMIN", "ROLE_OPERATOR"].includes(r),
  );
}

// ── 동작 가능 여부 판정 ────────────────────────────────────────

/**
 * 검토 요청(submit) 버튼 표시 여부.
 * - 상태가 DRAFT 이고 본인이 요청한 경우
 */
export function canSubmitRequest(
  item: ChangeRequestSummary,
  myLoginId: string,
): boolean {
  return item.status === "DRAFT" && item.requestedBy === myLoginId;
}

/**
 * 승인(approve) 버튼 표시 여부.
 * - 상태가 PENDING_REVIEW 이고
 * - 본인이 아닌 다른 사람의 요청이며
 * - ADMIN 또는 REVIEWER 역할 보유
 */
export function canApproveRequest(
  item: ChangeRequestSummary,
  myLoginId: string,
  roles: string[],
): boolean {
  return (
    item.status === "PENDING_REVIEW" &&
    item.requestedBy !== myLoginId &&
    hasReviewRole(roles)
  );
}

/**
 * 반려(reject) 버튼 표시 여부.
 * - canApprove와 동일 조건
 */
export function canRejectRequest(
  item: ChangeRequestSummary,
  myLoginId: string,
  roles: string[],
): boolean {
  return canApproveRequest(item, myLoginId, roles);
}

// ── 시간 포맷 ─────────────────────────────────────────────────

/** 거버넌스 시각을 한국어 로케일로 포맷 */
export function formatGovTime(value: string | null | undefined): string {
  if (!value) return "시각 없음";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("ko-KR");
  } catch {
    return String(value);
  }
}

// ── 감사 이벤트 ───────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  CHANGE_REQUEST_CREATED: "생성",
  CHANGE_REQUEST_SUBMITTED: "검토 요청",
  CHANGE_REQUEST_APPROVED: "승인",
  CHANGE_REQUEST_REJECTED: "반려",
  CHANGE_REQUEST_APPLIED: "반영",
  CHANGE_REQUEST_ROLLED_BACK: "복구",
  UPLOAD_COMMITTED: "즉시 반영",
  UPLOAD_STAGED: "스테이징",
  UPLOAD_APPLIED: "업로드 반영",
  UPLOAD_FAILED: "업로드 실패",
};

/** 감사 이벤트 액션 코드를 한국어 라벨로 변환 */
export function auditActionLabel(actionCode: string | null | undefined): string {
  const key = String(actionCode ?? "").trim().toUpperCase();
  return ACTION_LABELS[key] ?? (actionCode ?? "");
}

// ── 에러 변환 ─────────────────────────────────────────────────

/** 거버넌스 API 에러를 사용자 친화적 메시지로 변환 */
export function friendlyGovError(err: unknown): string {
  const e = err as { status?: number; message?: string; isApiFailure?: boolean };
  if (e.status === 401 || e.status === 403)
    return "세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (e.status === 409) return "이미 처리된 요청입니다.";
  if (e.status === 422 || e.status === 400)
    return e.message ?? "요청 형식이 올바르지 않습니다.";
  if (e.isApiFailure) return e.message ?? "요청 처리에 실패했습니다.";
  return "서버에 연결할 수 없습니다.";
}
