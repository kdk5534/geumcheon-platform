// 생활지도 페이지: Leaflet 실제 지도 + 시설 마커 + 카테고리 필터

import { state, categoryColor, categoryInitial, toCategoryCode } from "../core/state.js";
import { createDataState } from "../core/data-state.js";
import { escapeHtml } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { loadFacilitiesInBbox } from "../core/api.js";
import { renderDataStamp } from "../core/meta.js";
import { bindTileFailureFallback, injectPageCss, loadLeaflet, loadMarkerCluster, createBaseTileLayer } from "../core/assets.js";
import { addGeumcheonBoundaryLayer } from "../core/map-boundary.js";

const GEUMCHEON_CENTER = [37.4565, 126.8954];
const CATEGORIES = ["전체", "병원", "약국", "복지", "어린이집", "대피시설", "주차장", "따릉이", "CCTV", "와이파이", "쉼터", "보호구역", "충전소"];

// 모듈-레벨 상태 (unmount 시 정리)
let mapInstance = null;
let markerLayers = {};
let allMarkers = [];
let isMounted = false;
let pageController = null;

// DB 모드에서 뷰포트 이동 시 백엔드로 받아온 시설 목록.
// null이면 state.data.facilities(초기 로드·mock 모드)를 사용한다.
let viewportFacilities = null;
let mapRuntimeError = false;
let viewportLoadError = false;
// fetch 진행 중 여부. true인 동안 새 moveend는 viewportPending에 저장된다.
let viewportFetching = false;
// fetch 완료 후 즉시 재조회해야 할 최신 bounds. null이면 재조회 불필요.
let viewportPending = null;
let selectedFacilityId = null;

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  pageController?.abort();
  pageController = new AbortController();
  isMounted = true;
  mapRuntimeError = false;
  await injectPageCss("css-page-map", "./css/pages/map.css");
  if (!isMounted) return;
  container.innerHTML = buildHtml();
  bindEvents(container);
  renderCatStats();
  renderFacilityList();

  try {
    await loadLeaflet();
    await loadMarkerCluster();
  } catch {
    mapRuntimeError = true;
    if (!isMounted) return;
    const pane = document.getElementById("map-pane");
    if (pane) pane.innerHTML = `<div class="map-error">지도를 불러올 수 없습니다.<br>인터넷 연결을 확인해 주세요.</div>`;
    renderCatStats();
    renderFacilityList();
    renderMapStatus();
    return;
  }

  if (!isMounted) return;
  initMap();
  renderMapStatus();

}

export function unmount() {
  isMounted = false;
  pageController?.abort();
  pageController = null;
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  markerLayers = {};
  allMarkers = [];
  viewportFacilities = null;
  mapRuntimeError = false;
  viewportLoadError = false;
  viewportFetching = false;
  viewportPending = null;
  selectedFacilityId = null;
}

export function refresh() {
  if (mapInstance) {
    Object.values(markerLayers).forEach((layer) => layer.clearLayers());
    allMarkers = [];
    buildMarkers();
  }
  renderCatStats();
  renderFacilityList();
  renderMapStatus();
}

// ─── HTML 구조 ────────────────────────────────────────────────

