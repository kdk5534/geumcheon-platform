const state = {
  data: null,
  category: "전체",
  industry: "카페",
  uploadLogs: [],
  uploadPreview: null,
  uploadMapping: {},
  adminDatasets: [],
  adminDatasetBase: [],
  selectedDatasetKey: "facilities",
  selectedUploadDatasetKey: "facilities"
};

const BACKEND_API_BASE = "http://localhost:8080";
const API_TIMEOUT_MS = 450;
const ADMIN_API_TIMEOUT_MS = 5000;
const UPLOAD_LOG_KEY = "geumcheon-upload-logs";
const DATASET_CONFIG_KEY = "geumcheon-admin-datasets";
const ADMIN_AUTH_HEADER = `Basic ${btoa("admin:admin1234")}`;
const CSV_EXTENSIONS = new Set(["csv"]);
const EXCEL_EXTENSIONS = new Set(["xlsx", "xls"]);

const datasetFieldSchemas = {
  facilities: {
    required: ["id", "category", "name", "address", "latitude", "longitude"],
    fields: [
      { key: "id", label: "고유 ID" },
      { key: "category", label: "시설 분류" },
      { key: "name", label: "시설명" },
      { key: "address", label: "주소" },
      { key: "phone", label: "전화번호" },
      { key: "latitude", label: "위도" },
      { key: "longitude", label: "경도" },
      { key: "source", label: "출처" }
    ]
  },
  stores: {
    required: ["name", "address"],
    fields: [
      { key: "id", label: "상가 ID" },
      { key: "name", label: "상호명" },
      { key: "category", label: "업종" },
      { key: "address", label: "주소" },
      { key: "phone", label: "전화번호" },
      { key: "latitude", label: "위도" },
      { key: "longitude", label: "경도" },
      { key: "source", label: "출처" }
    ]
  },
  "air-quality": {
    required: ["stationName", "measuredAt"],
    fields: [
      { key: "stationName", label: "측정소" },
      { key: "measuredAt", label: "측정 일시" },
      { key: "pm10", label: "미세먼지" },
      { key: "pm25", label: "초미세먼지" },
      { key: "status", label: "상태" },
      { key: "source", label: "출처" }
    ]
  },
  population: {
    required: ["areaName", "baseDate", "populationTotal"],
    fields: [
      { key: "areaName", label: "행정동" },
      { key: "baseDate", label: "기준일" },
      { key: "populationTotal", label: "총인구" },
      { key: "male", label: "남성" },
      { key: "female", label: "여성" },
      { key: "source", label: "출처" }
    ]
  }
};

const fieldAliases = {
  id: ["id", "code", "originalid", "sourceoriginalid", "관리번호", "고유id", "식별자"],
  category: ["category", "type", "kind", "분류", "유형", "카테고리", "업종"],
  name: ["name", "facilityname", "businessname", "storename", "상호명", "시설명", "명칭", "이름"],
  address: ["address", "roadaddress", "addressroad", "addr", "주소", "도로명주소", "소재지"],
  phone: ["phone", "tel", "telephone", "연락처", "전화", "전화번호"],
  latitude: ["latitude", "lat", "y", "위도"],
  longitude: ["longitude", "lng", "lon", "x", "경도"],
  source: ["source", "origin", "출처", "데이터출처"],
  stationName: ["stationname", "station", "측정소", "측정소명"],
  measuredAt: ["measuredate", "measuredat", "datetime", "date", "측정일시", "일시"],
  pm10: ["pm10", "미세먼지"],
  pm25: ["pm25", "초미세먼지"],
  status: ["status", "상태"],
  areaName: ["areaname", "dong", "admindong", "행정동", "동명"],
  baseDate: ["basedate", "date", "기준일", "기준연월"],
  populationTotal: ["populationtotal", "population", "total", "총인구", "인구"],
  male: ["male", "남성", "남자인구"],
  female: ["female", "여성", "여자인구"]
};

const categoryInitial = {
  "병원": "H",
  "약국": "P",
  "주차장": "P",
  "안전": "S"
};

const categoryColor = {
  "병원": "#ba3f33",
  "약국": "#6658a6",
  "주차장": "#1f7f86",
  "안전": "#b46d16"
};

async function loadData() {
  const localData = await loadLocalData();
  state.data = localData;
  renderMetrics();
  renderFacilities();
  renderCommercial();
  renderAccess();
  state.adminDatasetBase = defaultAdminDatasets();
  state.adminDatasets = mergeDatasetEdits(state.adminDatasetBase);
  renderDatasetManager();
  renderDatasetSelect();
  renderUploadLogs();
  bindEvents();
  await loadAdminDatasets();
  state.data = await loadBackendData(localData);
  renderMetrics();
  renderFacilities();
  await loadBackendUploadLogs();
}

async function loadLocalData() {
  const response = await fetch("./assets/data/mock-data.json");
  return response.json();
}

