// 생활지도 페이지: Leaflet 실제 지도 + 시설 마커 + 행정동 단계구분도(choropleth) + 카테고리 필터

import { state, categoryColor, categoryInitial } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { loadFacilitiesInBbox } from "../core/api.js";

const GEUMCHEON_CENTER = [37.4565, 126.8954];
const CATEGORIES = ["전체", "병원", "약국", "주차장", "안전"];
const CHOROPLETH_METRICS = ["생활", "교통", "안전", "인구"];

// 모듈-레벨 상태 (unmount 시 정리)
let mapInstance = null;
let markerLayers = {};
let allMarkers = [];
let choroplethLayer = null;
let choroplethMetric = "생활"; // 단계구분도 기준 지표
let isMounted = false;

// DB 모드에서 뷰포트 이동 시 백엔드로 받아온 시설 목록.
// null이면 state.data.facilities(초기 로드·mock 모드)를 사용한다.
let viewportFacilities = null;
// 뷰포트 갱신 중복 방지 플래그
let viewportFetching = false;

// ─── CSS / Leaflet 동적 로드 ──────────────────────────────────

function injectCss() {
  if (!document.getElementById("css-page-map")) {
    const link = document.createElement("link");
    link.id = "css-page-map";
    link.rel = "stylesheet";
    link.href = "./css/pages/map.css";
    document.head.appendChild(link);
  }
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existing = document.getElementById("leaflet-js");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet 스크립트 로드 실패")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Leaflet 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
}

// GeoJSON 파일을 로드한다.
function loadGeoJson() {
  return fetch("./assets/data/geumcheon-dong.geojson").then((r) => {
    if (!r.ok) throw new Error("GeoJSON 로드 실패");
    return r.json();
  });
}

// ─── 공개 인터페이스 ──────────────────────────────────────────

export async function mount(container) {
  isMounted = true;
  injectCss();
  container.innerHTML = buildHtml();

  try {
    await loadLeaflet();
  } catch {
    if (!isMounted) return;
    const pane = document.getElementById("map-pane");
    if (pane) pane.innerHTML = `<div class="map-error">지도를 불러올 수 없습니다.<br>인터넷 연결을 확인해 주세요.</div>`;
    return;
  }

  if (!isMounted) return;
  initMap();
  bindEvents(container);

  // GeoJSON 로드 후 choropleth 추가 (실패해도 마커는 정상 동작)
  try {
    const geojson = await loadGeoJson();
    if (!isMounted) return;
    initChoropleth(geojson);
    renderLegend();
  } catch (e) {
    console.warn("choropleth GeoJSON 로드 실패:", e.message);
  }
}

export function unmount() {
  isMounted = false;
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  markerLayers = {};
  allMarkers = [];
  choroplethLayer = null;
  viewportFacilities = null;
  viewportFetching = false;
}