function buildHtml() {
  const filterBtns = CATEGORIES.map((cat) => `
    <button
      class="map-filter-btn${state.category === cat ? " is-active" : ""}"
      data-cat="${escapeHtml(cat)}"
      aria-pressed="${state.category === cat}"
    >${escapeHtml(cat)}</button>
  `).join("");

  const facilityCount = Array.isArray(state.data?.facilities) ? state.data.facilities.length : 0;
  const catCounts = CATEGORIES.filter((c) => c !== "전체").map((cat) => ({
    cat,
    count: Array.isArray(state.data?.facilities)
      ? state.data.facilities.filter((f) => f.category === cat).length
      : 0,
  }));
  const topCat = [...catCounts].sort((a, b) => b.count - a.count)[0];

  return `
    <div class="map-page">
      <div class="map-header">
        <div class="page-banner" style="--banner-from:#102d42;--banner-to:#1c6d80;margin-bottom:var(--space-4)">
          <div class="page-banner-icon">${icon("map", { size: 26 })}</div>
          <div class="page-banner-copy">
            <p class="page-banner-eyebrow">생활지도</p>
            <h2 class="page-banner-title">금천구 생활시설 지도</h2>
            <p class="page-banner-desc">병원·약국·주차장·안전시설·따릉이·CCTV의 등록 위치를 지도와 목록에서 확인합니다.</p>
          </div>
          <div class="page-banner-stats">
            <div class="page-banner-stat">
              <span class="page-banner-stat-val">${facilityCount || "—"}</span>
              <span class="page-banner-stat-label">등록 시설</span>
            </div>
            <div class="page-banner-stat">
              <span class="page-banner-stat-val">${CATEGORIES.length - 1}</span>
              <span class="page-banner-stat-label">카테고리</span>
            </div>
            <div class="page-banner-stat">
              <span class="page-banner-stat-val">${topCat ? escapeHtml(topCat.cat) : "—"}</span>
              <span class="page-banner-stat-label">최다 시설</span>
            </div>
          </div>
          <a class="page-banner-back" href="#/home">◀ 홈으로</a>
        </div>
        <div class="map-status-card" id="map-status-card" aria-live="polite"></div>
        <div class="map-toolbar">
          <div class="map-filter-bar" role="group" aria-label="시설 카테고리 필터">
            <span class="map-filter-label">시설</span>
            ${filterBtns}
            <span class="map-count" id="map-count" aria-live="polite"></span>
          </div>
          <p class="map-coordinate-basis">지도는 시설 등록 좌표를 표시합니다. 검증되지 않은 단순화 행정경계는 표시하지 않습니다.</p>
        </div>
      </div>
      <div class="map-split">
        <div id="map-pane" role="region" aria-label="금천구 생활지도"></div>
        <aside class="map-list-pane">
          <div class="map-list-header">
            <span class="map-list-title">시설 목록</span>
            <span class="map-list-count" id="map-list-count"></span>
          </div>
          <p class="map-list-basis">거리순이 아닙니다. 현재 위치를 사용하지 않아 거리와 영업 여부를 계산하지 않습니다.</p>
          <div class="map-cat-stats" id="map-cat-stats" aria-label="카테고리별 시설 현황"></div>
          <ul class="map-facility-list" id="facility-list" role="list" aria-label="시설 목록"></ul>
        </aside>
      </div>
    </div>
  `;
}

function getActiveCategoryCount() {
  return getFilteredFacilities().length;
}