async function loadBackendData(localData) {
  try {
    const [datasetResponse, facilityResponse] = await Promise.all([
      fetchWithTimeout(`${BACKEND_API_BASE}/api/public/datasets`),
      fetchWithTimeout(`${BACKEND_API_BASE}/api/public/facilities`)
    ]);

    const datasets = await datasetResponse.json();
    const facilities = await facilityResponse.json();
    const mappedFacilities = mapBackendFacilities(facilities.data);

    return {
      ...localData,
      metrics: withBackendMetric(localData.metrics, datasets.data),
      facilities: mappedFacilities.length > 0 ? mappedFacilities : localData.facilities
    };
  } catch {
    return localData;
  }
}

async function fetchWithTimeout(url, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function withBackendMetric(metrics, datasets = []) {
  if (!Array.isArray(datasets) || datasets.length === 0) {
    return metrics;
  }

  return metrics.map((metric) => {
    if (metric.label !== "상권 점포") {
      return metric;
    }

    return {
      ...metric,
      badge: "API",
      note: `백엔드 mock API 데이터셋 ${datasets.length}종 연결`
    };
  });
}

function mapBackendFacilities(facilities = []) {
  if (!Array.isArray(facilities) || facilities.length === 0) {
    return [];
  }

  return facilities.map((facility, index) => ({
    id: facility.id,
    category: facility.category,
    name: facility.name,
    address: facility.address,
    phone: facility.phone,
    x: 300 + (index % 3) * 86,
    y: 190 + Math.floor(index / 3) * 92,
    color: categoryColor[facility.category] || "#3d6f99"
  }));
}

function renderMetrics() {
  const metrics = document.querySelector("#metrics");
  metrics.innerHTML = state.data.metrics.map((metric) => `
    <article class="metric-card">
      <div class="metric-top">
        <span>${metric.label}</span>
        <span class="metric-badge">${metric.badge}</span>
      </div>
      <div class="metric-value">${metric.value}</div>
      <p class="metric-note">${metric.note}</p>
    </article>
  `).join("");
}

function renderFacilities() {
  const facilities = state.category === "전체"
    ? state.data.facilities
    : state.data.facilities.filter((item) => item.category === state.category);

  const markers = document.querySelector("#mapMarkers");
  const list = document.querySelector("#facilityList");
  const count = document.querySelector("#facilityCount");

  markers.innerHTML = facilities.map((facility) => `
    <g class="marker" tabindex="0" aria-label="${facility.name}" data-id="${facility.id}" transform="translate(${facility.x} ${facility.y})">
      <circle r="18" fill="${facility.color}"></circle>
      <text>${categoryInitial[facility.category] || "F"}</text>
    </g>
  `).join("");

  list.innerHTML = facilities.map((facility) => `
    <article class="facility-item" id="facility-${facility.id}">
      <span>${facility.category}</span>
      <strong>${facility.name}</strong>
      <p>${facility.address}<br>${facility.phone}</p>
    </article>
  `).join("");

  count.textContent = `${facilities.length}개`;
}

function renderCommercial() {
  const item = state.data.commercial[state.industry];
  const stats = document.querySelector("#commercialStats");
  const chart = document.querySelector("#barChart");
  const max = Math.max(...item.byDong.map((dong) => dong.count));

  stats.innerHTML = `
    <article class="mini-stat">
      <b>전체 점포</b>
      <strong>${item.total.toLocaleString()}개</strong>
    </article>
    <article class="mini-stat">
      <b>500m 반경</b>
      <strong>${item.radius}개</strong>
    </article>
    <article class="mini-stat">
      <b>경쟁 밀도</b>
      <strong>${item.density}</strong>
    </article>
  `;

  chart.innerHTML = item.byDong.map((dong) => {
    const width = Math.max(8, Math.round((dong.count / max) * 100));
    return `
      <div class="bar-row">
        <span>${dong.name}</span>
        <div class="bar-track" aria-hidden="true">
          <div class="bar-fill" style="width: ${width}%"></div>
        </div>
        <strong>${dong.count}</strong>
      </div>
    `;
  }).join("");
}

function renderAccess() {
  const grid = document.querySelector("#accessGrid");
  grid.innerHTML = state.data.access.map((item) => `
    <article class="access-card">
      <strong>${item.name}</strong>
      <div class="score"><b>${item.score}</b><span>/100</span></div>
      <p>${item.note}</p>
    </article>
  `).join("");
}

async function loadAdminDatasets() {
  try {
    const response = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/datasets`);
    state.adminDatasetBase = response.data.map(normalizeAdminDataset);
  } catch {
    state.adminDatasetBase = defaultAdminDatasets();
  }

  state.adminDatasets = mergeDatasetEdits(state.adminDatasetBase);
  if (!state.adminDatasets.some((dataset) => dataset.datasetKey === state.selectedDatasetKey)) {
    state.selectedDatasetKey = state.adminDatasets[0]?.datasetKey || "facilities";
  }
  renderDatasetManager();
  renderDatasetSelect();
}

function defaultAdminDatasets() {
  return [
    normalizeAdminDataset({
      datasetKey: "facilities",
      datasetName: "생활시설 통합",
      domain: "생활",
      sourceName: "금천구 열린데이터광장",
      refreshCycle: "수시",
      uploadMode: "CSV",
      requiredMapping: true,
      publicVisible: true
    }),
    normalizeAdminDataset({
      datasetKey: "stores",
      datasetName: "상가업소 정보",
      domain: "상권",
      sourceName: "소상공인시장진흥공단",
      refreshCycle: "수시",
      uploadMode: "API/CSV",
      requiredMapping: true,
      publicVisible: true
    }),
    normalizeAdminDataset({
      datasetKey: "air-quality",
      datasetName: "대기 현황",
      domain: "실시간",
      sourceName: "서울 열린데이터광장",
      refreshCycle: "시간",
      uploadMode: "API",
      requiredMapping: false,
      publicVisible: true
    }),
    normalizeAdminDataset({
      datasetKey: "population",
      datasetName: "인구 통계",
      domain: "인구",
      sourceName: "서울 열린데이터광장",
      refreshCycle: "월",
      uploadMode: "CSV",
      requiredMapping: true,
      publicVisible: true
    })
  ];
}

function normalizeAdminDataset(dataset) {
  return {
    datasetKey: dataset.datasetKey || dataset.key || "",
    datasetName: dataset.datasetName || dataset.name || dataset.datasetKey || "데이터셋",
    domain: dataset.domain || "기타",
    sourceName: dataset.sourceName || dataset.source || "Mock",
    refreshCycle: dataset.refreshCycle || "수시",
    uploadMode: dataset.uploadMode || "CSV",
    requiredMapping: Boolean(dataset.requiredMapping),
    publicVisible: dataset.publicVisible !== false
  };
}

function mergeDatasetEdits(baseDatasets) {
  const edits = readDatasetEdits();
  return baseDatasets.map((dataset) => ({
    ...dataset,
    ...(edits[dataset.datasetKey] || {})
  }));
}

function renderDatasetManager() {
  const list = document.querySelector("#adminDatasetList");
  if (!list) {
    return;
  }

  list.innerHTML = state.adminDatasets.map((dataset) => `
    <button class="dataset-row ${dataset.datasetKey === state.selectedDatasetKey ? "is-active" : ""} ${dataset.publicVisible ? "" : "is-hidden"}" type="button" data-dataset-key="${escapeHtml(dataset.datasetKey)}">
      <strong>${escapeHtml(dataset.datasetName)}</strong>
      <span>${escapeHtml(dataset.domain)} · ${escapeHtml(dataset.sourceName)} · ${escapeHtml(dataset.refreshCycle)}</span>
      <span class="dataset-row-status">${escapeHtml(datasetUploadLabel(dataset))} · ${dataset.publicVisible ? "화면 공개" : "화면 숨김"}</span>
    </button>
  `).join("");

  renderDatasetEditor();
}

function renderDatasetEditor(message = "") {
  const dataset = currentAdminDataset();
  const status = document.querySelector("#datasetEditorStatus");
  if (!dataset) {
    return;
  }

  document.querySelector("#datasetKeyField").value = dataset.datasetKey;
  document.querySelector("#datasetNameField").value = dataset.datasetName;
  document.querySelector("#datasetDomainField").value = dataset.domain;
  document.querySelector("#datasetSourceField").value = dataset.sourceName;
  document.querySelector("#datasetRefreshField").value = dataset.refreshCycle;
  document.querySelector("#datasetUploadModeField").value = dataset.uploadMode;
  document.querySelector("#datasetMappingField").checked = dataset.requiredMapping;
  document.querySelector("#datasetPublicField").checked = dataset.publicVisible;

  if (status) {
    status.textContent = message || `${datasetUploadLabel(dataset)} · 수정 내용은 브라우저 mock 저장소에 보관됩니다.`;
  }
}

function renderDatasetSelect() {
  const select = document.querySelector("#datasetSelect");
  const fileInput = document.querySelector("#csvFile");
  const summary = document.querySelector("#csvSummary");
  if (!select || state.adminDatasets.length === 0) {
    return;
  }

  const uploadableDatasets = state.adminDatasets.filter(isDatasetUploadable);
  if (uploadableDatasets.length === 0) {
    select.innerHTML = `<option value="">CSV 업로드 가능 데이터셋 없음</option>`;
    select.disabled = true;
    if (fileInput) {
      fileInput.disabled = true;
    }
    renderUploadSummary(summary, {
      title: "업로드 대상 없음",
      status: "설정 필요",
      message: "데이터셋을 화면 공개로 두고 업로드 방식을 CSV 또는 API/CSV로 설정해 주세요."
    });
    return;
  }

  const previousValue = state.selectedUploadDatasetKey || select.value;
  select.disabled = false;
  if (fileInput) {
    fileInput.disabled = false;
  }
  select.innerHTML = uploadableDatasets.map((dataset) => `
    <option value="${escapeHtml(dataset.datasetKey)}">${escapeHtml(dataset.datasetName)}</option>
  `).join("");

  const nextValue = uploadableDatasets.some((dataset) => dataset.datasetKey === previousValue)
    ? previousValue
    : uploadableDatasets.some((dataset) => dataset.datasetKey === state.selectedDatasetKey)
      ? state.selectedDatasetKey
      : uploadableDatasets[0].datasetKey;
  select.value = nextValue;
  state.selectedUploadDatasetKey = nextValue;
}

function currentAdminDataset() {
  return state.adminDatasets.find((dataset) => dataset.datasetKey === state.selectedDatasetKey)
    || state.adminDatasets[0];
}

function currentUploadDataset() {
  const selectValue = document.querySelector("#datasetSelect")?.value || state.selectedUploadDatasetKey;
  return state.adminDatasets.find((dataset) => dataset.datasetKey === selectValue)
    || state.adminDatasets.find(isDatasetUploadable)
    || state.adminDatasets[0];
}

function isDatasetUploadable(dataset) {
  return Boolean(dataset?.publicVisible) && String(dataset.uploadMode || "").includes("CSV");
}

function datasetUploadLabel(dataset) {
  if (!dataset.publicVisible) {
    return "업로드 숨김";
  }
  if (isDatasetUploadable(dataset)) {
    return `${dataset.uploadMode} 업로드 가능`;
  }
  return "API 수집 전용";
}

function renderUploadLogs() {
  const logs = document.querySelector("#uploadLogs");
  if (!logs) {
    return;
  }

  if (state.uploadLogs.length === 0) {
    logs.innerHTML = `<div class="csv-preview empty">아직 업로드 로그가 없습니다.</div>`;
    return;
  }

  logs.innerHTML = state.uploadLogs.map((log) => {
    const meta = [
      `${Number(log.rowCount || 0).toLocaleString()}행`,
      `${Number(log.columnCount || 0).toLocaleString()}개 컬럼`,
      log.createdAt
    ].filter(Boolean);

    return `
      <article class="upload-log ${uploadStatusClass(log.status)}">
        <div class="upload-log-title">
          <strong>${escapeHtml(log.datasetName)}</strong>
          ${log.status ? `<span class="upload-status">${escapeHtml(uploadStatusLabel(log.status))}</span>` : ""}
        </div>
        <span class="upload-log-file">${escapeHtml(log.fileName || "-")}</span>
        <span class="upload-log-meta">${meta.map((item) => escapeHtml(item)).join(" · ")}</span>
        ${log.message ? `<p>${escapeHtml(log.message)}</p>` : ""}
      </article>
    `;
  }).join("");
}

async function loadBackendUploadLogs() {
  try {
    const response = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/collection-logs`);
    state.uploadLogs = mapBackendLogs(response.data);
  } catch {
    state.uploadLogs = readUploadLogs();
  }
  renderUploadLogs();
}

