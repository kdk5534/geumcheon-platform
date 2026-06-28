// 관리자 업로드 페이지 — CSV/Excel 미리보기·컬럼 매핑·확정(commit)/승인요청(stage)·수집 로그
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { BACKEND_API_BASE } from "../../data/env";
import {
  fetchAdminJson,
  previewCsvOnBackend,
} from "../adminApi";
import type {
  AdminApiPayload,
  CsvUploadPreview,
  StagedUploadSummary,
  UploadCommitRequest,
  UploadLogSummary,
} from "../adminApi";
import { useAdminAuth } from "../AdminAuthContext";
import {
  buildInitialMapping,
  canCommit,
  fieldLabel,
  fieldSchemaFor,
  fileKind,
  formatBytes,
  formatLogTime,
  friendlyUploadError,
  hasCommitRole,
  hasStageRole,
  isUploadable,
  uploadStatusClass,
  uploadStatusLabel,
  validateMappingSoft,
} from "../uploadModel";

interface AdminDatasetSummary {
  datasetKey: string;
  datasetName: string;
  domain: string;
  uploadMode: string;
  supportsUploadCommit: boolean;
  publicVisible: boolean;
}

// ── 수집 로그 패널 ────────────────────────────────────────────

function UploadLogList({ logs, loading }: { logs: UploadLogSummary[]; loading: boolean }) {
  if (loading) {
    return <p className="gdp-admin-loading-text" role="status">로그를 불러오는 중…</p>;
  }
  if (logs.length === 0) {
    return <p className="gdp-admin-empty">아직 업로드 로그가 없습니다.</p>;
  }
  return (
    <ul className="gdp-admin-upload-log-list" aria-label="수집 로그">
      {logs.map((log) => (
        <li
          key={`${log.logId}-${log.createdAt}`}
          className={`gdp-admin-upload-log-item ${uploadStatusClass(log.status)}`}
        >
          <div className="gdp-admin-upload-log-head">
            <strong className="gdp-admin-upload-log-name">{log.datasetName}</strong>
            <span className={`gdp-admin-upload-status-badge ${uploadStatusClass(log.status)}`}>
              {uploadStatusLabel(log.status)}
            </span>
          </div>
          <span className="gdp-admin-upload-log-file">{log.fileName}</span>
          <span className="gdp-admin-upload-log-meta">
            원본 {log.rowCount.toLocaleString()}행 · 저장 {log.savedRowCount.toLocaleString()}행 ·
            제외 {log.skippedRowCount.toLocaleString()}행 · {log.columnCount}개 컬럼 ·{" "}
            {formatLogTime(log.createdAt)}
          </span>
          {log.message ? <p className="gdp-admin-upload-log-msg">{log.message}</p> : null}
        </li>
      ))}
    </ul>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export function AdminUploadPage() {
  const { user, logout } = useAdminAuth();
  const [searchParams] = useSearchParams();

  // 데이터셋 목록
  const [datasets, setDatasets] = useState<AdminDatasetSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");

  // 업로드 플로우 상태
  const [preview, setPreview] = useState<CsvUploadPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // 확정/승인요청 상태
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<
    { kind: "commit"; log: UploadLogSummary } | { kind: "stage"; summary: StagedUploadSummary } | null
  >(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // 수집 로그
  const [logs, setLogs] = useState<UploadLogSummary[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 초기 로드 ────────────────────────────────────────────
  useEffect(() => {
    fetchAdminJson<AdminApiPayload<AdminDatasetSummary[]>>(
      `${BACKEND_API_BASE}/api/admin/datasets`,
    )
      .then((payload) => {
        const uploadable = payload.data.filter(isUploadable);
        setDatasets(uploadable);
        const paramKey = searchParams.get("dataset") ?? "";
        const initial =
          (paramKey && uploadable.find((d) => d.datasetKey === paramKey)?.datasetKey) ||
          uploadable[0]?.datasetKey ||
          "";
        setSelectedKey(initial);
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number }).status;
        if (status === 401) void logout();
      });
  }, [logout, searchParams]);

  useEffect(() => {
    loadLogs();
  }, []);

  function loadLogs() {
    setLogsLoading(true);
    fetchAdminJson<AdminApiPayload<UploadLogSummary[]>>(
      `${BACKEND_API_BASE}/api/admin/collection-logs?limit=20`,
    )
      .then((payload) => setLogs(payload.data))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }

  // ── 데이터셋 선택 ─────────────────────────────────────────
  function handleDatasetChange(e: ChangeEvent<HTMLSelectElement>) {
    setSelectedKey(e.target.value);
    resetPreview();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetPreview() {
    setPreview(null);
    setPreviewError(null);
    setMapping({});
    setCommitResult(null);
    setCommitError(null);
  }

  // ── 파일 선택 → preview ───────────────────────────────────
  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedKey) return;

    const kind = fileKind(file);
    if (kind === "unsupported") {
      setPreviewError("CSV 또는 Excel 파일만 지원합니다.");
      setPreview(null);
      return;
    }

    resetPreview();
    setPreviewLoading(true);
    try {
      const result = await previewCsvOnBackend(selectedKey, file);
      setPreview(result);
      setMapping(buildInitialMapping(result.headers, selectedKey));
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        void logout();
        return;
      }
      setPreviewError(friendlyUploadError(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── 컬럼 매핑 변경 ────────────────────────────────────────
  function handleMappingChange(csvHeader: string, fieldKey: string) {
    setMapping((prev) => ({ ...prev, [csvHeader]: fieldKey }));
  }

  // ── 확정/승인요청 ─────────────────────────────────────────
  const currentDataset = datasets.find((d) => d.datasetKey === selectedKey) ?? null;
  const roles = user?.roles ?? [];
  const userCanCommit = currentDataset && canCommit(currentDataset) && hasCommitRole(roles);
  const userCanStage = currentDataset && canCommit(currentDataset) && hasStageRole(roles);
  const actionLabel = userCanCommit
    ? "확정 반영"
    : userCanStage
      ? "승인 요청"
      : null;

  async function handleCommit() {
    if (!preview || !currentDataset) return;
    const body: UploadCommitRequest = {
      datasetKey: preview.datasetKey,
      uploadId: preview.uploadId,
      fileName: preview.fileName,
      rowCount: preview.rowCount,
      columnCount: preview.columnCount,
      columnMappings: mapping,
    };
    setCommitting(true);
    setCommitError(null);
    setCommitResult(null);
    try {
      if (userCanCommit) {
        const payload = await fetchAdminJson<AdminApiPayload<UploadLogSummary>>(
          `${BACKEND_API_BASE}/api/admin/uploads/commit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        setCommitResult({ kind: "commit", log: payload.data });
        loadLogs();
      } else if (userCanStage) {
        const payload = await fetchAdminJson<AdminApiPayload<StagedUploadSummary>>(
          `${BACKEND_API_BASE}/api/admin/uploads/stage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        setCommitResult({ kind: "stage", summary: payload.data });
      }
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        void logout();
        return;
      }
      setCommitError(friendlyUploadError(err));
    } finally {
      setCommitting(false);
    }
  }

  // ── 렌더 ─────────────────────────────────────────────────
  const schema = selectedKey ? fieldSchemaFor(selectedKey) : null;
  const validation =
    schema && preview ? validateMappingSoft(schema, mapping) : null;

  return (
    <div className="gdp-admin-upload-page">
      {/* 데이터셋 + 파일 선택 */}
      <section className="gdp-admin-upload-controls" aria-labelledby="upload-controls-title">
        <h2 id="upload-controls-title" className="gdp-admin-section-title">
          CSV / Excel 업로드
        </h2>

        <div className="gdp-admin-upload-row">
          <label htmlFor="upload-dataset-select" className="gdp-admin-upload-label">
            대상 데이터셋
          </label>
          {datasets.length === 0 ? (
            <p className="gdp-admin-empty">업로드 가능한 데이터셋이 없습니다.</p>
          ) : (
            <select
              id="upload-dataset-select"
              className="gdp-admin-upload-select"
              value={selectedKey}
              onChange={handleDatasetChange}
            >
              {datasets.map((d) => (
                <option key={d.datasetKey} value={d.datasetKey}>
                  {d.datasetName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="gdp-admin-upload-row">
          <label htmlFor="upload-file-input" className="gdp-admin-upload-label">
            파일 선택 (CSV / Excel)
          </label>
          <input
            id="upload-file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="gdp-admin-upload-file-input"
            ref={fileInputRef}
            disabled={!selectedKey || datasets.length === 0}
            onChange={(e) => void handleFileChange(e)}
          />
        </div>
      </section>

      {/* 미리보기 */}
      {previewLoading ? (
        <div className="gdp-admin-loading" role="status">
          <span className="gdp-admin-spinner" aria-hidden="true" />
          파일을 분석하는 중…
        </div>
      ) : previewError ? (
        <p className="gdp-admin-upload-error" role="alert">
          {previewError}
        </p>
      ) : preview ? (
        <section className="gdp-admin-upload-preview" aria-labelledby="preview-title">
          <h3 id="preview-title" className="gdp-admin-upload-section-title">
            미리보기
          </h3>

          {/* 요약 */}
          <div className="gdp-admin-upload-summary">
            <span>{preview.fileName}</span>
            <span>
              {preview.rowCount.toLocaleString()}행 · {preview.columnCount}열 ·{" "}
              {formatBytes(preview.fileSize)}
            </span>
          </div>

          {/* 경고 */}
          {preview.warnings.length > 0 ? (
            <ul className="gdp-admin-upload-warnings" aria-label="경고">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}

          {/* 샘플 표 */}
          {preview.headers.length > 0 ? (
            <div className="gdp-admin-upload-table-wrap">
              <table className="gdp-admin-upload-table">
                <thead>
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, ri) => (
                    <tr key={ri}>
                      {preview.headers.map((_, ci) => (
                        <td key={ci}>{row[ci] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="gdp-admin-empty">파일 컬럼을 찾지 못했습니다.</p>
          )}

          {/* 컬럼 매핑 */}
          {schema && preview.headers.length > 0 ? (
            <section className="gdp-admin-mapping" aria-labelledby="mapping-title">
              <h4 id="mapping-title" className="gdp-admin-upload-section-title">
                컬럼 매핑
                <span className="gdp-admin-mapping-hint">
                  필수: {schema.required.map((k) => fieldLabel(schema, k)).join(", ")}
                </span>
              </h4>
              <div className="gdp-admin-mapping-grid">
                {preview.headers.map((h) => (
                  <label key={h} className="gdp-admin-mapping-row">
                    <span className="gdp-admin-mapping-header">{h}</span>
                    <select
                      className="gdp-admin-mapping-select"
                      value={mapping[h] ?? ""}
                      onChange={(e) => handleMappingChange(h, e.target.value)}
                    >
                      <option value="">사용 안 함</option>
                      {schema.fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {/* 매핑 검증 경고 (소프트) */}
              {validation && validation.missingRequired.length > 0 ? (
                <p className="gdp-admin-mapping-warn" role="status">
                  누락된 필수 컬럼: {validation.missingRequired.map((k) => fieldLabel(schema, k)).join(", ")}
                </p>
              ) : null}
              {validation && validation.duplicates.length > 0 ? (
                <p className="gdp-admin-mapping-warn" role="status">
                  중복 매핑: {validation.duplicates.map((k) => fieldLabel(schema, k)).join(", ")}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* 확정/승인 버튼 */}
          <div className="gdp-admin-upload-action-row">
            {actionLabel ? (
              <button
                type="button"
                className="gdp-admin-upload-commit-btn"
                disabled={committing || !preview}
                onClick={() => void handleCommit()}
              >
                {committing ? "처리 중…" : actionLabel}
              </button>
            ) : currentDataset && !canCommit(currentDataset) ? (
              <p className="gdp-admin-upload-readonly-notice">
                이 데이터셋은 미리보기까지만 지원합니다.
              </p>
            ) : (
              <p className="gdp-admin-upload-readonly-notice">
                이 작업을 수행할 권한이 없습니다.
              </p>
            )}
          </div>

          {/* 확정/승인 결과 */}
          {commitResult ? (
            <div className="gdp-admin-upload-result" role="status" aria-live="polite">
              {commitResult.kind === "commit" ? (
                <>
                  <strong>확정 완료.</strong> 저장 {commitResult.log.savedRowCount.toLocaleString()}행 ·
                  제외 {commitResult.log.skippedRowCount.toLocaleString()}행.
                  {commitResult.log.message ? ` ${commitResult.log.message}` : ""}
                </>
              ) : (
                <>
                  <strong>승인 요청 완료.</strong> 변경요청 ID: {commitResult.summary.changeRequestId}.
                  다른 검토자의 승인 후 반영됩니다.
                </>
              )}
            </div>
          ) : null}

          {commitError ? (
            <p className="gdp-admin-upload-error" role="alert">
              {commitError}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 수집 로그 */}
      <section className="gdp-admin-log-section" aria-labelledby="log-section-title">
        <div className="gdp-admin-log-section-head">
          <h3 id="log-section-title" className="gdp-admin-section-title">
            수집 로그
          </h3>
          <button
            type="button"
            className="gdp-admin-log-refresh-btn"
            onClick={loadLogs}
            disabled={logsLoading}
          >
            새로고침
          </button>
        </div>
        <UploadLogList logs={logs} loading={logsLoading} />
      </section>
    </div>
  );
}