function getMapStateMeta() {
  const activeCount = getActiveCategoryCount();
  const wifiSnapshot = state.data?.operationalSnapshots?.publicWifi;
  const dataState = createDataState({
    hasData: activeCount > 0,
    sourceMode: state.data?.sourceMode,
    error: state.data?.sourceModeError,
    sourceName: state.data?.meta?.life?.source,
    collectedAt: state.data?.meta?.life?.asOf,
  });

  if (mapRuntimeError) {
    return {
      tone: "err",
      label: "지도 오류",
      title: "지도 라이브러리를 불러오지 못해 위치 기반 탐색이 제한되었습니다.",
      note: "목록과 데이터 수량은 유지되지만 지도를 통한 위치 탐색은 잠시 사용할 수 없습니다.",
    };
  }

  if (viewportLoadError) {
    return {
      tone: "warn",
      label: "시설 조회 지연",
      title: "현재 지도 범위의 최신 시설을 불러오지 못했습니다.",
      note: "마지막으로 확인된 목록을 유지하고 있습니다. 잠시 후 지도를 다시 이동하거나 필터를 선택해 주세요.",
    };
  }

  if (!activeCount) {
    return {
      tone: "muted",
      label: "결과 없음",
      title: `${state.category} 조건에 맞는 시설이 현재 화면에 없습니다.`,
      note: "필터를 바꾸거나 지도를 이동하면 다른 생활 시설 데이터를 이어서 탐색할 수 있습니다.",
    };
  }

  if (toCategoryCode(state.category) === "WIFI" && wifiSnapshot) {
    return {
      tone: "warn",
      label: "마지막 성공 데이터",
      title: `공공 Wi-Fi는 마지막 성공 스냅샷 ${Number(wifiSnapshot.sourceRows || 1644).toLocaleString("ko-KR")}건을 사용합니다.`,
      note: `서울시 8088 실시간 수집은 비활성화되어 있습니다. 기준시각 ${wifiSnapshot.collectedAt || "2026-06-19"} · 화면 목록은 금천구 범위 필터가 적용됩니다.`,
    };
  }

  if (state.data?.sourceModeError && state.data?.sourceMode === "mixed") {
    return {
      tone: dataState.tone,
      label: dataState.label,
      title: "시설 조회 일부가 지연되어 최근 응답과 보조 데이터를 함께 사용하고 있습니다.",
      note: "현재 목록 수와 지도 마커는 유지되지만 최신 수량과 차이가 있을 수 있습니다.",
    };
  }

  if (state.data?.sourceMode === "db") {
    return {
      tone: dataState.tone,
      label: dataState.label,
      title: "현재 필터 기준 시설 위치를 DB 데이터로 제공하고 있습니다.",
      note: "지도를 움직이면 현재 화면 범위 기준으로 시설 목록이 다시 정리됩니다.",
    };
  }

  if (state.data?.sourceMode === "mixed") {
    return {
      tone: dataState.tone,
      label: dataState.label,
      title: "지도는 혼합 데이터 모드로 동작 중이며 일부 시설은 최근 캐시를 사용합니다.",
      note: "운영 전환 과정에서도 탐색 흐름이 끊기지 않도록 보조 데이터를 함께 제공합니다.",
    };
  }

  return {
    tone: dataState.tone,
    label: dataState.label,
    title: "내 주변 화면이 로컬 샘플 데이터로 동작 중입니다.",
    note: "카테고리 필터와 생활권 탐색 UX는 검증할 수 있지만 실제 운영 수치와는 다를 수 있습니다.",
  };
}

function renderMapStatus() {
  const el = document.getElementById("map-status-card");
  if (!el) return;

  const meta = getMapStateMeta();
  const activeCount = getActiveCategoryCount();
  const label = state.category === "전체" ? "전체 시설" : `${state.category} 시설`;
  const wifiSnapshot = state.data?.operationalSnapshots?.publicWifi;
  const wifiNotice = toCategoryCode(state.category) === "WIFI" && wifiSnapshot
    ? `<p class="map-status-note map-status-note--snapshot">마지막 성공 데이터 · 공공 Wi-Fi ${Number(wifiSnapshot.sourceRows || 1644).toLocaleString("ko-KR")}건 스냅샷 · 서울시 8088 실시간 수집은 비활성화 · 기준시각 ${escapeHtml(wifiSnapshot.collectedAt || "2026-06-19")}</p>`
    : "";

  el.innerHTML = `
    <div class="map-status-head">
      <span class="map-state-pill map-state-pill--${meta.tone}">${escapeHtml(meta.label)}</span>
      <span class="map-status-title">${escapeHtml(meta.title)}</span>
    </div>
    <div class="map-status-metrics">
      <div class="map-status-metric">
        <strong>${activeCount}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
      <div class="map-status-metric">
        <strong>${escapeHtml(state.category)}</strong>
        <span>선택 카테고리</span>
      </div>
      <div class="map-status-metric">
        <strong>${viewportFacilities !== null ? "현재 화면" : "전체 기준"}</strong>
        <span>조회 범위</span>
      </div>
    </div>
    <p class="map-status-note">${escapeHtml(meta.note)}</p>
    ${wifiNotice}
    ${renderDataStamp("life", "생활시설 지도")}
  `;
}

// ─── 지도 초기화 ──────────────────────────────────────────────