function bindEvents() {
  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      state.category = button.dataset.category;
      renderFacilities();
    });
  });

  document.querySelector("#industrySelect").addEventListener("change", (event) => {
    state.industry = event.target.value;
    renderCommercial();
  });

  document.querySelector("#datasetSelect")?.addEventListener("change", handleDatasetChange);
  document.querySelector("#csvFile")?.addEventListener("change", handleCsvUpload);
  document.querySelector("#columnMapping")?.addEventListener("change", handleMappingChange);
  document.querySelector("#commitUpload")?.addEventListener("click", commitCsvUpload);
  document.querySelector("#adminDatasetList")?.addEventListener("click", handleDatasetListClick);
  document.querySelector("#datasetEditor")?.addEventListener("submit", handleDatasetEditorSubmit);
  document.querySelector("#resetDataset")?.addEventListener("click", resetCurrentDataset);

  document.querySelector("#mapMarkers").addEventListener("click", focusFacility);
  document.querySelector("#mapMarkers").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusFacility(event);
    }
  });
}

function handleDatasetChange(event) {
  state.selectedUploadDatasetKey = event.target.value;

  if (!state.uploadPreview) {
    return;
  }

  const selected = event.target.options[event.target.selectedIndex];
  state.uploadPreview.datasetKey = event.target.value;
  state.uploadPreview.datasetName = selected.textContent;
  state.uploadPreview.warnings = validatePreviewMapping(state.uploadPreview.headers || []);
  applyColumnMapping(state.uploadPreview.headers || []);
}

