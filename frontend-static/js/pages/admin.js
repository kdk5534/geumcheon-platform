// 관리자 페이지: 인증 + 데이터셋 관리 + CSV 업로드 워크플로

import {
  state,
  BACKEND_API_BASE,
  UPLOAD_LOG_KEY, DATASET_CONFIG_KEY,
  datasetFieldSchemas, fieldAliases
} from "../core/state.js";
import { escapeHtml, formatBytes, formatAdminAuthSavedAt } from "../core/dom.js";
import { fetchWithTimeout } from "../core/api.js";
import { injectPageCss } from "../core/assets.js";
import { fetchAdminJson, getAdminSession, loginAdminSession, logoutAdminSession, previewCsvOnBackend } from "./admin-api.js";
import { getUploadFileKind, parseCsv } from "./admin-upload.js";
import {
  canCommitUpload,
  datasetUploadLabel,
  defaultAdminDatasets,
  friendlyAdminError,
  isDatasetUploadable,
  mapBackendLog,
  mapBackendLogs,
  mergeDatasetEdits as mergeDatasetEditsModel,
  normalizeAdminDataset,
  normalizeUploadStatus,
  uploadStatusClass,
  uploadStatusLabel,
  validateAdminAuthDraft,
  validateAdminDatasetDraft,
} from "./admin-model.js";

const UPLOAD_LOG_LIMIT = 20;
let governanceRequests = [];
let governanceAuditEvents = [];

// ─── 공개 인터페이스 ──────────────────────────────────────────

/** 관리자 페이지를 container에 마운트한다. */
export async function mount(container) {
  await injectPageCss("css-page-admin", "./css/pages/admin.css");
  await injectPageCss("css-professional-dashboard", "./css/professional-dashboard.css");
  container.innerHTML = buildHtml();
  await initAdminPage();
  bindEvents(container);
}

/** 관리자 페이지를 언마운트한다. */
export function unmount() {}

// ─── HTML 구조 ────────────────────────────────────────────────

function buildHtml() {
  return `
    <div class="admin-page">
      <header class="admin-command-head">
        <div><p>DATA OPERATIONS CONSOLE</p><h1>데이터 운영 콘솔</h1><span>수집 상태를 먼저 확인하고, 변경 영향과 공개 여부를 검토합니다.</span></div>
        <a href="#/home">공개 화면으로</a>
      </header>

      <nav class="admin-work-nav" aria-label="관리자 업무 메뉴">
        <a href="#admin-health" class="is-active">현황</a><a href="#admin-datasets">데이터셋</a><a href="#admin-collection">수집</a><a href="#admin-upload">업로드</a><a href="#admin-audit">감사</a>
      </nav>

      <!-- 관리자 인증 -->
      <div class="admin-section admin-auth-section">
        <div class="admin-section-header">
          <h3 class="admin-section-title">관리자 인증</h3>
          <span class="admin-section-badge">백엔드 API 접근 필요</span>
        </div>
        <div class="admin-auth-wrap">
          <form id="adminAuthForm" class="admin-auth-form" novalidate>
            <div class="auth-field">
              <label for="adminLoginId">관리자 ID</label>
              <input type="text" id="adminLoginId" name="loginId" autocomplete="username"
                placeholder="관리자 ID 입력" maxlength="64">
            </div>
            <div class="auth-field">
              <label for="adminPassword">비밀번호</label>
              <input type="password" id="adminPassword" name="password" autocomplete="current-password"
                placeholder="비밀번호 입력" maxlength="128">
            </div>
            <div class="auth-actions">
              <button type="submit" class="btn-primary">인증 저장</button>
              <button type="button" id="clearAdminAuth" class="btn-secondary">인증 삭제</button>
            </div>
            <p id="adminAuthMessage" class="admin-auth-message" aria-live="polite"></p>
          </form>
          <div class="admin-auth-info">
            <p id="adminAuthStatus" class="admin-auth-status" aria-live="polite">인증 없음</p>
            <p class="admin-auth-hint">인증은 서버 세션과 HttpOnly 쿠키로 유지되며 비밀번호를 브라우저에 저장하지 않습니다.</p>
          </div>
        </div>
      </div>

      <section class="admin-section admin-health" id="admin-health">
        <div class="admin-section-header"><div><span>DATA HEALTH</span><h3 class="admin-section-title">공개 데이터 건강 상태</h3></div><span class="admin-section-badge" id="adminHealthBadge">확인 중</span></div>
        <div class="admin-health-grid">
          <article><span>수집 정상</span><strong id="adminHealthSuccess">—</strong><small>최근 확인된 데이터셋</small></article>
          <article><span>갱신 지연</span><strong id="adminHealthDelayed">—</strong><small>SLA 또는 마지막 시도 기준</small></article>
          <article><span>최근 실패</span><strong id="adminHealthFailed">—</strong><small>정상 스냅샷은 유지</small></article>
          <article><span>공개 영향</span><strong id="adminHealthImpact">—</strong><small>공개 상태 데이터셋</small></article>
        </div>
        <div class="admin-health-detail">
          <div><span>마지막 정상 스냅샷</span><strong id="adminLastSnapshot">로그 확인 후 표시</strong></div>
          <div><span>운영 원칙</span><strong>실패 시 직전 정상값 유지 · 비밀값 마스킹</strong></div>
          <a href="#admin-audit">최근 변경 기록 보기</a>
        </div>
      </section>

      <!-- 데이터셋 관리 -->
      <div class="admin-section" id="admin-datasets">
        <div class="admin-section-header">
          <h3 class="admin-section-title">데이터셋 관리</h3>
        </div>
        <div class="admin-dataset-grid">
          <div class="admin-dataset-list-pane">
            <div id="adminDatasetList" class="dataset-list" role="list"></div>
          </div>
          <div class="admin-dataset-editor-pane">
            <form id="datasetEditor" class="dataset-editor" novalidate>
              <div class="dataset-editor-fields">
                <div class="editor-field">
                  <label for="datasetKeyField">데이터셋 키</label>
                  <input type="text" id="datasetKeyField" disabled>
                </div>
                <div class="editor-field">
                  <label for="datasetNameField">데이터명</label>
                  <input type="text" id="datasetNameField" maxlength="40">
                </div>
                <div class="editor-field">
                  <label for="datasetDomainField">분야</label>
                  <input type="text" id="datasetDomainField" maxlength="20">
                </div>
                <div class="editor-field">
                  <label for="datasetSourceField">출처</label>
                  <input type="text" id="datasetSourceField" maxlength="60">
                </div>
                <div class="editor-field">
                  <label for="datasetRefreshField">갱신주기</label>
                  <input type="text" id="datasetRefreshField" maxlength="20">
                </div>
                <div class="editor-field">
                  <label for="datasetUploadModeField">업로드 방식</label>
                  <select id="datasetUploadModeField">
                    <option value="CSV">CSV</option>
                    <option value="API">API</option>
                    <option value="API/CSV">API/CSV</option>
                  </select>
                </div>
                <div class="editor-field editor-field-check">
                  <label><input type="checkbox" id="datasetMappingField"> 컬럼 매핑 필수</label>
                  <label><input type="checkbox" id="datasetPublicField"> 화면 공개</label>
                </div>
              </div>
              <p id="datasetEditorStatus" class="dataset-editor-status" aria-live="polite"></p>
              <div class="editor-actions">
                <button type="submit" class="btn-primary">저장</button>
                <button type="button" id="resetDataset" class="btn-secondary">초기화</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- CSV 업로드 -->
      <div class="admin-section admin-collection-placeholder" id="admin-collection">
        <div class="admin-section-header"><div><span>COLLECTION</span><h3 class="admin-section-title">수집 작업</h3></div><span class="admin-section-badge">운영자 초안</span></div>
        <div class="admin-workflow-row"><div><span>01</span><strong>수집 실행</strong><small>원천 응답과 품질 게이트 확인</small></div><i></i><div><span>02</span><strong>변경 검토</strong><small>행 수·오류·공개 영향 확인</small></div><i></i><div><span>03</span><strong>공개 승인</strong><small>검토자 승인 후 반영</small></div></div>
      </div>

      <div class="admin-section" id="admin-upload">
        <div class="admin-section-header">
          <h3 class="admin-section-title">CSV / Excel 업로드</h3>
        </div>
        <div class="admin-upload-panel">
          <div class="upload-controls">
            <div class="upload-row">
              <label for="datasetSelect">대상 데이터셋</label>
              <select id="datasetSelect"></select>
            </div>
            <div class="upload-row">
              <label for="csvFile">파일 선택 (CSV / Excel)</label>
              <input type="file" id="csvFile" accept=".csv,.xlsx,.xls">
            </div>
          </div>
          <div id="csvSummary" class="upload-summary is-info" aria-live="polite">
            <strong>파일을 선택하세요</strong>
            <span class="upload-summary-status"></span>
          </div>
          <div id="columnMapping" class="column-mapping">CSV 또는 Excel을 선택하면 매핑이 표시됩니다.</div>
          <div id="csvPreview" class="csv-preview is-state">
            ${renderUploadPreviewState({ title: "CSV 미리보기", status: "대기", message: "파일을 선택하면 미리보기가 표시됩니다.", tone: "info" })}
          </div>
          <div class="upload-commit-row">
            <button type="button" id="commitUpload" class="btn-primary" disabled>승인 요청</button>
          </div>
        </div>
      </div>

      <!-- 업로드 로그 -->
      <section class="admin-section" id="admin-approvals">
        <div class="admin-section-header">
          <div><span>APPROVAL QUEUE</span><h3 class="admin-section-title">변경 요청과 공개 승인</h3></div>
          <span class="admin-section-badge" id="approvalQueueCount">0건 대기</span>
        </div>
        <form id="changeRequestForm" class="governance-create-form">
          <label>요청 유형<select name="requestType"><option value="DATASET_PUBLICATION">데이터 공개</option><option value="DATASET_SETTING">데이터셋 설정</option><option value="TRANSLATION_PUBLICATION">번역 공개</option></select></label>
          <label>대상 키<input name="targetKey" required maxlength="200" placeholder="예: facilities"></label>
          <label class="is-wide">제목<input name="title" required maxlength="300" placeholder="변경 목적을 한 문장으로 입력"></label>
          <label class="is-wide">공개 영향<textarea name="description" rows="2" placeholder="변경 행 수, 오류, 공개 영향, 복구 방법을 기록하세요."></textarea></label>
          <button type="submit" class="btn-primary">초안 만들기</button>
        </form>
        <div id="approvalQueue" class="governance-list" aria-live="polite"></div>
      </section>

      <div class="admin-section" id="admin-audit">
        <div class="admin-section-header">
          <h3 class="admin-section-title">업로드 로그</h3>
          <span class="admin-section-badge">최근 20건</span>
        </div>
        <div id="governanceAudit" class="governance-audit" aria-live="polite"></div>
        <div id="uploadLogs" aria-live="polite"></div>
      </div>
    </div>
  `;
}