function initMap() {
  const mapEl = document.getElementById("map-pane");
  if (!mapEl || !window.L) return;

  const L = window.L;
  mapInstance = L.map(mapEl, {
    zoomControl: true,
    minZoom: 12,
    maxBounds: [[37.405, 126.82], [37.515, 126.96]],
    maxBoundsViscosity: 0.72,
  }).setView(GEUMCHEON_CENTER, 14);

  // 타일 레이어 + 컨트롤 (VWorld 키 있을 때만 위성 토글 노출)
  const baseLayers = {
    "일반지도": bindTileFailureFallback(createBaseTileLayer(L, "base"), showMapProviderError),
    "위성지도": bindTileFailureFallback(createBaseTileLayer(L, "satellite"), showMapProviderError),
  };
  baseLayers["일반지도"].addTo(mapInstance);
  addGeumcheonBoundaryLayer(L, mapInstance, { color: "#3159d8" });
  L.control.layers(baseLayers, {}, { position: "topright", collapsed: false }).addTo(mapInstance);

  const clusterOpts = {
    maxClusterRadius: 50,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster) => L.divIcon({
      html: `<div class="map-cluster">${cluster.getChildCount()}</div>`,
      className: "",
      iconSize: L.point(36, 36),
    }),
  };
  CATEGORIES.filter((c) => c !== "전체").forEach((cat) => {
    const group = window.L?.MarkerClusterGroup
      ? L.markerClusterGroup({ ...clusterOpts })
      : L.layerGroup();
    markerLayers[cat] = group;
    group.addTo(mapInstance);
  });

  buildMarkers();
  renderCatStats();
  renderFacilityList();

  // DB 모드에서만 뷰포트 이동 시 bbox 필터 갱신
  // sourceMode는 state.data 안에 있다 (state 루트에는 없음)
  if (state.data?.sourceMode === "db" || state.data?.sourceMode === "mixed") {
    mapInstance.on("moveend", onMapMoveEnd);
    onMapMoveEnd();
  }
}

// ─── 뷰포트 bbox 갱신 ─────────────────────────────────────────

/**
 * DB 모드에서 지도 이동이 끝나면 현재 뷰포트 범위의 시설을 재조회한다.
 * fetch 진행 중 새 moveend가 오면 viewportPending에 저장하고, 현재 fetch 완료 후
 * 최신 bounds로 자동 재조회한다(latest-wins 패턴 — stale 뷰포트 데이터 방지).
 */
async function onMapMoveEnd() {
  if (!mapInstance || !isMounted) return;

  if (viewportFetching) {
    // 진행 중이면 최신 bounds를 기록해 두고 현재 fetch가 끝난 후 처리
    viewportPending = mapInstance.getBounds();
    return;
  }

  viewportFetching = true;
  try {
    // 최신 pending이 있으면 그 bounds를, 없으면 현재 bounds를 사용
    let bounds = viewportPending || mapInstance.getBounds();
    viewportPending = null;

    // pending이 누적될 수 있으므로 do/while로 남은 pending을 소진
    do {
      if (!isMounted) return;
      const items = await loadFacilitiesInBbox({
        minLat: bounds.getSouth(),
        minLng: bounds.getWest(),
        maxLat: bounds.getNorth(),
        maxLng: bounds.getEast(),
        category: state.category !== "전체" ? state.category : undefined,
        signal: pageController?.signal,
      });
      if (!isMounted) return;
      // null = 네트워크/서버 실패 → 기존 마커 유지. [] = 실제 0건 → 마커 비움
      if (items !== null) {
        viewportLoadError = false;
        viewportFacilities = items;
        Object.values(markerLayers).forEach((l) => l.clearLayers());
        allMarkers = [];
        buildMarkers();
        renderCatStats();
        renderFacilityList();
      } else {
        viewportLoadError = true;
        renderMapStatus();
      }
      bounds = viewportPending;
      viewportPending = null;
    } while (bounds !== null);
  } finally {
    viewportFetching = false;
  }
}

/** 현재 렌더에 사용할 시설 배열. 뷰포트 데이터 > 초기 로드 데이터 순으로 사용한다. */
function getActiveFacilities() {
  if (viewportFacilities !== null) return viewportFacilities;
  return Array.isArray(state.data?.facilities) ? state.data.facilities : [];
}

function getFilteredFacilities() {
  const facilities = getActiveFacilities();
  if (state.category === "전체") return facilities;
  return facilities.filter((facility) => facility.category === state.category);
}

// ─── 마커 생성 ────────────────────────────────────────────────