function handleDatasetListClick(event) {
  const button = event.target.closest("[data-dataset-key]");
  if (!button) {
    return;
  }

  state.selectedDatasetKey = button.dataset.datasetKey;
  const select = document.querySelector("#datasetSelect");
  const selectedDataset = currentAdminDataset();
  if (select && isDatasetUploadable(selectedDataset)) {
    select.value = state.selectedDatasetKey;
    state.selectedUploadDatasetKey = state.selectedDatasetKey;
  }
  renderDatasetManager();
  renderDatasetSelect();
}

function handleDatasetEditorSubmit(event) {
  event.preventDefault();
  const dataset = currentAdminDataset();
  if (!dataset) {
    return;
  }

  Object.assign(dataset, {
    datasetName: document.querySelector("#datasetNameField").value.trim() || dataset.datasetName,
    domain: document.querySelector("#datasetDomainField").value.trim() || "기타",
    sourceName: document.querySelector("#datasetSourceField").value.trim() || "Mock",
    refreshCycle: document.querySelector("#datasetRefreshField").value.trim() || "수시",
    uploadMode: document.querySelector("#datasetUploadModeField").value,
    requiredMapping: document.querySelector("#datasetMappingField").checked,
    publicVisible: document.querySelector("#datasetPublicField").checked
  });

  saveDatasetEdits();
  if (isDatasetUploadable(dataset)) {
    state.selectedUploadDatasetKey = dataset.datasetKey;
  }
  renderDatasetManager();
  renderDatasetSelect();
  renderDatasetEditor(isDatasetUploadable(dataset)
    ? "저장했습니다. 업로드 데이터셋 선택에도 반영됐습니다."
    : "저장했습니다. 이 데이터셋은 현재 파일 업로드 선택에서 제외됩니다.");
}