// ─── 초기화 ───────────────────────────────────────────────────

async function initAdminPage() {
  syncAdminAuthForm();
  syncAdminAccess();
  try {
    const session = await getAdminSession();
    state.adminAuth = {
      loginId: session.data.loginId,
      roles: session.data.roles || [],
      savedAt: new Date().toISOString(),
    };
  } catch {
    state.adminAuth = null;
  }
  syncAdminAuthForm();
  syncAdminAccess();
  if (!state.adminAuth) return;
  await Promise.all([
    loadAdminDatasets(),
    loadBackendUploadLogs(),
    loadGovernanceData()
  ]);
  renderAdminHealth();
}

function renderAdminHealth() {
  const datasets = Array.isArray(state.adminDatasets) ? state.adminDatasets : [];
  const logs = Array.isArray(state.uploadLogs) ? state.uploadLogs : [];
  const failed = logs.filter((item) => normalizeUploadStatus(item.status) === "FAILED").length;
  const publicCount = datasets.filter((item) => item.publicVisible).length;
  const success = Math.max(0, datasets.length - failed);
  const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  set("adminHealthSuccess", `${success}종`);
  set("adminHealthDelayed", "상태 API 연동 예정");
  set("adminHealthFailed", `${failed}건`);
  set("adminHealthImpact", `${publicCount}종`);
  set("adminLastSnapshot", logs[0]?.createdAt || "정상 로그 없음");
  const badge = document.getElementById("adminHealthBadge");
  if (badge) { badge.textContent = failed ? "확인 필요" : "운영 확인"; badge.classList.toggle("is-warning", failed > 0); }
}

function syncAdminAccess() {
  const sections = [...document.querySelectorAll(".admin-page > .admin-section:not(#adminAccessGate)")];
  sections.slice(1).forEach((section) => {
    section.hidden = !state.adminAuth;
  });

  let gate = document.getElementById("adminAccessGate");
  if (!state.adminAuth && !gate && sections[0]) {
    gate = document.createElement("div");
    gate.id = "adminAccessGate";
    gate.className = "admin-section admin-access-gate";
    gate.setAttribute("role", "status");
    gate.innerHTML = `
      <div class="admin-access-gate-copy">
        <span>LOCKED OPERATIONS</span>
        <h3 class="admin-section-title">운영 기능은 인증 후 표시됩니다</h3>
        <p>데이터셋 관리, 업로드 승인, 감사 로그는 서버 세션 인증과 역할 권한을 확인한 뒤 열립니다.</p>
      </div>
      <div class="admin-access-gate-steps" aria-label="관리자 접근 절차">
        <div><strong>01</strong><span>관리자 ID와 비밀번호 입력</span></div>
        <div><strong>02</strong><span>HttpOnly 세션 쿠키 발급</span></div>
        <div><strong>03</strong><span>역할별 메뉴와 변경 이력 표시</span></div>
      </div>`;
    sections[0].insertAdjacentElement("afterend", gate);
  } else if (state.adminAuth) {
    gate?.remove();
  }
}

// ─── 관리자 인증 ──────────────────────────────────────────────

function syncAdminAuthForm() {
  const loginField = document.getElementById("adminLoginId");
  const passwordField = document.getElementById("adminPassword");
  if (loginField) loginField.value = state.adminAuth?.loginId || "";
  if (passwordField) passwordField.value = "";
  clearAdminAuthValidation();
  renderAdminAuthStatus();
}