export function refresh() {
  if (!mapInstance) return;
  Object.values(markerLayers).forEach((layer) => layer.clearLayers());
  allMarkers = [];
  buildMarkers();
  renderFacilityList();
  if (choroplethLayer) updateChoroplethColors();
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

  const choroplethBtns = CHOROPLETH_METRICS.map((m) => `
    <button
      class="map-choropleth-btn${choroplethMetric === m ? " is-active" : ""}"
      data-choropleth="${escapeHtml(m)}"
      aria-pressed="${choroplethMetric === m}"
    >${escapeHtml(m)}</button>
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
        <div class="page-banner" style="--banner-from:#0d2a45;--banner-to:#0d93cf;margin-bottom:var(--space-4)">
          <div class="page-banner-icon">${icon("map", { size: 26 })}</div>
          <div class="page-banner-copy">
            <p class="page-banner-eyebrow">생활지도</p>
            <h2 class="page-banner-title">금천구 생활시설 지도</h2>
            <p class="page-banner-desc">병원·약국·주차장·안전시설 위치와 행정동별 접근성을 지도에서 확인합니다.</p>
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
        <div class="map-toolbar">
          <div class="map-filter-bar" role="group" aria-label="시설 카테고리 필터">
            <span class="map-filter-label">시설</span>
            ${filterBtns}
            <span class="map-count" id="map-count" aria-live="polite"></span>
          </div>
          <div class="map-choropleth-bar" role="group" aria-label="단계구분도 기준">
            <span class="map-filter-label">지역 지표</span>
            ${choroplethBtns}
          </div>
        </div>
      </div>
      <div class="map-split">
        <div id="map-pane" role="region" aria-label="금천구 생활지도">
          <div id="map-legend" class="map-legend" aria-label="단계구분도 범례"></div>
        </div>
        <aside class="map-list-pane">
          <div class="map-list-header">
            <span class="map-list-title">시설 목록</span>
            <span class="map-list-count" id="map-list-count"></span>
          </div>
          <div class="map-cat-stats" id="map-cat-stats" aria-label="카테고리별 시설 현황"></div>
          <ul class="map-facility-list" id="facility-list" role="list" aria-label="시설 목록"></ul>
        </aside>
      </div>
    </div>
  `;
}

// ─── 지도 초기화 ──────────────────────────────────────────────

function initMap() {
  const mapEl = document.getElementById("map-pane");
  if (!mapEl || !window.L) return;

  const L = window.L;
  mapInstance = L.map(mapEl, { zoomControl: true }).setView(GEUMCHEON_CENTER, 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapInstance);

  CATEGORIES.filter((c) => c !== "전체").forEach((cat) => {
    markerLayers[cat] = L.layerGroup().addTo(mapInstance);
  });

  buildMarkers();
  renderCatStats();
  renderFacilityList();

  // DB 모드에서만 뷰포트 이동 시 bbox 필터 갱신
  if (state.sourceMode === "db" || state.sourceMode === "mixed") {
    mapInstance.on("moveend", onMapMoveEnd);
  }
}

// ─── Choropleth ───────────────────────────────────────────────

function getDistrictValue(name) {
  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];

  if (choroplethMetric === "인구") {
    const pop = Array.isArray(state.data?.population) ? state.data.population : [];
    const found = pop.find((p) => p.areaName === name);
    return found ? Number(found.total) : 0;
  }

  const d = districts.find((d) => d.name === name);
  return d ? Number(d.scores?.[choroplethMetric] || 0) : 0;
}

function choroplethColor(value, metric) {
  if (metric === "인구") {
    // 인구는 절대값 스케일 (금천구 3개 동 기준)
    if (value >= 55000) return "#0a4570";
    if (value >= 45000) return "#0c7fb8";
    if (value >= 35000) return "#0d93cf";
    return "#63bde3";
  }
  // 점수 스케일 (0~100)
  if (value >= 85) return "#0a4570";
  if (value >= 75) return "#0c7fb8";
  if (value >= 65) return "#0d93cf";
  if (value >= 55) return "#63bde3";
  return "#c5e8f7";
}

function initChoropleth(geojson) {
  if (!window.L || !mapInstance) return;

  if (choroplethLayer) {
    choroplethLayer.remove();
    choroplethLayer = null;
  }

  choroplethLayer = window.L.geoJSON(geojson, {
    style: (feature) => {
      const name  = feature.properties?.name || "";
      const value = getDistrictValue(name);
      return {
        fillColor:   choroplethColor(value, choroplethMetric),
        fillOpacity: 0.45,
        color:       "#ffffff",
        weight:      2,
        opacity:     0.8,
      };
    },
    onEachFeature: (feature, layer) => {
      const name  = feature.properties?.name || "";
      const value = getDistrictValue(name);
      const label = choroplethMetric === "인구"
        ? `${name}<br><strong>${Number(value).toLocaleString()}명</strong>`
        : `${name}<br><strong>${value}점</strong> (${choroplethMetric})`;

      layer.bindTooltip(label, { sticky: true, className: "map-tooltip" });

      layer.on({
        mouseover: (e) => {
          e.target.setStyle({ fillOpacity: 0.7, weight: 3 });
          e.target.bringToFront();
        },
        mouseout: (e) => {
          choroplethLayer.resetStyle(e.target);
        },
        click: (e) => {
          mapInstance.fitBounds(e.target.getBounds(), { padding: [40, 40] });
        },
      });
    },
  }).addTo(mapInstance);

  // 마커를 choropleth 위로
  Object.values(markerLayers).forEach((l) => l.bringToFront());
}