function resetCurrentDataset() {
  const base = state.adminDatasetBase.find((dataset) => dataset.datasetKey === state.selectedDatasetKey);
  const index = state.adminDatasets.findIndex((dataset) => dataset.datasetKey === state.selectedDatasetKey);
  if (!base || index < 0) {
    return;
  }

  state.adminDatasets[index] = { ...base };
  if (isDatasetUploadable(state.adminDatasets[index])) {
    state.selectedUploadDatasetKey = state.adminDatasets[index].datasetKey;
  }
  saveDatasetEdits();
  renderDatasetManager();
  renderDatasetSelect();
  renderDatasetEditor("초기값으로 복원했습니다.");
}

function focusFacility(event) {
  const marker = event.target.closest(".marker");
  if (!marker) {
    return;
  }

  const target = document.querySelector(`#facility-${marker.dataset.id}`);
  if (target) {
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    target.animate([
      { backgroundColor: "#fff3cf" },
      { backgroundColor: "#fbfdfc" }
    ], { duration: 900 });
  }
}

async function handleCsvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const datasetSelect = document.querySelector("#datasetSelect");
  const datasetKey = datasetSelect.value;
  const datasetName = datasetSelect.options[datasetSelect.selectedIndex]?.textContent || "";
  const summary = document.querySelector("#csvSummary");
  const preview = document.querySelector("#csvPreview");
  const commitButton = document.querySelector("#commitUpload");

  state.uploadPreview = null;
  state.uploadMapping = {};
  renderColumnMapping();
  commitButton.disabled = true;

  if (!datasetKey) {
    renderUploadSummary(summary, {
      title: file.name,
      status: "업로드 대상 없음",
      message: "CSV 업로드 가능한 데이터셋을 먼저 설정해 주세요."
    });
    preview.innerHTML = `<div class="csv-preview empty">데이터셋 관리에서 화면 공개와 CSV 업로드 방식을 확인해 주세요.</div>`;
    return;
  }

  if (isExcelFile(file)) {
    renderUploadSummary(summary, {
      title: file.name,
      status: "Excel 준비 중",
      message: "지금은 Excel에서 CSV로 저장한 뒤 업로드해 주세요."
    });
    preview.innerHTML = `
      <div class="csv-preview empty upload-guide">
        <strong>Excel 업로드는 다음 단계에서 지원합니다.</strong>
        <span>현재는 Excel 파일을 열고 “다른 이름으로 저장”에서 CSV 형식으로 저장한 뒤 업로드해 주세요.</span>
      </div>
    `;
    return;
  }

  if (!isCsvFile(file)) {
    renderUploadSummary(summary, {
      title: file.name,
      status: "지원 불가",
      message: "CSV 파일을 선택해 주세요."
    });
    preview.innerHTML = `<div class="csv-preview empty">지원하지 않는 파일 형식입니다.</div>`;
    return;
  }
  renderUploadSummary(summary, {
    title: file.name,
    status: "미리보기 준비 중",
    message: "백엔드에서 파일 구조를 확인하고 있습니다."
  });

  try {
    const backendPreview = await previewCsvOnBackend(datasetKey, file);
    state.uploadPreview = {
      ...backendPreview,
      datasetName,
      mode: "backend"
    };
    renderUploadSummary(summary, {
      title: backendPreview.fileName,
      status: "백엔드 검증 완료",
      message: `${backendPreview.rowCount.toLocaleString()}행 · ${backendPreview.columnCount.toLocaleString()}개 컬럼 · ${formatBytes(backendPreview.fileSize)}`
    });
    applyColumnMapping(backendPreview.headers);
    preview.innerHTML = buildCsvPreview(backendPreview.headers, backendPreview.sampleRows, backendPreview.warnings);
  } catch (error) {
    if (error.isApiFailure || error.isHttpFailure) {
      renderUploadSummary(summary, {
        title: file.name,
        status: "미리보기 실패",
        message: friendlyAdminError(error)
      });
      preview.innerHTML = `<div class="csv-preview empty">${escapeHtml(friendlyAdminError(error))}</div>`;
      return;
    }

    const text = await readCsvText(file);
    const rows = parseCsv(text);
    const headers = rows[0] || [];
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
    state.uploadPreview = {
      datasetKey,
      datasetName,
      fileName: file.name,
      fileSize: file.size,
      rowCount: dataRows.length,
      columnCount: headers.length,
      headers,
      sampleRows: dataRows.slice(0, 5),
      warnings: ["백엔드 연결이 없어 브라우저 미리보기로 처리했습니다."],
      mode: "local"
    };

    renderUploadSummary(summary, {
      title: file.name,
      status: "로컬 미리보기",
      message: `${dataRows.length.toLocaleString()}행 · ${headers.length.toLocaleString()}개 컬럼 · ${formatBytes(file.size)}`
    });
    applyColumnMapping(headers);
    preview.innerHTML = buildCsvPreview(headers, dataRows.slice(0, 5), state.uploadPreview.warnings);
  }
}

