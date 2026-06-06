// 순수 DOM/문자열 유틸: 사이드이펙트 없는 순수 함수만 담는다

/** HTML 특수문자를 이스케이프한다. */
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

/** 바이트 수를 사람이 읽기 쉬운 단위로 변환한다. */
export function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 값을 0~1 범위로 클램프한다. */
export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** Mock 타임스탬프를 "YYYY.MM.DD HH:mm" 형식으로 생성한다. */
export function formatMockTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 관리자 인증 저장 일시를 사람이 읽기 쉬운 형식으로 변환한다. */
export function formatAdminAuthSavedAt(savedAt) {
  if (!savedAt) {
    return "방금 전";
  }

  try {
    return new Date(savedAt).toLocaleString("ko-KR");
  } catch {
    return "방금 전";
  }
}
