// 관리자 거버넌스 페이지 — 변경요청 목록·2인 결재(submit/approve/reject)·감사 이벤트
import { useCallback, useEffect, useState } from "react";
import {
  approveChangeRequest,
  loadAuditEvents,
  loadChangeRequests,
  rejectChangeRequest,
  submitChangeRequest,
} from "../adminApi";
import type { AuditEventSummary, ChangeRequestSummary } from "../adminApi";
import { useAdminAuth } from "../AdminAuthContext";
import {
  auditActionLabel,
  canApproveRequest,
  canRejectRequest,
  canSubmitRequest,
  changeRequestStatusClass,
  changeRequestStatusLabel,
  formatGovTime,
  friendlyGovError,
} from "../governanceModel";

// ── 감사 이벤트 패널 ──────────────────────────────────────────

function AuditEventList({
  events,
  loading,
  error,
}: {
  events: AuditEventSummary[];
  loading: boolean;
  error: string | null;
}) {
  if (loading)
    return <p className="gdp-admin-loading-text" role="status">감사 로그를 불러오는 중…</p>;
  if (error) return <p className="gdp-admin-gov-error" role="alert">{error}</p>;
  if (events.length === 0)
    return <p className="gdp-admin-empty">감사 이벤트가 없습니다.</p>;
  return (
    <ol className="gdp-admin-gov-audit-list" aria-label="감사 이벤트">
      {events.map((ev) => (
        <li key={ev.eventId} className="gdp-admin-gov-audit-row">
          <span className="gdp-admin-gov-audit-action">{auditActionLabel(ev.actionCode)}</span>
          <strong className="gdp-admin-gov-audit-target">{ev.targetKey || "—"}</strong>
          <small className="gdp-admin-gov-audit-meta">
            {ev.actorLoginId || "system"} · {formatGovTime(ev.occurredAt)}
          </small>
        </li>
      ))}
    </ol>
  );
}

// ── 변경요청 카드 ─────────────────────────────────────────────

