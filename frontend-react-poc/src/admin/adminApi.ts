// admin 콘솔 인증·API 호출 래퍼 — static admin-api.js를 TypeScript로 포팅
import { BACKEND_API_BASE } from "../data/env";

// ── 업로드 관련 타입 ──────────────────────────────────────────

/** 백엔드 POST /api/admin/uploads/preview 응답 데이터 */
export interface CsvUploadPreview {
  datasetKey: string;
  uploadId: string;
  fileName: string;
  /** 바이트 단위 파일 크기 */
  fileSize: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  /** 헤더 제외 상위 5행 */
  sampleRows: string[][];
  warnings: string[];
}

/** 업로드 확정/스테이지 공통 요청 본문 */
export interface UploadCommitRequest {
  datasetKey: string;
  uploadId: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  /** CSV 헤더 → 필드 키 매핑 (사용 안 함은 빈 문자열) */
  columnMappings: Record<string, string>;
}

/** 업로드 확정 결과 / 수집 로그 항목 */
export interface UploadLogSummary {
  logId: string;
  datasetKey: string;
  datasetName: string;
  fileName: string;
  status: string;
  rowCount: number;
  columnCount: number;
  savedRowCount: number;
  skippedRowCount: number;
  /** ISO 8601 문자열 */
  createdAt: string;
  message: string | null;
}

/** 스테이지(승인 요청) 결과 — HTTP 201 */
export interface StagedUploadSummary {
  stagedUploadId: string;
  datasetKey: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  status: string;
  changeRequestId: string;
  stagedBy: string;
  stagedAt: string;
  expiresAt: string;
}

/** 업로드 대비 여유 있는 타임아웃 (15초) */
const ADMIN_API_TIMEOUT_MS = 15_000;

export interface AdminSessionUser {
  loginId: string;
  roles: string[];
}

export interface AdminApiPayload<T = unknown> {
  success: boolean;
  data: T;
  message: string | null;
  timestamp: string;
  sourceMode?: string;
}

/** CSRF 헤더명·토큰 인메모리 캐시 — login 후 loadAdminCsrfToken()으로 갱신 */
let csrfHeaderName = "X-XSRF-TOKEN";
let csrfToken = "";

/** 로그인 — CSRF 예외 엔드포인트. 성공 후 자동으로 CSRF 토큰을 갱신한다. */
export async function loginAdminSession(
  loginId: string,
  password: string,
): Promise<AdminApiPayload<AdminSessionUser>> {
  const payload = await requestJson<AdminApiPayload<AdminSessionUser>>(
    `${BACKEND_API_BASE}/api/admin/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    },
  );
  await loadAdminCsrfToken();
  return payload;
}

/** 현재 세션 사용자 조회 — 401이면 미인증 */
export async function getAdminSession(): Promise<AdminApiPayload<AdminSessionUser>> {
  return requestJson<AdminApiPayload<AdminSessionUser>>(
    `${BACKEND_API_BASE}/api/admin/auth/me`,
  );
}

/** 로그아웃 — 캐시된 CSRF 토큰을 초기화한다. */
export async function logoutAdminSession(): Promise<AdminApiPayload<null>> {
  const payload = await fetchAdminJson<AdminApiPayload<null>>(
    `${BACKEND_API_BASE}/api/admin/auth/logout`,
    { method: "POST" },
  );
  csrfToken = "";
  return payload;
}

/** CSRF 토큰 갱신 — 토큰을 인메모리에 캐싱한다. */
export async function loadAdminCsrfToken(): Promise<{ headerName: string; token: string }> {
  const payload = await requestJson<AdminApiPayload<{ headerName: string; token: string }>>(
    `${BACKEND_API_BASE}/api/admin/auth/csrf`,
  );
  csrfHeaderName = payload.data?.headerName ?? "X-XSRF-TOKEN";
  csrfToken = payload.data?.token ?? "";
  return payload.data;
}

/**
 * 인증된 admin API 호출.
 * GET/HEAD/OPTIONS 이외 메서드에는 CSRF 헤더를 자동 주입한다.
 * 토큰이 없으면 먼저 loadAdminCsrfToken()을 호출해 채운다.
 */
export async function fetchAdminJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = String(options.method ?? "GET").toUpperCase();
  const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (needsCsrf && !csrfToken) {
    await loadAdminCsrfToken();
  }
  return requestJson<T>(url, {
    ...options,
    headers: {
      ...(needsCsrf && csrfToken ? { [csrfHeaderName]: csrfToken } : {}),
      ...(options.headers ?? {}),
    },
  });
}

/**
 * CSV/Excel 파일을 백엔드에 전송해 미리보기 데이터를 가져온다.
 * Content-Type은 설정하지 않는다 — FormData가 boundary를 자동으로 설정한다.
 */
export async function previewCsvOnBackend(
  datasetKey: string,
  file: File,
): Promise<CsvUploadPreview> {
  const form = new FormData();
  form.append("file", file);
  const payload = await fetchAdminJson<AdminApiPayload<CsvUploadPreview>>(
    `${BACKEND_API_BASE}/api/admin/uploads/preview?datasetKey=${encodeURIComponent(datasetKey)}`,
    { method: "POST", body: form },
  );
  return payload.data;
}

/** 내부 fetch 핵심 — credentials:"include" + 타임아웃 + ApiResponse 검증 */
async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ADMIN_API_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      signal: controller.signal,
    });
    let payload: T | null = null;
    try {
      payload = (await response.json()) as T;
    } catch {
      /* 비-JSON 응답(204 등)은 null 유지 */
    }
    if (!response.ok) {
      const msg =
        (payload as AdminApiPayload | null)?.message ?? `Admin API 오류: ${response.status}`;
      throw Object.assign(new Error(msg), {
        isHttpFailure: true,
        status: response.status,
        payload,
      });
    }
    const ap = payload as AdminApiPayload | null;
    if (!payload || ap?.success === false) {
      throw Object.assign(new Error(ap?.message ?? "Admin API 실패"), {
        isApiFailure: true,
      });
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}