function updateChoroplethColors() {
  if (!choroplethLayer) return;
  choroplethLayer.setStyle((feature) => {
    const name  = feature.properties?.name || "";
    const value = getDistrictValue(name);
    return {
      fillColor:   choroplethColor(value, choroplethMetric),
      fillOpacity: 0.45,
      color:       "#ffffff",
      weight:      2,
      opacity:     0.8,
    };
  });
  // 툴팁 내용도 갱신
  choroplethLayer.eachLayer((layer) => {
    const name  = layer.feature?.properties?.name || "";
    const value = getDistrictValue(name);
    const label = choroplethMetric === "인구"
      ? `${name}<br><strong>${Number(value).toLocaleString()}명</strong>`
      : `${name}<br><strong>${value}점</strong> (${choroplethMetric})`;
    layer.setTooltipContent(label);
  });
  renderLegend();
}

function renderLegend() {
  const el = document.getElementById("map-legend");
  if (!el) return;

  const steps = choroplethMetric === "인구"
    ? [{ color: "#0a4570", label: "55,000명 이상" }, { color: "#0c7fb8", label: "45,000명 이상" },
       { color: "#0d93cf", label: "35,000명 이상" }, { color: "#63bde3", label: "35,000명 미만" }]
    : [{ color: "#0a4570", label: "85점 이상" }, { color: "#0c7fb8", label: "75점 이상" },
       { color: "#0d93cf", label: "65점 이상" }, { color: "#63bde3", label: "55점 이상" },
       { color: "#c5e8f7", label: "55점 미만" }];

  el.innerHTML = `
    <div class="map-legend-title">${escapeHtml(choroplethMetric)} 지수</div>
    ${steps.map((s) => `
      <div class="map-legend-item">
        <span class="map-legend-swatch" style="background:${s.color}"></span>
        <span>${escapeHtml(s.label)}</span>
      </div>
    `).join("")}
  `;
}

// ─── 뷰포트 bbox 갱신 ─────────────────────────────────────────

/** DB 모드에서 지도 이동이 끝나면 현재 뷰포트 범위의 시설을 재조회한다. */
async function onMapMoveEnd() {
  if (!mapInstance || !isMounted || viewportFetching) return;
  viewportFetching = true;
  try {
    const b = mapInstance.getBounds();
    const items = await loadFacilitiesInBbox({
      minLat: b.getSouth(),
      minLng: b.getWest(),
      maxLat: b.getNorth(),
      maxLng: b.getEast(),
      category: state.category !== "전체" ? state.category : undefined,
    });
    if (!isMounted) return;
    // 결과가 있을 때만 교체 (요청 실패 시 기존 마커 유지)
    if (items.length > 0 || viewportFacilities !== null) {
      viewportFacilities = items;
      Object.values(markerLayers).forEach((l) => l.clearLayers());
      allMarkers = [];
      buildMarkers();
      renderCatStats();
      renderFacilityList();
    }
  } finally {
    viewportFetching = false;
  }
}

/** 현재 렌더에 사용할 시설 배열. 뷰포트 데이터 > 초기 로드 데이터 순으로 사용한다. */
function getActiveFacilities() {
  if (viewportFacilities !== null) return viewportFacilities;
  return Array.isArray(state.data?.facilities) ? state.data.facilities : [];
}

