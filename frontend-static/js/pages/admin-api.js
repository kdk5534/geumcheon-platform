import { ADMIN_API_TIMEOUT_MS, BACKEND_API_BASE } from "../core/state.js";

let csrfHeaderName = "X-XSRF-TOKEN";
let csrfToken = "";

export async function loginAdminSession(loginId, password) {
  const payload = await requestJson(`${BACKEND_API_BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password }),
  });
  await loadAdminCsrfToken();
  return payload;
}

export function getAdminSession() {
  return requestJson(`${BACKEND_API_BASE}/api/admin/auth/me`);
}

export async function logoutAdminSession() {
  const payload = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/auth/logout`, { method: "POST" });
  csrfToken = "";
  return payload;
}

export async function loadAdminCsrfToken() {
  const payload = await requestJson(`${BACKEND_API_BASE}/api/admin/auth/csrf`);
  csrfHeaderName = payload.data?.headerName || "X-XSRF-TOKEN";
  csrfToken = payload.data?.token || "";
  return payload.data;
}

export async function fetchAdminJson(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrfToken) await loadAdminCsrfToken();
  return requestJson(url, {
    ...options,
    headers: {
      ...(csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) ? { [csrfHeaderName]: csrfToken } : {}),
      ...(options.headers || {}),
    },
  });
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_API_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, credentials: "include", signal: controller.signal });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(payload?.message || `Admin API failed: ${response.status}`);
      error.isHttpFailure = true;
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    if (!payload || payload.success === false) {
      const error = new Error(payload?.message || "Admin API failed.");
      error.isApiFailure = true;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function previewCsvOnBackend(datasetKey, file) {
  const form = new FormData();
  form.append("file", file);
  const payload = await fetchAdminJson(
    `${BACKEND_API_BASE}/api/admin/uploads/preview?datasetKey=${encodeURIComponent(datasetKey)}`,
    { method: "POST", body: form },
  );
  return payload.data;
}