function applyColumnMapping(headers = []) {
  state.uploadMapping = Object.fromEntries(headers.map((header) => [header, guessFieldKey(header)]));
  renderColumnMapping();
  refreshUploadValidation();
}

function handleMappingChange(event) {
  if (!event.target.matches("[data-csv-column]")) {
    return;
  }

  state.uploadMapping[event.target.dataset.csvColumn] = event.target.value;
  refreshUploadValidation();
}

function renderColumnMapping() {
  const mapping = document.querySelector("#columnMapping");
  if (!mapping) {
    return;
  }

  const headers = state.uploadPreview?.headers || [];
  if (headers.length === 0) {
    mapping.className = "column-mapping empty";
    mapping.innerHTML = "CSV 파일을 선택하면 표준 필드 매핑이 표시됩니다.";
    return;
  }

  const schema = currentFieldSchema();
  const requiredText = currentUploadDataset()?.requiredMapping
    ? `필수: ${schema.required.map((field) => fieldLabel(field)).join(", ")}`
    : "매핑 선택 사항";
  mapping.className = "column-mapping";
  mapping.innerHTML = `
    <div class="mapping-head">
      <strong>컬럼 매핑</strong>
      <span>${requiredText}</span>
    </div>
    <div class="mapping-grid">
      ${headers.map((header) => buildMappingRow(header, schema.fields)).join("")}
    </div>
    <div class="mapping-status" id="mappingStatus"></div>
  `;
}

function buildMappingRow(header, fields) {
  const selected = state.uploadMapping[header] || "";
  const options = [
    `<option value="">사용 안 함</option>`,
    ...fields.map((field) => `
      <option value="${escapeHtml(field.key)}" ${field.key === selected ? "selected" : ""}>${escapeHtml(field.label)}</option>
    `)
  ].join("");

  return `
    <label class="mapping-row">
      <span>${escapeHtml(header)}</span>
      <select data-csv-column="${escapeHtml(header)}">${options}</select>
    </label>
  `;
}

function refreshUploadValidation() {
  const commitButton = document.querySelector("#commitUpload");
  const status = document.querySelector("#mappingStatus");
  const issues = validateUploadMapping();

  if (status) {
    status.className = `mapping-status ${issues.length > 0 ? "has-issue" : "is-ok"}`;
    status.textContent = issues.length > 0
      ? issues.join(" · ")
      : currentUploadDataset()?.requiredMapping
        ? "필수 컬럼 매핑 완료"
        : "컬럼 매핑은 선택 사항입니다.";
  }

  if (commitButton) {
    commitButton.disabled = !state.uploadPreview || issues.length > 0;
  }
}

function validateUploadMapping() {
  if (!state.uploadPreview) {
    return ["CSV 파일을 먼저 선택해 주세요."];
  }

  if (!currentUploadDataset()?.requiredMapping) {
    return [];
  }

  const mappedFields = Object.values(state.uploadMapping).filter(Boolean);
  const missing = currentFieldSchema().required.filter((field) => !mappedFields.includes(field));
  const duplicated = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);
  const issues = [];

  if (missing.length > 0) {
    issues.push(`필수 필드 누락: ${missing.map((field) => fieldLabel(field)).join(", ")}`);
  }
  if (duplicated.length > 0) {
    issues.push(`중복 매핑: ${[...new Set(duplicated)].map((field) => fieldLabel(field)).join(", ")}`);
  }

  return issues;
}

function validatePreviewMapping(headers = []) {
  if (!currentUploadDataset()?.requiredMapping) {
    return [];
  }

  const guessed = Object.fromEntries(headers.map((header) => [header, guessFieldKey(header)]));
  const mappedFields = Object.values(guessed).filter(Boolean);
  const missing = currentFieldSchema().required.filter((field) => !mappedFields.includes(field));
  return missing.length > 0 ? [`필수 필드 매핑이 필요합니다: ${missing.map((field) => fieldLabel(field)).join(", ")}`] : [];
}