function renderAdminAuthStatus() {
  const status = document.getElementById("adminAuthStatus");
  if (!status) return;
  if (state.adminAuth) {
    status.className = "admin-auth-status is-ok";
    status.textContent = `인증됨 · ${state.adminAuth.loginId} · ${formatAdminAuthSavedAt(state.adminAuth.savedAt)}`;
  } else {
    status.className = "admin-auth-status";
    status.textContent = "인증 없음";
  }
}

function renderAdminAuthMessage(message = "", tone = "") {
  const el = document.getElementById("adminAuthMessage");
  if (!el) return;
  el.className = ["admin-auth-message", tone ? `is-${tone}` : ""].filter(Boolean).join(" ");
  el.textContent = message;
}

function clearAdminAuthValidation() {
  document.getElementById("adminLoginId")?.removeAttribute("aria-invalid");
  document.getElementById("adminPassword")?.removeAttribute("aria-invalid");
}

function renderAdminAuthValidation(errors = []) {
  clearAdminAuthValidation();
  const fieldMap = { "관리자 ID": "#adminLoginId", "관리자 비밀번호": "#adminPassword" };
  errors.forEach((msg) => {
    const entry = Object.entries(fieldMap).find(([label]) => msg.includes(label));
    if (entry) document.querySelector(entry[1])?.setAttribute("aria-invalid", "true");
  });
  renderAdminAuthMessage(errors[0] || "입력값을 확인해 주세요.", "error");
}

function clearAdminAuthSession(message = "", tone = "") {
  state.adminAuth = null;
  state.adminDatasets = [];
  state.adminDatasetBase = [];
  syncAdminAuthForm();
  syncAdminAccess();
  if (message) renderAdminAuthMessage(message, tone);
}

