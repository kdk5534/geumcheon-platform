import { ADMIN_API_TIMEOUT_MS, BACKEND_API_BASE, state } from "../core/state.js";

export function buildAdminAuthHeader(loginId, password) {
  const bytes = new TextEncoder().encode(`${loginId}:${password}`);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `Basic ${btoa(binary)}`;
}

export async function fetchAdminJson(url, options = {}, authOverride = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_API_TIMEOUT_MS);
  const authHeader = (authOverride ?? state.adminAuth)?.authHeader || "";

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try { payload = await response.json(); } catch {}

    if (!response.ok) {
      const error = new Error(payload?.message || `Admin API failed: ${response.status}`);
      error.isHttpFailure = true;
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    if (!payload) {
      const error = new Error("Admin API returned an empty response.");
      error.isHttpFailure = true;
      throw error;
    }
    if (payload.success === false) {
      const error = new Error(payload.message || "Admin API failed.");
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