// ─── 마커 생성 ────────────────────────────────────────────────

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
      facility.phone   ? `<small>☎ ${escapeHtml(facility.phone)}</small>` : ""
    ].filter(Boolean).join("<br>");

    const marker = L.marker([lat, lng], { icon }).bindPopup(popupContent);
    layer.addLayer(marker);
    allMarkers.push({ id: facility.id, marker, facility, cat });
  });
}

// ─── 카테고리 통계 미니 차트 ──────────────────────────────────

function renderCatStats() {
  const el = document.getElementById("map-cat-stats");
  if (!el) return;

  const cats = CATEGORIES.filter((c) => c !== "전체");
  const counts = cats.map((cat) => ({
    cat,
    count: allMarkers.filter((m) => m.cat === cat).length,
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

  const active   = state.category;
  const filtered = active === "전체" ? allMarkers : allMarkers.filter((m) => m.cat === active);

  const countText = `${filtered.length}개 시설`;
  if (countEl)     countEl.textContent = countText;
  if (listCountEl) listCountEl.textContent = `${filtered.length}개`;

  if (filtered.length === 0) {
    list.innerHTML = `<li class="facility-item" style="cursor:default;color:var(--muted);padding:var(--space-6) var(--space-5)">해당 카테고리의 시설이 없습니다.</li>`;
    return;
  }

  list.innerHTML = filtered.map(({ id, facility, cat }) => {
    const color = categoryColor[cat] || "#3d6f99";
    return `
      <li
        class="facility-item"
        data-id="${escapeHtml(String(id))}"
        tabindex="0"
        role="button"
        aria-label="${escapeHtml(facility.name)}, ${escapeHtml(cat)}"
      >
        <span class="facility-dot" style="background:${color}" aria-hidden="true"></span>
        <div class="facility-info">
          <div class="facility-name">${escapeHtml(facility.name)}</div>
          <div class="facility-meta">
            <span class="facility-cat">${escapeHtml(cat)}</span>
            <span class="facility-addr">${escapeHtml(facility.address || "")}</span>
          </div>
        </div>
      </li>
    `;
  }).join("");
}

// ─── 필터 적용 ────────────────────────────────────────────────

function applyFilter() {
  if (!mapInstance) return;
  const active = state.category;
  CATEGORIES.filter((c) => c !== "전체").forEach((cat) => {
    const layer = markerLayers[cat];
    if (!layer) return;
    const shouldShow = active === "전체" || active === cat;
    if (shouldShow && !mapInstance.hasLayer(layer)) mapInstance.addLayer(layer);
    else if (!shouldShow && mapInstance.hasLayer(layer)) mapInstance.removeLayer(layer);
  });
  renderFacilityList();
}

// ─── 시설 포커스 ──────────────────────────────────────────────

function focusFacility(id) {
  const found = allMarkers.find((m) => String(m.id) === String(id));
  if (!found || !mapInstance) return;
  mapInstance.setView(found.marker.getLatLng(), 17, { animate: true });
  found.marker.openPopup();
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

    // 단계구분도 기준 토글
    const choroplethBtn = e.target.closest(".map-choropleth-btn");
    if (choroplethBtn) {
      choroplethMetric = choroplethBtn.dataset.choropleth;
      container.querySelectorAll(".map-choropleth-btn").forEach((b) => {
        const isActive = b.dataset.choropleth === choroplethMetric;
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-pressed", String(isActive));
      });
      updateChoroplethColors();
      return;
    }

    // 시설 목록 클릭
    const item = e.target.closest(".facility-item[data-id]");
    if (item) {
      focusFacility(item.dataset.id);
      return;
    }
  });

  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = e.target.closest(".facility-item[data-id]");
    if (item) { e.preventDefault(); focusFacility(item.dataset.id); }
  });
}