function ChangeRequestCard({
  item,
  myLoginId,
  roles,
  onAction,
}: {
  item: ChangeRequestSummary;
  myLoginId: string;
  roles: string[];
  onAction: (requestId: string, action: "submit" | "approve" | "reject") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const doAction = async (action: "submit" | "approve" | "reject") => {
    setBusy(true);
    setLocalError(null);
    try {
      await onAction(item.requestId, action);
    } catch (err) {
      setLocalError(friendlyGovError(err));
    } finally {
      setBusy(false);
    }
  };

  const showSubmit = canSubmitRequest(item, myLoginId);
  const showApprove = canApproveRequest(item, myLoginId, roles);
  const showReject = canRejectRequest(item, myLoginId, roles);

  return (
    <article className={`gdp-admin-gov-card ${changeRequestStatusClass(item.status)}`}>
      <div className="gdp-admin-gov-card-head">
        <span className={`gdp-admin-gov-status-badge ${changeRequestStatusClass(item.status)}`}>
          {changeRequestStatusLabel(item.status)}
        </span>
        <strong className="gdp-admin-gov-card-title">{item.title}</strong>
      </div>
      {item.description ? (
        <p className="gdp-admin-gov-card-desc">{item.description}</p>
      ) : null}
      <small className="gdp-admin-gov-card-meta">
        {item.targetType} · {item.targetKey} · 요청자: {item.requestedBy} ·{" "}
        {formatGovTime(item.requestedAt)}
        {item.reviewedBy ? ` · 검토: ${item.reviewedBy}` : null}
        {item.reviewComment ? ` · 의견: ${item.reviewComment}` : null}
      </small>

      {localError ? (
        <p className="gdp-admin-gov-error" role="alert">{localError}</p>
      ) : null}

      {(showSubmit || showApprove || showReject) ? (
        <div className="gdp-admin-gov-card-actions">
          {showSubmit ? (
            <button
              type="button"
              className="gdp-admin-gov-btn is-secondary"
              disabled={busy}
              onClick={() => void doAction("submit")}
            >
              {busy ? "처리 중…" : "검토 요청"}
            </button>
          ) : null}
          {showApprove ? (
            <button
              type="button"
              className="gdp-admin-gov-btn is-primary"
              disabled={busy}
              onClick={() => void doAction("approve")}
            >
              {busy ? "처리 중…" : "승인"}
            </button>
          ) : null}
          {showReject ? (
            <button
              type="button"
              className="gdp-admin-gov-btn is-danger"
              disabled={busy}
              onClick={() => void doAction("reject")}
            >
              {busy ? "처리 중…" : "반려"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export function AdminGovernancePage() {
  const { user, logout } = useAdminAuth();
  const myLoginId = user?.loginId ?? "";
  const roles = user?.roles ?? [];

  const [requests, setRequests] = useState<ChangeRequestSummary[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  const [events, setEvents] = useState<AuditEventSummary[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);

  // 상태 필터
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    setReqError(null);
    try {
      const data = await loadChangeRequests(50);
      setRequests(data);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) { void logout(); return; }
      setReqError(friendlyGovError(err));
    } finally {
      setReqLoading(false);
    }
  }, [logout]);

  const fetchEvents = useCallback(async () => {
    setEvLoading(true);
    setEvError(null);
    try {
      const data = await loadAuditEvents(30);
      setEvents(data);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) { void logout(); return; }
      // 403 = REVIEWER/ADMIN 권한 부족 — 조용히 빈 배열
      if (status === 403) { setEvents([]); return; }
      setEvError(friendlyGovError(err));
    } finally {
      setEvLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    void fetchRequests();
    void fetchEvents();
  }, [fetchRequests, fetchEvents]);

  const handleAction = useCallback(
    async (requestId: string, action: "submit" | "approve" | "reject") => {
      if (action === "submit") {
        await submitChangeRequest(requestId);
      } else if (action === "approve") {
        await approveChangeRequest(requestId);
      } else {
        await rejectChangeRequest(requestId);
      }
      // 목록 + 감사 이벤트 동시 갱신
      await Promise.all([fetchRequests(), fetchEvents()]);
    },
    [fetchRequests, fetchEvents],
  );

  const STATUS_OPTIONS = [
    { value: "ALL", label: "전체" },
    { value: "PENDING_REVIEW", label: "검토 대기" },
    { value: "DRAFT", label: "초안" },
    { value: "APPROVED", label: "승인" },
    { value: "REJECTED", label: "반려" },
    { value: "APPLIED", label: "반영" },
  ] as const;

  const filtered =
    statusFilter === "ALL"
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  return (
    <div className="gdp-admin-gov-page">
      {/* 변경요청 패널 */}
      <section className="gdp-admin-gov-section" aria-labelledby="gov-req-title">
        <div className="gdp-admin-gov-section-head">
          <h2 id="gov-req-title" className="gdp-admin-section-title">
            변경 요청
          </h2>
          <button
            type="button"
            className="gdp-admin-log-refresh-btn"
            onClick={() => void fetchRequests()}
            disabled={reqLoading}
          >
            새로고침
          </button>
        </div>

        {/* 상태 필터 */}
        <div className="gdp-admin-gov-filter-row" role="group" aria-label="상태 필터">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`gdp-admin-gov-filter-btn${statusFilter === value ? " is-active" : ""}`}
              onClick={() => setStatusFilter(value)}
            >
              {label}
              {value !== "ALL" ? (
                <span className="gdp-admin-gov-filter-count">
                  {requests.filter((r) => r.status === value).length}
                </span>
              ) : (
                <span className="gdp-admin-gov-filter-count">{requests.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {reqLoading ? (
          <div className="gdp-admin-loading" role="status">
            <span className="gdp-admin-spinner" aria-hidden="true" />
            변경 요청을 불러오는 중…
          </div>
        ) : reqError ? (
          <p className="gdp-admin-gov-error" role="alert">{reqError}</p>
        ) : filtered.length === 0 ? (
          <p className="gdp-admin-empty">해당 상태의 변경 요청이 없습니다.</p>
        ) : (
          <ul className="gdp-admin-gov-list" aria-label="변경 요청 목록">
            {filtered.map((item) => (
              <li key={item.requestId}>
                <ChangeRequestCard
                  item={item}
                  myLoginId={myLoginId}
                  roles={roles}
                  onAction={handleAction}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 감사 이벤트 패널 */}
      <section className="gdp-admin-gov-section" aria-labelledby="gov-audit-title">
        <div className="gdp-admin-gov-section-head">
          <h2 id="gov-audit-title" className="gdp-admin-section-title">
            감사 기록
          </h2>
          <button
            type="button"
            className="gdp-admin-log-refresh-btn"
            onClick={() => void fetchEvents()}
            disabled={evLoading}
          >
            새로고침
          </button>
        </div>
        <AuditEventList events={events} loading={evLoading} error={evError} />
      </section>
    </div>
  );
}
