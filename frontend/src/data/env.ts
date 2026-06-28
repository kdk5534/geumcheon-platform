export function normalizeApiBase(value: unknown) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export const BACKEND_API_BASE = normalizeApiBase(window.__ENV__?.BACKEND_API_BASE);
export const API_TIMEOUT_MS = 2_500;

export function isBackendApiEnabled() {
  const configured = window.__ENV__?.ENABLE_BACKEND_API;
  if (configured != null && configured !== "") {
    return String(configured).toLowerCase() === "true";
  }
  return Boolean(BACKEND_API_BASE);
}
