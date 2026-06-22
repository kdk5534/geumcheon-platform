const STATUS_TONES = Object.freeze({
  live: "ok",
  sample: "info",
  stale: "warn",
  empty: "muted",
  error: "err",
});

const DEFAULT_MESSAGES = Object.freeze({
  live: "최신 연결 데이터를 표시하고 있습니다.",
  sample: "현재는 샘플 또는 로컬 데이터를 표시하고 있습니다.",
  stale: "일부 원천이 지연되어 마지막 정상 자료를 표시하고 있습니다.",
  empty: "표시할 데이터가 아직 준비되지 않았습니다.",
  error: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
});

export const DATA_STATUSES = Object.freeze(Object.keys(STATUS_TONES));

export function resolveDataStatus({ hasData, sourceMode, error } = {}) {
  if (!hasData) return error ? "error" : "empty";
  if (error || sourceMode === "mixed") return "stale";
  if (sourceMode === "db") return "live";
  return "sample";
}

export function createDataState({
  hasData = false,
  sourceMode = "",
  error = "",
  observedAt = "",
  collectedAt = "",
  sourceName = "",
  sourceUrl = "",
  messages = {},
} = {}) {
  const status = resolveDataStatus({ hasData, sourceMode, error });
  return Object.freeze({
    status,
    label: status,
    tone: STATUS_TONES[status],
    message: messages[status] || DEFAULT_MESSAGES[status],
    observedAt: String(observedAt || ""),
    collectedAt: String(collectedAt || ""),
    sourceName: String(sourceName || ""),
    sourceUrl: String(sourceUrl || ""),
    retryable: status === "error",
  });
}
