import { ALLOWED_UPLOAD_MODES } from "../core/state.js";

export function validateAdminAuthDraft(draft = {}) {
  const errors = [];
  const loginId = String(draft.loginId || "").trim();
  const password = String(draft.password || "");
  if (!loginId) errors.push("관리자 ID를 입력해 주세요.");
  else if (loginId.length > 64) errors.push("관리자 ID는 64자 이내로 입력해 주세요.");
  if (!password.trim()) errors.push("관리자 비밀번호를 입력해 주세요.");
  else if (password.length > 128) errors.push("관리자 비밀번호는 128자 이내로 입력해 주세요.");
  return { valid: errors.length === 0, errors, loginId, password };
}

export function normalizeAdminDataset(dataset = {}) {
  return {
    datasetKey: dataset.datasetKey || dataset.key || "",
    datasetName: dataset.datasetName || dataset.name || dataset.datasetKey || "데이터셋",
    domain: dataset.domain || "기타",
    sourceName: dataset.sourceName || dataset.source || "Mock",
    refreshCycle: dataset.refreshCycle || "수시",
    uploadMode: dataset.uploadMode || "CSV",
    requiredMapping: Boolean(dataset.requiredMapping),
    supportsUploadCommit: dataset.supportsUploadCommit ?? ["facilities", "stores", "population"].includes(dataset.datasetKey),
    publicVisible: dataset.publicVisible !== false,
  };
}

export function defaultAdminDatasets() {
  return [
    normalizeAdminDataset({ datasetKey: "facilities", datasetName: "생활시설 통합", domain: "생활", sourceName: "금천구 열린데이터광장", refreshCycle: "수시", uploadMode: "CSV", requiredMapping: true, supportsUploadCommit: true, publicVisible: true }),
    normalizeAdminDataset({ datasetKey: "stores", datasetName: "상가업소 정보", domain: "상권", sourceName: "소상공인시장진흥공단", refreshCycle: "수시", uploadMode: "API/CSV", requiredMapping: true, supportsUploadCommit: true, publicVisible: true }),
    normalizeAdminDataset({ datasetKey: "air-quality", datasetName: "대기 현황", domain: "실시간", sourceName: "서울 열린데이터광장", refreshCycle: "시간", uploadMode: "API", requiredMapping: false, supportsUploadCommit: false, publicVisible: true }),
    normalizeAdminDataset({ datasetKey: "population", datasetName: "주민등록 인구", domain: "인구", sourceName: "행안부/서울 열린데이터광장", refreshCycle: "월", uploadMode: "CSV", requiredMapping: true, supportsUploadCommit: true, publicVisible: true }),
  ];
}

export function mergeDatasetEdits(base = [], edits = {}) {
  return base.map((dataset) => ({ ...dataset, ...(edits[dataset.datasetKey] || {}) }));
}

export function validateAdminDatasetDraft(draft = {}) {
  const errors = [];
  const warnings = [];
  const normalized = {
    datasetKey: draft.datasetKey,
    datasetName: draft.datasetName || "",
    domain: draft.domain || "기타",
    sourceName: draft.sourceName || "Mock",
    refreshCycle: draft.refreshCycle || "수시",
    uploadMode: draft.uploadMode || "CSV",
    requiredMapping: Boolean(draft.requiredMapping),
    publicVisible: Boolean(draft.publicVisible),
  };
  if (!normalized.datasetKey) errors.push("데이터셋 키가 비어 있습니다.");
  if (!normalized.datasetName) errors.push("데이터명은 반드시 입력해야 합니다.");
  else if (normalized.datasetName.length > 40) errors.push("데이터명은 40자 이내로 입력해 주세요.");
  if (normalized.domain.length > 20) errors.push("분야는 20자 이내로 입력해 주세요.");
  if (normalized.sourceName.length > 60) errors.push("출처는 60자 이내로 입력해 주세요.");
  if (normalized.refreshCycle.length > 20) errors.push("갱신주기는 20자 이내로 입력해 주세요.");
  if (!ALLOWED_UPLOAD_MODES.has(normalized.uploadMode)) errors.push("업로드 방식은 CSV, API, API/CSV 중 하나여야 합니다.");
  if (!normalized.publicVisible) warnings.push("화면 공개가 꺼져 있어 업로드 선택 목록에서 제외됩니다.");
  if (!String(normalized.uploadMode).includes("CSV")) warnings.push("CSV 업로드 목록에는 표시되지 않습니다.");
  return { valid: errors.length === 0, errors, warnings, normalized };
}

export function isDatasetUploadable(dataset) {
  return Boolean(dataset?.publicVisible) && String(dataset.uploadMode || "").includes("CSV");
}

export function canCommitUpload(dataset) {
  return isDatasetUploadable(dataset) && Boolean(dataset?.supportsUploadCommit);
}

export function datasetUploadLabel(dataset) {
  if (!dataset.publicVisible) return "업로드 숨김";
  if (canCommitUpload(dataset)) return `${dataset.uploadMode} 업로드 가능`;
  if (isDatasetUploadable(dataset)) return `${dataset.uploadMode} 미리보기만 가능`;
  return "API 수집 전용";
}

export function normalizeUploadStatus(status) {
  return String(status || "").trim().toUpperCase();
}

export function uploadStatusClass(status) {
  const normalized = normalizeUploadStatus(status);
  return normalized ? `is-${normalized.toLowerCase()}` : "";
}

export function uploadStatusLabel(status) {
  return { SUCCESS: "성공", FAILED: "실패", LOCAL: "로컬", SKIPPED: "건너뜀" }[normalizeUploadStatus(status)] || status;
}

export function mapBackendLog(log = {}, now = new Date()) {
  return {
    datasetName: log.datasetName || log.datasetKey || "데이터셋",
    fileName: log.fileName || "-",
    rowCount: log.rowCount || 0,
    columnCount: log.columnCount || 0,
    savedRowCount: log.savedRowCount || 0,
    skippedRowCount: log.skippedRowCount || 0,
    createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR") : now.toLocaleString("ko-KR"),
    status: log.status,
    message: log.message,
  };
}

export function mapBackendLogs(logs = []) {
  return logs.map((log) => mapBackendLog(log));
}

export function friendlyAdminError(error) {
  const message = String(error?.message || "");
  if (error?.status === 401 || message.includes("401")) return "아이디 또는 비밀번호가 맞지 않습니다.";
  if (error?.status === 403 || message.includes("403")) return "관리자 API 접근이 거부되었습니다.";
  if (message.toLowerCase().includes("excel")) return message || "Excel 미리보기를 처리하지 못했습니다.";
  if (message.includes("CSV upload commit is not supported")) return "이 데이터셋은 미리보기까지만 지원됩니다.";
  if (error?.isApiFailure) return message || "업로드를 처리하지 못했습니다.";
  if (error?.isHttpFailure) return message || "백엔드 요청이 실패했습니다.";
  return "백엔드가 없어 로컬로 미리 봅니다.";
}