async function handleAdminAuthSubmit(event) {
  event.preventDefault();
  const loginField = document.getElementById("adminLoginId");
  const passwordField = document.getElementById("adminPassword");
  const submitBtn = event.currentTarget?.querySelector("[type='submit']");
  if (!loginField || !passwordField) return;

  const validation = validateAdminAuthDraft({ loginId: loginField.value || "", password: passwordField.value || "" });
  clearAdminAuthValidation();
  if (!validation.valid) { renderAdminAuthValidation(validation.errors); return; }

  const previousAuth = state.adminAuth;
  if (submitBtn) submitBtn.disabled = true;
  renderAdminAuthMessage("인증 확인 중", "info");

  try {
    const response = await loginAdminSession(validation.loginId, validation.password);
    state.adminAuth = {
      loginId: response.data.loginId,
      roles: response.data.roles || [],
      savedAt: new Date().toISOString(),
    };
    syncAdminAuthForm();
    syncAdminAccess();
    await Promise.all([loadAdminDatasets(), loadBackendUploadLogs(), loadGovernanceData()]);
    renderAdminHealth();
    renderAdminAuthMessage("서버 세션 로그인 완료", "success");
  } catch (error) {
    state.adminAuth = previousAuth;
    if (previousAuth) {
      renderAdminAuthStatus();
      renderAdminAuthMessage("기존 인증 유지", "warning");
    } else {
      renderAdminAuthStatus();
      renderAdminAuthMessage(friendlyAdminError(error), "error");
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleAdminAuthClear(event) {
  event.preventDefault();
  try { await logoutAdminSession(); } catch {}
  clearAdminAuthSession();
  renderAdminAuthMessage("로그아웃 완료", "success");
}

// ─── 인증 스토리지 ────────────────────────────────────────────

// ─── 데이터셋 관리 ────────────────────────────────────────────

async function loadAdminDatasets() {
  try {
    const response = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/datasets`);
    state.adminDatasetBase = response.data.map(normalizeAdminDataset);
  } catch (error) {
    if ((error?.status === 401 || error?.status === 403) && state.adminAuth) {
      clearAdminAuthSession("세션 인증이 만료되었습니다. 다시 로그인해 주세요.", "error");
    }
    state.adminDatasetBase = defaultAdminDatasets();
  }
  state.adminDatasets = mergeDatasetEdits(state.adminDatasetBase);
  if (!state.adminDatasets.some((d) => d.datasetKey === state.selectedDatasetKey)) {
    state.selectedDatasetKey = state.adminDatasets[0]?.datasetKey || "facilities";
  }
  renderDatasetManager();
  renderDatasetSelect();
}

function mergeDatasetEdits(base) {
  const edits = readDatasetEdits();
  return mergeDatasetEditsModel(base, edits);
}

function renderDatasetManager() {
  const list = document.getElementById("adminDatasetList");
  if (!list) return;
  list.innerHTML = state.adminDatasets.map((d) => `
    <button class="dataset-row ${d.datasetKey === state.selectedDatasetKey ? "is-active" : ""} ${d.publicVisible ? "" : "is-hidden"}"
      type="button" data-dataset-key="${escapeHtml(d.datasetKey)}">
      <strong>${escapeHtml(d.datasetName)}</strong>
      <span>${escapeHtml(d.domain)} · ${escapeHtml(d.sourceName)} · ${escapeHtml(d.refreshCycle)}</span>
      <span class="dataset-row-status">${escapeHtml(datasetUploadLabel(d))} · ${d.publicVisible ? "화면 공개" : "화면 숨김"}</span>
    </button>
  `).join("");
  renderDatasetEditor();
}

function renderDatasetEditor(message = "") {
  const dataset = currentAdminDataset();
  if (!dataset) return;
  const status = document.getElementById("datasetEditorStatus");
  const editor = document.getElementById("datasetEditor");
  if (editor) editor.querySelectorAll("[aria-invalid]").forEach((f) => f.removeAttribute("aria-invalid"));

  document.getElementById("datasetKeyField")?.setAttribute("value", dataset.datasetKey);
  if (document.getElementById("datasetKeyField")) document.getElementById("datasetKeyField").value = dataset.datasetKey;
  if (document.getElementById("datasetNameField")) document.getElementById("datasetNameField").value = dataset.datasetName;
  if (document.getElementById("datasetDomainField")) document.getElementById("datasetDomainField").value = dataset.domain;
  if (document.getElementById("datasetSourceField")) document.getElementById("datasetSourceField").value = dataset.sourceName;
  if (document.getElementById("datasetRefreshField")) document.getElementById("datasetRefreshField").value = dataset.refreshCycle;
  if (document.getElementById("datasetUploadModeField")) document.getElementById("datasetUploadModeField").value = dataset.uploadMode;
  if (document.getElementById("datasetMappingField")) document.getElementById("datasetMappingField").checked = dataset.requiredMapping;
  if (document.getElementById("datasetPublicField")) document.getElementById("datasetPublicField").checked = dataset.publicVisible;

  if (status) {
    const uploadMsg = canCommitUpload(dataset)
      ? `${datasetUploadLabel(dataset)} · 수정 내용은 브라우저 저장소에 보관됩니다.`
      : isDatasetUploadable(dataset)
        ? `${datasetUploadLabel(dataset)} · 미리보기용으로만 반영됩니다.`
        : `${datasetUploadLabel(dataset)} · 이 데이터셋은 파일 업로드 선택에서 제외됩니다.`;
    status.textContent = message || uploadMsg;
  }
}

function renderDatasetSelect() {
  const select = document.getElementById("datasetSelect");
  const fileInput = document.getElementById("csvFile");
  if (!select || state.adminDatasets.length === 0) return;

  const uploadable = state.adminDatasets.filter(isDatasetUploadable);
  if (uploadable.length === 0) {
    select.innerHTML = `<option value="">CSV 미리보기 가능 데이터셋 없음</option>`;
    select.disabled = true;
    if (fileInput) { fileInput.disabled = true; fileInput.value = ""; }
    const commitBtn = document.getElementById("commitUpload");
    if (commitBtn) commitBtn.disabled = true;
    state.uploadPreview = null;
    state.uploadMapping = {};
    renderColumnMapping();
    return;
  }

  const prev = state.selectedUploadDatasetKey || select.value;
  select.disabled = false;
  if (fileInput) fileInput.disabled = false;
  select.innerHTML = uploadable.map((d) => `<option value="${escapeHtml(d.datasetKey)}">${escapeHtml(d.datasetName)}</option>`).join("");

  if (prev && uploadable.some((d) => d.datasetKey === prev)) {
    select.value = prev;
  }
  state.selectedUploadDatasetKey = select.value;
}

function handleDatasetListClick(event) {
  const btn = event.target.closest("[data-dataset-key]");
  if (!btn) return;
  state.selectedDatasetKey = btn.dataset.datasetKey;
  const select = document.getElementById("datasetSelect");
  const selected = currentAdminDataset();
  if (select && isDatasetUploadable(selected)) {
    select.value = state.selectedDatasetKey;
    state.selectedUploadDatasetKey = state.selectedDatasetKey;
  }
  renderDatasetManager();
  renderDatasetSelect();
}

function handleDatasetEditorSubmit(event) {
  event.preventDefault();
  const dataset = currentAdminDataset();
  if (!dataset) return;

  const draft = {
    datasetKey: document.getElementById("datasetKeyField")?.value || dataset.datasetKey,
    datasetName: document.getElementById("datasetNameField")?.value || "",
    domain: document.getElementById("datasetDomainField")?.value || "",
    sourceName: document.getElementById("datasetSourceField")?.value || "",
    refreshCycle: document.getElementById("datasetRefreshField")?.value || "",
    uploadMode: document.getElementById("datasetUploadModeField")?.value || "CSV",
    requiredMapping: document.getElementById("datasetMappingField")?.checked || false,
    publicVisible: document.getElementById("datasetPublicField")?.checked || false
  };

  const validation = validateAdminDatasetDraft(draft);
  renderDatasetValidation(validation.errors, validation.warnings);
  if (!validation.valid) return;

  Object.assign(dataset, validation.normalized);
  saveDatasetEdits();
  if (isDatasetUploadable(dataset)) state.selectedUploadDatasetKey = dataset.datasetKey;
  renderDatasetManager();
  renderDatasetSelect();
  renderDatasetEditor(canCommitUpload(dataset) ? "저장했습니다. 업로드 데이터셋 선택에도 반영됐습니다." : "저장했습니다.");
}

function resetCurrentDataset() {
  const base = state.adminDatasetBase.find((d) => d.datasetKey === state.selectedDatasetKey);
  const idx = state.adminDatasets.findIndex((d) => d.datasetKey === state.selectedDatasetKey);
  if (!base || idx < 0) return;
  state.adminDatasets[idx] = { ...base };
  if (isDatasetUploadable(state.adminDatasets[idx])) state.selectedUploadDatasetKey = state.adminDatasets[idx].datasetKey;
  saveDatasetEdits();
  renderDatasetManager();
  renderDatasetSelect();
  renderDatasetEditor("초기값으로 복원했습니다.");
}

function renderDatasetValidation(errors = [], warnings = []) {
  const status = document.getElementById("datasetEditorStatus");
  const editor = document.getElementById("datasetEditor");
  if (!status || !editor) return;
  editor.querySelectorAll("[aria-invalid]").forEach((f) => f.removeAttribute("aria-invalid"));
  const fieldMap = { "데이터명": "#datasetNameField", "분야": "#datasetDomainField", "출처": "#datasetSourceField", "갱신주기": "#datasetRefreshField", "업로드 방식": "#datasetUploadModeField" };
  errors.forEach((msg) => {
    const entry = Object.entries(fieldMap).find(([label]) => msg.includes(label));
    if (entry) document.querySelector(entry[1])?.setAttribute("aria-invalid", "true");
  });
  status.innerHTML = [
    errors.length > 0 ? `<span class="is-error">${escapeHtml(errors[0])}</span>` : "",
    warnings.length > 0 ? `<span class="is-warning">${escapeHtml(warnings[0])}</span>` : ""
  ].filter(Boolean).join(" ");
}

// ─── 데이터셋 헬퍼 ────────────────────────────────────────────

function currentAdminDataset() {
  return state.adminDatasets.find((d) => d.datasetKey === state.selectedDatasetKey) || state.adminDatasets[0];
}

function currentUploadDataset() {
  const selectVal = document.getElementById("datasetSelect")?.value || state.selectedUploadDatasetKey;
  return state.adminDatasets.find((d) => d.datasetKey === selectVal)
    || state.adminDatasets.find(isDatasetUploadable) || state.adminDatasets[0];
}

function selectedUploadDataset() {
  const selectVal = document.getElementById("datasetSelect")?.value || state.selectedUploadDatasetKey || "";
  return state.adminDatasets.find((d) => d.datasetKey === selectVal) || null;
}

// ─── 데이터셋 스토리지 ────────────────────────────────────────

function readDatasetEdits() {
  try {
    const rows = JSON.parse(localStorage.getItem(DATASET_CONFIG_KEY) || "[]");
    if (!Array.isArray(rows)) return {};
    return Object.fromEntries(rows.map(normalizeAdminDataset).filter((d) => d.datasetKey).map((d) => [d.datasetKey, d]));
  } catch { return {}; }
}

function saveDatasetEdits() {
  localStorage.setItem(DATASET_CONFIG_KEY, JSON.stringify(state.adminDatasets));
}

// ─── 업로드 워크플로 ──────────────────────────────────────────

async function handleCsvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const dataset = selectedUploadDataset();
  const datasetKey = dataset?.datasetKey || document.getElementById("datasetSelect")?.value || state.selectedUploadDatasetKey || "";
  const datasetName = dataset?.datasetName || "";
  const summary = document.getElementById("csvSummary");
  const preview = document.getElementById("csvPreview");
  const commitBtn = document.getElementById("commitUpload");

  state.uploadPreview = null;
  state.uploadMapping = {};
  renderColumnMapping();
  if (commitBtn) commitBtn.disabled = true;

  const selection = validateUploadSelection(dataset, file);
  if (!selection.ok) {
    renderUploadSummary(summary, selection.summary);
    renderUploadPreviewEl(preview, renderUploadPreviewState(selection.preview), { isState: true });
    return;
  }

  renderUploadSummary(summary, { title: file.name, status: selection.commitSupported ? "검증 중" : "미리보기 전용", message: selection.commitSupported ? "파일 구조를 확인 중입니다." : "이 데이터셋은 파일 미리보기까지만 가능합니다.", tone: selection.commitSupported ? "info" : "warning" });
  renderUploadPreviewEl(preview, renderUploadPreviewState({ title: file.name, status: selection.commitSupported ? "검증 중" : "미리보기 전용", message: selection.commitSupported ? "파일 구조를 확인하고 있습니다." : "이 데이터셋은 확정 저장을 지원하지 않습니다.", hint: datasetName ? `${selection.commitSupported ? "대상 데이터셋" : "대상 데이터셋(미리보기만 가능)"}: ${datasetName}` : "", tone: selection.commitSupported ? "info" : "warning" }), { isState: true });

  try {
    const backendPreview = await previewCsvOnBackend(datasetKey, file);
    const headers = backendPreview.headers || [];
    state.uploadPreview = { ...backendPreview, datasetName, mode: "backend" };
    const uploadModeLabel = selection.commitSupported ? "검증" : "미리보기";
    renderUploadSummary(summary, { title: backendPreview.fileName, status: headers.length > 0 ? `${uploadModeLabel} 완료` : `${uploadModeLabel} 경고`, message: headers.length > 0 ? `${backendPreview.rowCount.toLocaleString()}행 · ${backendPreview.columnCount.toLocaleString()}열 · ${formatBytes(backendPreview.fileSize)}${selection.commitSupported ? "" : " · 확정 저장 미지원"}` : "파일 컬럼을 찾지 못했습니다.", tone: headers.length > 0 ? (selection.commitSupported ? "success" : "warning") : "warning" });
    applyColumnMapping(headers);
    renderUploadPreviewEl(preview, buildCsvPreview(headers, backendPreview.sampleRows, backendPreview.warnings), { isState: !headers.length });
  } catch (error) {
    if (error.isApiFailure || error.isHttpFailure) {
      if ((error?.status === 401 || error?.status === 403) && state.adminAuth) clearAdminAuthSession("세션 인증이 만료되었습니다. 다시 로그인해 주세요.", "error");
      const msg = friendlyAdminError(error);
      renderUploadSummary(summary, { title: file.name, status: "검증 실패", message: msg, tone: "error" });
      renderUploadPreviewEl(preview, renderUploadPreviewState({ title: "파일을 불러오지 못했습니다", status: "검증 실패", message: msg, hint: "업로드 가능 데이터셋과 관리자 세션을 확인해 주세요.", tone: "error" }), { isState: true });
      return;
    }
    if (selection.fileKind === "excel") {
      const msg = "Excel 미리보기는 백엔드 실행이 필요합니다.";
      renderUploadSummary(summary, { title: file.name, status: "검증 실패", message: msg, tone: "error" });
      renderUploadPreviewEl(preview, renderUploadPreviewState({ title: "Excel 미리보기 실패", status: "백엔드 필요", message: msg, hint: "DB 또는 mock 모드 백엔드를 켠 뒤 다시 선택해 주세요.", tone: "error" }), { isState: true });
      return;
    }

    const text = await readCsvText(file);
    const rows = parseCsv(text);
    const headers = rows[0] || [];
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
    state.uploadPreview = { datasetKey, datasetName, fileName: file.name, fileSize: file.size, rowCount: dataRows.length, columnCount: headers.length, headers, sampleRows: dataRows.slice(0, 5), warnings: ["백엔드가 없어 브라우저에서 미리 봅니다."], mode: "local" };
    renderUploadSummary(summary, { title: file.name, status: headers.length > 0 ? (selection.commitSupported ? "로컬 보기" : "미리보기 전용") : "검증 경고", message: headers.length > 0 ? `${dataRows.length.toLocaleString()}행 · ${headers.length.toLocaleString()}열 · ${formatBytes(file.size)}` : "파일 컬럼을 찾지 못했습니다.", tone: headers.length > 0 ? (selection.commitSupported ? "info" : "warning") : "warning" });
    applyColumnMapping(headers);
    renderUploadPreviewEl(preview, buildCsvPreview(headers, dataRows.slice(0, 5), state.uploadPreview.warnings), { isState: !headers.length });
  }
}

function applyColumnMapping(headers = []) {
  state.uploadMapping = Object.fromEntries(headers.map((h) => [h, guessFieldKey(h)]));
  renderColumnMapping();
  refreshUploadValidation();
}

function handleMappingChange(event) {
  if (!event.target.matches("[data-csv-column]")) return;
  state.uploadMapping[event.target.dataset.csvColumn] = event.target.value;
  refreshUploadValidation();
}

function handleDatasetSelectChange(event) {
  state.selectedUploadDatasetKey = event.target.value;
  if (!state.uploadPreview) return;
  const selected = event.target.options[event.target.selectedIndex];
  state.uploadPreview.datasetKey = event.target.value;
  state.uploadPreview.datasetName = selected.textContent;
  state.uploadPreview.warnings = validatePreviewMapping(state.uploadPreview.headers || []);
  applyColumnMapping(state.uploadPreview.headers || []);
  const preview = document.getElementById("csvPreview");
  if (preview) {
    const headers = state.uploadPreview.headers || [];
    renderUploadPreviewEl(preview, buildCsvPreview(headers, state.uploadPreview.sampleRows || [], state.uploadPreview.warnings || []), { isState: headers.length === 0 });
  }
}

function renderColumnMapping() {
  const mapping = document.getElementById("columnMapping");
  if (!mapping) return;
  const headers = state.uploadPreview?.headers || [];
  if (headers.length === 0) {
    const uploadSelect = document.getElementById("datasetSelect");
    if (!state.uploadPreview && uploadSelect?.disabled) {
      mapping.className = "column-mapping empty is-warning";
      mapping.innerHTML = `<strong>미리보기 가능한 데이터셋이 없습니다.</strong><span>데이터셋 관리자에서 CSV 미리보기가 가능한 항목을 설정해 주세요.</span>`;
      return;
    }
    mapping.className = `column-mapping empty ${state.uploadPreview ? "is-warning" : ""}`.trim();
    mapping.innerHTML = state.uploadPreview ? `<strong>파일 컬럼을 찾지 못했습니다.</strong><span>첫 행에 컬럼명이 있는지 확인해 주세요.</span>` : "CSV 또는 Excel을 선택하면 매핑이 표시됩니다.";
    return;
  }
  const schema = currentFieldSchema();
  const requiredText = currentUploadDataset()?.requiredMapping ? `필수: ${schema.required.map(fieldLabel).join(", ")}` : "매핑 선택 사항";
  mapping.className = "column-mapping";
  mapping.innerHTML = `
    <div class="mapping-head"><strong>컬럼 매핑</strong><span>${requiredText}</span></div>
    <div class="mapping-grid">${headers.map((h) => buildMappingRow(h, schema.fields)).join("")}</div>
    <div class="mapping-status" id="mappingStatus"></div>
  `;
}

function buildMappingRow(header, fields) {
  const selected = state.uploadMapping[header] || "";
  const opts = [`<option value="">사용 안 함</option>`, ...fields.map((f) => `<option value="${escapeHtml(f.key)}"${f.key === selected ? " selected" : ""}>${escapeHtml(f.label)}</option>`)].join("");
  return `<label class="mapping-row"><span>${escapeHtml(header)}</span><select data-csv-column="${escapeHtml(header)}">${opts}</select></label>`;
}

function refreshUploadValidation() {
  const commitBtn = document.getElementById("commitUpload");
  const statusEl = document.getElementById("mappingStatus");
  const issues = validateUploadMapping();
  const commitAllowed = canCommitUpload(currentUploadDataset());
  const reviewerAllowed = (state.adminAuth?.roles || []).some((role) => ["ADMIN", "REVIEWER", "ROLE_ADMIN", "ROLE_REVIEWER"].includes(role));
  const operatorAllowed = (state.adminAuth?.roles || []).some((role) => ["ADMIN", "OPERATOR", "ROLE_ADMIN", "ROLE_OPERATOR"].includes(role));
  if (statusEl) {
    statusEl.className = `mapping-status ${issues.length > 0 ? "has-issue" : "is-ok"}`;
    statusEl.textContent = issues.length > 0 ? issues.join(" · ") : !commitAllowed ? "미리보기만 가능 · 확정 저장 미지원" : reviewerAllowed ? (currentUploadDataset()?.requiredMapping ? "필수 매핑 완료 · 검토자 반영 가능" : "매핑 선택 사항 · 검토자 반영 가능") : "필수 검증 완료 · 승인 요청 가능";
  }
  if (commitBtn) {
    commitBtn.textContent = reviewerAllowed ? "검토자 확정 반영" : "승인 요청";
    commitBtn.disabled = !state.uploadPreview || issues.length > 0 || !commitAllowed || (!reviewerAllowed && !operatorAllowed);
  }
}

function validateUploadMapping() {
  if (!state.uploadPreview) return ["파일을 먼저 선택해 주세요."];
  if ((state.uploadPreview.headers || []).length === 0) return ["파일 컬럼을 찾지 못했습니다."];
  if (!currentUploadDataset()?.requiredMapping) return [];
  const mapped = Object.values(state.uploadMapping).filter(Boolean);
  const missing = currentFieldSchema().required.filter((f) => !mapped.includes(f));
  const dup = mapped.filter((f, i) => mapped.indexOf(f) !== i);
  const issues = [];
  if (missing.length > 0) issues.push(`누락: ${missing.map(fieldLabel).join(", ")}`);
  if (dup.length > 0) issues.push(`중복: ${[...new Set(dup)].map(fieldLabel).join(", ")}`);
  return issues;
}

function validatePreviewMapping(headers = []) {
  if (headers.length === 0) return ["파일 컬럼을 찾지 못했습니다."];
  if (!currentUploadDataset()?.requiredMapping) return [];
  const guessed = Object.fromEntries(headers.map((h) => [h, guessFieldKey(h)]));
  const mapped = Object.values(guessed).filter(Boolean);
  const missing = currentFieldSchema().required.filter((f) => !mapped.includes(f));
  return missing.length > 0 ? [`필수 매핑 필요: ${missing.map(fieldLabel).join(", ")}`] : [];
}

async function commitCsvUpload() {
  const summary = document.getElementById("csvSummary");
  const commitBtn = document.getElementById("commitUpload");
  if (!state.uploadPreview) return;

  const preview = state.uploadPreview;
  const dataset = currentUploadDataset();
  const reviewerAllowed = (state.adminAuth?.roles || []).some((role) => ["ADMIN", "REVIEWER", "ROLE_ADMIN", "ROLE_REVIEWER"].includes(role));
  if (!canCommitUpload(dataset)) {
    renderUploadSummary(summary, { title: preview.fileName, status: "확정 불가", message: "이 데이터셋은 미리보기까지만 지원됩니다.", tone: "warning" });
    return;
  }
  if (commitBtn) commitBtn.disabled = true;
  renderUploadSummary(summary, { title: preview.fileName, status: reviewerAllowed ? "확정 중" : "승인 요청 중", message: `매핑 ${Object.values(state.uploadMapping).filter(Boolean).length}개 검증 완료`, tone: "info" });

  try {
    const response = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/uploads/${reviewerAllowed ? "commit" : "stage"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetKey: preview.datasetKey, uploadId: preview.uploadId, fileName: preview.fileName, rowCount: preview.rowCount, columnCount: preview.columnCount, columnMappings: state.uploadMapping })
    });
    if (!reviewerAllowed) {
      state.uploadPreview = null;
      state.uploadMapping = {};
      renderColumnMapping();
      await loadGovernanceData();
      renderUploadSummary(summary, { title: preview.fileName, status: "검토 대기", message: "원본 파일과 검증 정보를 보관했습니다. 다른 검토자가 승인해야 공개 데이터에 반영됩니다.", tone: "success" });
      return;
    }
    state.uploadLogs = [mapBackendLog(response.data), ...state.uploadLogs].slice(0, UPLOAD_LOG_LIMIT);
    const msg = await refreshFacilitiesAfterUpload(preview);
    renderUploadLogs();
    renderUploadSummary(summary, { title: preview.fileName, status: "확정 완료", message: msg || "최근 로그에 반영했습니다.", tone: "success" });
  } catch (error) {
    if (error.isApiFailure || error.isHttpFailure) {
      if ((error?.status === 401 || error?.status === 403) && state.adminAuth) clearAdminAuthSession("세션 인증이 만료되었습니다. 다시 로그인해 주세요.", "error");
      recordUploadLog(buildUploadLog("FAILED", friendlyAdminError(error)));
      renderUploadSummary(summary, { title: preview.fileName, status: "검증 실패", message: friendlyAdminError(error), tone: "error" });
      refreshUploadValidation();
      return;
    }
    recordUploadLog(buildUploadLog("LOCAL", `로컬 로그 저장 · 매핑 ${Object.values(state.uploadMapping).filter(Boolean).length}개`));
    renderUploadSummary(summary, { title: preview.fileName, status: "로컬 저장", message: "백엔드가 없어 로컬 로그에만 저장했습니다.", tone: "warning" });
  }
}

async function refreshFacilitiesAfterUpload(preview) {
  if (preview.datasetKey !== "facilities") return "최근 로그에 반영했습니다.";
  try {
    const response = await fetchWithTimeout(`${BACKEND_API_BASE}/api/public/facilities?size=1000`, 1500);
    const payload = await response.json();
    const facilities = Array.isArray(payload.data) ? payload.data : [];
    if (facilities.length === 0) return "시설 데이터가 비어 있습니다.";
    state.data = { ...state.data, facilities };
    return "시설 목록을 새로고침했습니다.";
  } catch { return "새로고침에 실패했습니다. 화면을 다시 열어 주세요."; }
}

function buildUploadLog(status, message) {
  const sourceCount = Number(state.uploadPreview.rowCount || 0);
  const norm = normalizeUploadStatus(status);
  const saved = norm === "FAILED" ? 0 : sourceCount;
  return { datasetName: state.uploadPreview.datasetName, fileName: state.uploadPreview.fileName, rowCount: sourceCount, columnCount: state.uploadPreview.columnCount, savedRowCount: saved, skippedRowCount: Math.max(0, sourceCount - saved), createdAt: new Date().toLocaleString("ko-KR"), status, message };
}

function recordUploadLog(log) {
  saveUploadLog(log);
  state.uploadLogs = [log, ...state.uploadLogs].slice(0, UPLOAD_LOG_LIMIT);
  renderUploadLogs();
}

// ─── 업로드 로그 렌더 ─────────────────────────────────────────

async function loadBackendUploadLogs() {
  try {
    const response = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/collection-logs?limit=${UPLOAD_LOG_LIMIT}`);
    state.uploadLogs = mapBackendLogs(response.data);
  } catch (error) {
    if ((error?.status === 401 || error?.status === 403) && state.adminAuth) clearAdminAuthSession("세션 인증이 만료되었습니다. 다시 로그인해 주세요.", "error");
    state.uploadLogs = readUploadLogs();
  }
  renderUploadLogs();
}

function renderUploadLogs() {
  const el = document.getElementById("uploadLogs");
  if (!el) return;
  if (state.uploadLogs.length === 0) {
    el.innerHTML = `<div class="csv-preview empty">아직 업로드 로그가 없습니다.</div>`;
    return;
  }
  el.innerHTML = state.uploadLogs.map((log) => {
    const src = Number(log.rowCount || 0);
    const saved = Number.isFinite(Number(log.savedRowCount)) ? Number(log.savedRowCount) : normalizeUploadStatus(log.status) === "FAILED" ? 0 : src;
    const skipped = Number.isFinite(Number(log.skippedRowCount)) ? Number(log.skippedRowCount) : Math.max(src - saved, 0);
    const meta = [`원본 ${src.toLocaleString()}행`, `저장 ${saved.toLocaleString()}행`, `제외 ${skipped.toLocaleString()}행`, `${Number(log.columnCount || 0)}개 컬럼`, log.createdAt].filter(Boolean);
    return `
      <article class="upload-log ${uploadStatusClass(log.status)}">
        <div class="upload-log-title">
          <strong>${escapeHtml(log.datasetName)}</strong>
          ${log.status ? `<span class="upload-status">${escapeHtml(uploadStatusLabel(log.status))}</span>` : ""}
        </div>
        <span class="upload-log-file">${escapeHtml(log.fileName || "-")}</span>
        <span class="upload-log-meta">${meta.map(escapeHtml).join(" · ")}</span>
        ${log.message ? `<p>${escapeHtml(log.message)}</p>` : ""}
      </article>
    `;
  }).join("");
}

// ─── 업로드 스토리지 ──────────────────────────────────────────

function readUploadLogs() {
  try { return JSON.parse(localStorage.getItem(UPLOAD_LOG_KEY) || "[]"); } catch { return []; }
}

function saveUploadLog(log) {
  const logs = [log, ...readUploadLogs()].slice(0, UPLOAD_LOG_LIMIT);
  localStorage.setItem(UPLOAD_LOG_KEY, JSON.stringify(logs));
}

// ─── 업로드 UI 헬퍼 ───────────────────────────────────────────

function renderUploadSummary(target, { title, status, message, tone = "info" }) {
  if (!target) return;
  target.classList.remove("is-error", "is-warning", "is-info", "is-success");
  target.classList.add(uploadToneClass(tone));
  target.innerHTML = `<strong>${escapeHtml(title || "선택된 파일")}</strong><span class="upload-summary-status">${escapeHtml(status || "")}</span>${message ? `<span>${escapeHtml(message)}</span>` : ""}`;
}

function renderUploadPreviewState({ title, status, message, hint, tone = "warning" }) {
  return `<div class="upload-preview-state ${uploadToneClass(tone)}" role="status" aria-live="polite">${status ? `<span class="upload-preview-state-status">${escapeHtml(status)}</span>` : ""}<strong>${escapeHtml(title || "CSV 미리보기")}</strong>${message ? `<p class="upload-preview-state-message">${escapeHtml(message)}</p>` : ""}${hint ? `<span class="upload-preview-state-hint">${escapeHtml(hint)}</span>` : ""}</div>`;
}

function renderUploadPreviewEl(target, html, { isState = false } = {}) {
  if (!target) return;
  target.className = isState ? "csv-preview is-state" : "csv-preview";
  target.innerHTML = html;
}

function buildCsvPreview(headers, rows, warnings = []) {
  if (headers.length === 0) return renderUploadPreviewState({ title: "파일 컬럼을 찾지 못했습니다", status: "헤더 없음", message: "첫 행에 컬럼명이 있는지 확인해 주세요.", hint: "구분자가 맞지 않거나 빈 파일일 수 있습니다.", tone: "warning" });
  return `${warnings.length > 0 ? `<div class="preview-warning is-warning">${warnings.map(escapeHtml).join("<br>")}</div>` : ""}<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, i) => `<td>${escapeHtml(row[i] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function uploadToneClass(tone = "info") {
  return { error: "is-error", warning: "is-warning", success: "is-success", info: "is-info" }[tone] || "is-info";
}

// ─── 파일 파싱 ────────────────────────────────────────────────

async function readCsvText(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  const kor = new TextDecoder("euc-kr").decode(buf);
  return (kor.includes('�') ? utf8 : kor).replace(/^﻿/, '');
}

// ─── 파일 유효성 ──────────────────────────────────────────────

function validateUploadSelection(dataset, file) {
  const fileKind = getUploadFileKind(file);
  const fileName = file?.name || "선택된 파일";
  const datasetName = dataset?.datasetName || "선택된 데이터셋";
  const uploadMode = dataset?.uploadMode || "CSV";
  const commitSupported = canCommitUpload(dataset);
  if (!dataset) return { ok: false, fileKind, summary: { title: fileName, status: "대상 없음", message: "업로드할 데이터셋을 먼저 선택해 주세요.", tone: "warning" }, preview: { title: "업로드 대상이 필요합니다", status: "데이터셋 선택", message: "파일을 확인할 대상이 정해지지 않았습니다.", hint: "업로드 가능 데이터셋을 선택한 뒤 다시 파일을 골라 주세요.", tone: "warning" } };
  if (!dataset.publicVisible) return { ok: false, fileKind, summary: { title: fileName, status: "업로드 숨김", message: "이 데이터셋은 화면 공개가 꺼져 있습니다.", tone: "error" }, preview: { title: `${datasetName}는 업로드할 수 없습니다`, status: "화면 숨김", message: "먼저 화면 공개를 켜 주세요.", hint: `현재 업로드 방식: ${uploadMode}`, tone: "error" } };
  if (!isDatasetUploadable(dataset)) return { ok: false, fileKind, summary: { title: fileName, status: "업로드 불가", message: "이 데이터셋은 CSV 업로드를 지원하지 않습니다.", tone: "error" }, preview: { title: `${datasetName}는 업로드할 수 없습니다`, status: "API 전용", message: "CSV 업로드가 꺼져 있습니다.", hint: `현재 업로드 방식: ${uploadMode}`, tone: "error" } };
  if (fileKind !== "csv" && fileKind !== "excel") return { ok: false, fileKind, summary: { title: fileName, status: "형식 오류", message: "CSV 또는 Excel 파일만 지원합니다.", tone: "error" }, preview: { title: "지원하지 않는 파일 형식입니다", status: "형식 오류", message: "CSV 또는 Excel 파일만 선택해 주세요.", hint: `현재 파일: ${fileName}`, tone: "error" } };
  return { ok: true, commitSupported, fileKind };
}

// ─── 컬럼 매핑 헬퍼 ──────────────────────────────────────────

function currentFieldSchema() {
  const key = state.uploadPreview?.datasetKey || document.getElementById("datasetSelect")?.value || "facilities";
  return datasetFieldSchemas[key] || datasetFieldSchemas.facilities;
}

function normalizeFieldName(v) { return String(v).toLowerCase().replace(/[\s_\-()[\].]/g, ""); }
function fieldLabel(key) { const f = currentFieldSchema().fields.find((item) => item.key === key); return f?.label || key; }
function guessFieldKey(header) {
  const norm = normalizeFieldName(header);
  const schema = currentFieldSchema();
  if (state.uploadPreview?.datasetKey === "cctv-stations") {
    const cctvHeaders = {
      "관리번호": "id",
      "설치목적구분": "purpose",
      "소재지도로명주소": "roadAddress",
      "소재지지번주소": "lotAddress",
      "관리기관전화번호": "phone",
      "wgs84위도": "latitude",
      "wgs84경도": "longitude"
    };
    if (cctvHeaders[norm]) return cctvHeaders[norm];
  }
  const match = schema.fields.find((f) => (fieldAliases[f.key] || []).some((a) => normalizeFieldName(a) === norm));
  return match?.key || "";
}

// ─── 백엔드 API ───────────────────────────────────────────────

// ─── 이벤트 바인딩 ────────────────────────────────────────────

async function loadGovernanceData() {
  try {
    const requests = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/change-requests?limit=50`);
    governanceRequests = Array.isArray(requests.data) ? requests.data : [];
  } catch {
    governanceRequests = [];
  }
  try {
    const audit = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/audit-events?limit=20`);
    governanceAuditEvents = Array.isArray(audit.data) ? audit.data : [];
  } catch {
    governanceAuditEvents = [];
  }
  renderGovernance();
}

function renderGovernance() {
  const queue = document.getElementById("approvalQueue");
  const audit = document.getElementById("governanceAudit");
  const waiting = governanceRequests.filter((item) => item.status === "PENDING_REVIEW").length;
  const count = document.getElementById("approvalQueueCount");
  if (count) count.textContent = `${waiting}건 대기`;

  if (queue) {
    queue.innerHTML = governanceRequests.length ? governanceRequests.map((item) => {
      const canSubmit = item.status === "DRAFT" && item.requestedBy === state.adminAuth?.loginId;
      const canReview = item.status === "PENDING_REVIEW" && item.requestedBy !== state.adminAuth?.loginId
        && (state.adminAuth?.roles || []).some((role) => /ADMIN|REVIEWER/.test(role));
      return `<article class="governance-item">
        <div><span class="governance-status is-${escapeHtml(item.status.toLowerCase())}">${escapeHtml(governanceStatusLabel(item.status))}</span><strong>${escapeHtml(item.title)}</strong></div>
        <p>${escapeHtml(item.description || "영향 설명 없음")}</p>
        <small>${escapeHtml(item.targetType)} · ${escapeHtml(item.targetKey)} · 요청 ${escapeHtml(item.requestedBy)}</small>
        <div class="governance-actions">
          ${canSubmit ? `<button type="button" data-governance-action="submit" data-request-id="${escapeHtml(item.requestId)}" class="btn-secondary">검토 요청</button>` : ""}
          ${canReview ? `<button type="button" data-governance-action="approve" data-request-id="${escapeHtml(item.requestId)}" class="btn-primary">승인</button><button type="button" data-governance-action="reject" data-request-id="${escapeHtml(item.requestId)}" class="btn-secondary">반려</button>` : ""}
        </div>
      </article>`;
    }).join("") : `<div class="governance-empty">등록된 변경 요청이 없습니다.</div>`;
  }

  if (audit) {
    audit.innerHTML = governanceAuditEvents.length ? `<h4>변경 감사 기록</h4>${governanceAuditEvents.map((item) => `<div class="governance-audit-row"><span>${escapeHtml(item.actionCode)}</span><strong>${escapeHtml(item.targetKey || "-")}</strong><small>${escapeHtml(item.actorLoginId || "system")} · ${escapeHtml(formatGovernanceTime(item.occurredAt))}</small></div>`).join("")}` : "";
  }
}

async function handleChangeRequestSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const targetKey = String(form.get("targetKey") || "").trim();
  const title = String(form.get("title") || "").trim();
  if (!targetKey || !title) return;
  await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/change-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: form.get("requestType"), targetType: "DATASET", targetKey, title,
      description: String(form.get("description") || "").trim(),
      changePayload: {}, impactSummary: { reviewRequired: true, rollbackAvailable: true },
    }),
  });
  event.currentTarget.reset();
  await loadGovernanceData();
}