function currentFieldSchema() {
  const datasetKey = state.uploadPreview?.datasetKey || document.querySelector("#datasetSelect")?.value || "facilities";
  return datasetFieldSchemas[datasetKey] || datasetFieldSchemas.facilities;
}

function guessFieldKey(header) {
  const normalizedHeader = normalizeFieldName(header);
  const schema = currentFieldSchema();
  const match = schema.fields.find((field) => {
    const aliases = fieldAliases[field.key] || [];
    return aliases.some((alias) => normalizeFieldName(alias) === normalizedHeader);
  });
  return match?.key || "";
}

function normalizeFieldName(value) {
  return String(value).toLowerCase().replace(/[\s_\-()[\].]/g, "");
}

function fieldLabel(fieldKey) {
  const field = currentFieldSchema().fields.find((item) => item.key === fieldKey);
  return field?.label || fieldKey;
}

function renderUploadSummary(target, { title, status, message }) {
  if (!target) {
    return;
  }

  target.innerHTML = `
    <strong>${escapeHtml(title || "선택된 파일")}</strong>
    <span class="upload-summary-status">${escapeHtml(status || "")}</span>
    ${message ? `<span>${escapeHtml(message)}</span>` : ""}
  `;
}

function fileExtension(file) {
  const name = String(file?.name || "").toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1) : "";
}

function isCsvFile(file) {
  const extension = fileExtension(file);
  return CSV_EXTENSIONS.has(extension) || file?.type === "text/csv";
}

function isExcelFile(file) {
  const extension = fileExtension(file);
  return EXCEL_EXTENSIONS.has(extension)
    || file?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || file?.type === "application/vnd.ms-excel";
}

async function previewCsvOnBackend(datasetKey, file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/uploads/preview?datasetKey=${encodeURIComponent(datasetKey)}`, {
    method: "POST",
    body: formData
  });
  return response.data;
}

async function readCsvText(file) {
  const buffer = await file.arrayBuffer();
  const utf8Text = decodeCsvText(buffer, "utf-8");

  if (!looksMisdecoded(utf8Text)) {
    return stripCsvBom(utf8Text);
  }

  const koreanText = decodeCsvText(buffer, "euc-kr");
  return stripCsvBom(looksMisdecoded(koreanText) ? utf8Text : koreanText);
}

function decodeCsvText(buffer, encoding) {
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function looksMisdecoded(text) {
  return text.includes("\uFFFD");
}

function stripCsvBom(text) {
  return text.replace(/^\uFEFF/, "");
}

async function fetchAdminJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: ADMIN_AUTH_HEADER,
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const error = new Error(`Admin API request failed: ${response.status}`);
      error.isHttpFailure = true;
      throw error;
    }

    const payload = await response.json();
    if (payload.success === false) {
      const error = new Error(payload.message || "Admin API request failed.");
      error.isApiFailure = true;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function mapBackendLogs(logs = []) {
  return logs.map(mapBackendLog);
}

function mapBackendLog(log) {
  return {
    datasetName: log.datasetName || log.datasetKey || "데이터셋",
    fileName: log.fileName || "-",
    rowCount: log.rowCount || 0,
    columnCount: log.columnCount || 0,
    createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR") : new Date().toLocaleString("ko-KR"),
    status: log.status,
    message: log.message
  };
}

function uploadStatusClass(status) {
  const normalized = normalizeUploadStatus(status);
  return normalized ? `is-${normalized.toLowerCase()}` : "";
}

function uploadStatusLabel(status) {
  const normalized = normalizeUploadStatus(status);
  const labels = {
    SUCCESS: "성공",
    FAILED: "실패",
    LOCAL: "로컬",
    SKIPPED: "건너뜀"
  };
  return labels[normalized] || status;
}

function normalizeUploadStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function friendlyAdminError(error) {
  const message = String(error?.message || "");

  if (message.includes("401")) {
    return "관리자 인증이 맞지 않습니다. 백엔드를 mock 모드로 다시 실행해 주세요.";
  }
  if (message.includes("403")) {
    return "관리자 API 접근이 거부되었습니다. 백엔드 실행 모드와 계정을 확인해 주세요.";
  }
  if (message.toLowerCase().includes("excel")) {
    return "Excel 파일은 아직 실제 파싱을 지원하지 않습니다. CSV로 저장한 뒤 업로드해 주세요.";
  }
  if (error?.isApiFailure) {
    return message || "백엔드 검증에서 업로드 파일을 처리하지 못했습니다.";
  }
  if (error?.isHttpFailure) {
    return message || "백엔드 요청이 실패했습니다.";
  }

  return "백엔드 연결이 없어 브라우저에서 로컬 미리보기로 처리했습니다.";
}

async function commitCsvUpload() {
  const summary = document.querySelector("#csvSummary");
  const commitButton = document.querySelector("#commitUpload");

  if (!state.uploadPreview) {
    return;
  }

  const preview = state.uploadPreview;
  commitButton.disabled = true;
  renderUploadSummary(summary, {
    title: preview.fileName,
    status: "업로드 확정 중",
    message: `${Object.values(state.uploadMapping).filter(Boolean).length}개 컬럼 매핑을 반영하고 있습니다.`
  });

  try {
    const response = await fetchAdminJson(`${BACKEND_API_BASE}/api/admin/uploads/commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        datasetKey: state.uploadPreview.datasetKey,
        uploadId: state.uploadPreview.uploadId,
        fileName: state.uploadPreview.fileName,
        rowCount: state.uploadPreview.rowCount,
        columnCount: state.uploadPreview.columnCount,
        columnMappings: state.uploadMapping
      })
    });
    state.uploadLogs = [mapBackendLog(response.data), ...state.uploadLogs].slice(0, 5);
    const refreshMessage = await refreshFacilitiesAfterUpload(preview);
    renderUploadLogs();
    renderUploadSummary(summary, {
      title: preview.fileName,
      status: "업로드 확정 완료",
      message: refreshMessage || "최근 업로드 로그에 반영했습니다."
    });
  } catch (error) {
    if (error.isApiFailure || error.isHttpFailure) {
      const failedLog = buildUploadLog("FAILED", friendlyAdminError(error));
      recordUploadLog(failedLog);
      renderUploadSummary(summary, {
        title: preview.fileName,
        status: "업로드 검증 실패",
        message: friendlyAdminError(error)
      });
      refreshUploadValidation();
      return;
    }

    recordUploadLog(buildUploadLog(
      "LOCAL",
      `백엔드 연결이 없어 로컬 로그로 저장했습니다. 매핑 ${Object.values(state.uploadMapping).filter(Boolean).length}개`
    ));
    renderUploadSummary(summary, {
      title: preview.fileName,
      status: "로컬 로그 저장",
      message: "백엔드 연결이 없어 브라우저 최근 로그에만 저장했습니다."
    });
    return;
  }
}