function showMapProviderError() {
  const mapEl = document.getElementById("map-pane");
  if (!mapEl || mapEl.querySelector(".map-provider-error")) return;
  const notice = document.createElement("div");
  notice.className = "map-provider-error";
  notice.setAttribute("role", "status");
  notice.innerHTML = "<strong>VWorld 지도를 불러오지 못했습니다.</strong><span>오른쪽 시설 목록에서 같은 정보를 계속 확인할 수 있습니다.</span>";
  mapEl.appendChild(notice);
}

function buildMarkers() {
  if (!window.L || !mapInstance) return;

  const L = window.L;
  const facilities = getActiveFacilities();

  facilities.forEach((facility) => {
    const lat = Number(facility.latitude);
    const lng = Number(facility.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const cat   = facility.category || "기타";
    const color = categoryColor[cat] || "#3d6f99";
    const initial = categoryInitial[cat] || "F";
    const layer = markerLayers[cat];
    if (!layer) return;

    const icon = L.divIcon({
      className: "",
      html: `<div class="map-marker-pin" style="background:${color}" title="${escapeHtml(facility.name)}">${escapeHtml(initial)}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16]
    });

    const popupContent = [
      `<strong>${escapeHtml(facility.name)}</strong>`,
      `<span class="popup-cat">${escapeHtml(cat)}</span>`,
      facility.address ? `<small>${escapeHtml(facility.address)}</small>` : "",
      facility.phone   ? `<small>☎ ${escapeHtml(facility.phone)}</small>` : "",
      facility.source ? `<small>출처: ${escapeHtml(facility.source)}</small>` : "",
      facility.dataReferenceDate ? `<small>기준일: ${escapeHtml(facility.dataReferenceDate)}</small>` : ""
    ].filter(Boolean).join("<br>");

    const marker = L.marker([lat, lng], { icon }).bindPopup(popupContent);
    marker.on("click", () => selectFacility(idForFacility(facility), { scroll: true }));
    layer.addLayer(marker);
    allMarkers.push({ id: facility.id, marker, facility, cat });
  });
}

// ─── 카테고리 통계 미니 차트 ──────────────────────────────────

function renderCatStats() {
  const el = document.getElementById("map-cat-stats");
  if (!el) return;

  const cats = CATEGORIES.filter((c) => c !== "전체");
  const facilities = getActiveFacilities();
  const counts = cats.map((cat) => ({
    cat,
    count: facilities.filter((facility) => facility.category === cat).length,
    color: categoryColor[cat] || "#3d6f99",
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);

  el.innerHTML = `
    <div class="map-cat-stats-title">카테고리별 현황</div>
    ${counts.map(({ cat, count, color }) => `
      <div class="map-cat-row">
        <span class="map-cat-label">${escapeHtml(cat)}</span>
        <div class="map-cat-track">
          <div class="map-cat-fill" style="width:${Math.round((count / max) * 100)}%;background:${color}"></div>
        </div>
        <span class="map-cat-val">${count}</span>
      </div>
    `).join("")}
  `;
}

// ─── 목록 렌더 ────────────────────────────────────────────────

function renderFacilityList() {
  const list       = document.getElementById("facility-list");
  const countEl    = document.getElementById("map-count");
  const listCountEl = document.getElementById("map-list-count");
  if (!list) return;
  renderMapStatus();

  const filtered = getFilteredFacilities();

  const countText = `${filtered.length}개 시설`;
  if (countEl)     countEl.textContent = countText;
  if (listCountEl) listCountEl.textContent = `${filtered.length}개`;

  if (filtered.length === 0) {
    const categoryLabel = state.category === "전체" ? "현재 조회 범위" : `${state.category} 카테고리`;
    list.innerHTML = `
      <li class="map-empty-state">
        <strong>${escapeHtml(categoryLabel)}에 표시할 시설이 없습니다.</strong>
        <span>다른 시설 유형을 선택하거나 조회 범위를 변경해 주세요.</span>
        ${state.category !== "전체" ? '<button type="button" class="map-empty-reset">전체 시설 보기</button>' : ""}
      </li>
    `;
    return;
  }

  list.innerHTML = filtered.map((facility) => {
    const id = idForFacility(facility);
    const cat = facility.category || "기타";
    const color = categoryColor[cat] || "#3d6f99";
    const canFocus = Boolean(mapInstance && allMarkers.some((item) => String(item.id) === String(id)));
    const phone = String(facility.phone || "").trim();
    const phoneHref = phone.replace(/[^0-9+]/g, "");
    return `
      <li class="facility-item${String(selectedFacilityId) === String(id) ? " is-selected" : ""}"
          data-facility-id="${escapeHtml(String(id))}"${String(selectedFacilityId) === String(id) ? ' aria-current="true"' : ""}>
        <span class="facility-dot" style="background:${color}" aria-hidden="true"></span>
        <div class="facility-info">
          <div class="facility-name">${escapeHtml(facility.name)}</div>
          <div class="facility-meta">
            <span class="facility-cat">${escapeHtml(cat)}</span>
            <span class="facility-addr">${escapeHtml(facility.address || "")}</span>
          </div>
          <div class="facility-meta">
            ${facility.source ? `<span>출처: ${escapeHtml(facility.source)}</span>` : ""}
            ${facility.dataReferenceDate ? `<span>기준일: ${escapeHtml(facility.dataReferenceDate)}</span>` : ""}
          </div>
          ${(canFocus || phoneHref) ? `
            <div class="facility-actions">
              ${canFocus ? `<button type="button" class="facility-focus" data-id="${escapeHtml(String(id))}">지도에서 보기</button>` : ""}
              ${phoneHref ? `<a href="tel:${escapeHtml(phoneHref)}">${escapeHtml(phone)} 전화</a>` : ""}
            </div>
          ` : ""}
        </div>
      </li>
    `;
  }).join("");
}

// ─── 필터 적용 ────────────────────────────────────────────────

function applyFilter() {
  const active = state.category;
  if (mapInstance) {
    CATEGORIES.filter((c) => c !== "전체").forEach((cat) => {
      const layer = markerLayers[cat];
      if (!layer) return;
      const shouldShow = active === "전체" || active === cat;
      if (shouldShow && !mapInstance.hasLayer(layer)) mapInstance.addLayer(layer);
      else if (!shouldShow && mapInstance.hasLayer(layer)) mapInstance.removeLayer(layer);
    });
  }
  renderFacilityList();
}

// ─── 시설 포커스 ──────────────────────────────────────────────

function focusFacility(id) {
  const found = allMarkers.find((m) => String(m.id) === String(id));
  if (!found || !mapInstance) return;
  mapInstance.setView(found.marker.getLatLng(), 17, { animate: true });
  found.marker.openPopup();
  selectFacility(id);
}

function idForFacility(facility) {
  return facility.id ?? `${facility.category || "facility"}-${facility.name || "unknown"}`;
}

function selectFacility(id, { scroll = false } = {}) {
  selectedFacilityId = id;
  document.querySelectorAll("#facility-list .facility-item").forEach((item) => {
    const selected = String(item.dataset.facilityId) === String(id);
    item.classList.toggle("is-selected", selected);
    if (selected) item.setAttribute("aria-current", "true");
    else item.removeAttribute("aria-current");
    if (selected && scroll) item.scrollIntoView({ block: "nearest" });
  });
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(container) {
  container.addEventListener("click", (e) => {
    // 시설 카테고리 필터
    const filterBtn = e.target.closest(".map-filter-btn");
    if (filterBtn) {
      state.category = filterBtn.dataset.cat;
      container.querySelectorAll(".map-filter-btn").forEach((b) => {
        const isActive = b.dataset.cat === state.category;
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-pressed", String(isActive));
      });
      applyFilter();
      return;
    }

    const resetBtn = e.target.closest(".map-empty-reset");
    if (resetBtn) {
      state.category = "전체";
      container.querySelectorAll(".map-filter-btn").forEach((button) => {
        const isActive = button.dataset.cat === "전체";
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      applyFilter();
      return;
    }

    // 시설 목록 클릭
    const focusBtn = e.target.closest(".facility-focus[data-id]");
    if (focusBtn) {
      focusFacility(focusBtn.dataset.id);
      return;
    }
  });
}