async function handleGovernanceAction(button) {
  const action = button.dataset.governanceAction;
  const requestId = button.dataset.requestId;
  if (!action || !requestId) return;
  const options = action === "submit" ? { method: "POST" } : {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment: action === "approve" ? "검토 완료" : "보완 후 재요청" }),
  };
  button.disabled = true;
  try {
    await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/change-requests/${encodeURIComponent(requestId)}/${action}`, options);
    if (action === "approve") {
      await loadBackendUploadLogs();
      renderUploadLogs();
      renderAdminHealth();
    }
    await loadGovernanceData();
  } finally {
    button.disabled = false;
  }
}

function governanceStatusLabel(status) {
  return ({ DRAFT: "초안", PENDING_REVIEW: "검토 대기", APPROVED: "승인", REJECTED: "반려", APPLIED: "반영", ROLLED_BACK: "복구" })[status] || status;
}

function formatGovernanceTime(value) {
  if (!value) return "시각 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ko-KR");
}

function bindEvents(container) {
  container.addEventListener("submit", (e) => {
    if (e.target.id === "adminAuthForm") handleAdminAuthSubmit(e);
    if (e.target.id === "datasetEditor") handleDatasetEditorSubmit(e);
    if (e.target.id === "changeRequestForm") handleChangeRequestSubmit(e);
  });

  container.addEventListener("click", (e) => {
    if (e.target.id === "clearAdminAuth") handleAdminAuthClear(e);
    if (e.target.id === "resetDataset") resetCurrentDataset();
    if (e.target.id === "commitUpload") commitCsvUpload();
    const governanceButton = e.target.closest("[data-governance-action]");
    if (governanceButton) handleGovernanceAction(governanceButton);
    const dsBtn = e.target.closest("[data-dataset-key]");
    if (dsBtn) handleDatasetListClick(e);
  });

  container.addEventListener("change", (e) => {
    if (e.target.id === "csvFile") handleCsvUpload(e);
    if (e.target.id === "datasetSelect") handleDatasetSelectChange(e);
    if (e.target.closest("#columnMapping")) handleMappingChange(e);
  });

  container.addEventListener("input", (e) => {
    if (e.target.matches("#adminLoginId, #adminPassword")) {
      e.target.removeAttribute("aria-invalid");
      const msgEl = document.getElementById("adminAuthMessage");
      if (msgEl?.textContent) renderAdminAuthMessage("");
    }
  });
}