function buildUploadLog(status, message) {
  return {
    datasetName: state.uploadPreview.datasetName,
    fileName: state.uploadPreview.fileName,
    rowCount: state.uploadPreview.rowCount,
    columnCount: state.uploadPreview.columnCount,
    createdAt: new Date().toLocaleString("ko-KR"),
    status,
    message
  };
}

function recordUploadLog(log) {
  saveUploadLog(log);
  state.uploadLogs = [log, ...state.uploadLogs].slice(0, 5);
  renderUploadLogs();
}

async function refreshFacilitiesAfterUpload(preview) {
  if (preview.datasetKey !== "facilities") {
    return "최근 업로드 로그에 반영했습니다.";
  }

  try {
    const response = await fetchWithTimeout(`${BACKEND_API_BASE}/api/public/facilities`, 1500);
    const payload = await response.json();
    const facilities = mapBackendFacilities(payload.data);
    if (facilities.length === 0) {
      return "시설 데이터가 아직 비어 있습니다. 최근 업로드 로그를 확인해 주세요.";
    }

    state.data = {
      ...state.data,
      facilities
    };
    renderFacilities();
    return "생활시설 목록과 지도를 새로고침했습니다.";
  } catch {
    return "업로드는 기록됐지만 시설 목록 새로고침은 실패했습니다. 화면을 새로고침해 주세요.";
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((value) => value !== ""));
}

function buildCsvPreview(headers, rows, warnings = []) {
  if (headers.length === 0) {
    return `<div class="csv-preview empty">CSV 컬럼을 찾지 못했습니다.</div>`;
  }

  return `
    ${warnings.length > 0 ? `<div class="preview-warning">${warnings.map((warning) => escapeHtml(warning)).join("<br>")}</div>` : ""}
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${headers.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function readUploadLogs() {
  try {
    return JSON.parse(localStorage.getItem(UPLOAD_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUploadLog(log) {
  const logs = [log, ...readUploadLogs()].slice(0, 5);
  localStorage.setItem(UPLOAD_LOG_KEY, JSON.stringify(logs));
}

function readDatasetEdits() {
  try {
    const rows = JSON.parse(localStorage.getItem(DATASET_CONFIG_KEY) || "[]");
    if (!Array.isArray(rows)) {
      return {};
    }

    return Object.fromEntries(rows
      .map(normalizeAdminDataset)
      .filter((dataset) => dataset.datasetKey)
      .map((dataset) => [dataset.datasetKey, dataset]));
  } catch {
    return {};
  }
}

function saveDatasetEdits() {
  localStorage.setItem(DATASET_CONFIG_KEY, JSON.stringify(state.adminDatasets));
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

loadData().catch((error) => {
  document.body.innerHTML = `<main class="shell"><h1>데이터를 불러오지 못했습니다.</h1><p>${error.message}</p></main>`;
});
