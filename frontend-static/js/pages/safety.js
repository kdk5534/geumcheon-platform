import { state } from "../core/state.js";
import { escapeHtml } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { bindTileFailureFallback, injectPageCss, loadLeaflet, createBaseTileLayer } from "../core/assets.js";
import { addGeumcheonBoundaryLayer } from "../core/map-boundary.js";

let root = null;
let map = null;
let layerGroup = null;
let mounted = false;

const LAYERS = [
  { key: "air", label: "대기질", category: null, color: "#3159d8", available: true },
  { key: "cctv", label: "CCTV", category: "CCTV", color: "#ef6b5b", available: true },
  { key: "shelter", label: "쉼터", category: "쉼터", color: "#19a88a", available: false, reason: "공개 데이터 확인 전" },
  { key: "school", label: "스쿨존", category: "보호구역", color: "#d49324", available: false, reason: "공개 데이터 확인 전" },
];

export async function mount(container) {
  mounted = true;
  root = container;
  await injectPageCss("css-page-safety-v2", "./css/pages/safety-v2.css");
  await injectPageCss("css-professional-dashboard", "./css/professional-dashboard.css");
  render();
  await initMap();
}

export function unmount() {
  mounted = false;
  map?.remove();
  map = null;
  layerGroup = null;
  root = null;
}

function currentLayer() {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  return LAYERS.find((item) => item.key === params.get("layer") && item.available) || LAYERS[0];
}

function render() {
  if (!root) return;
  const layer = currentLayer();
  const air = (state.data?.metrics || []).find((item) => String(item.label || "").includes("미세먼지") || String(item.label || "").includes("대기"));
  const hasMapRows = facilitiesFor(layer).length > 0;
  root.innerHTML = `
    <div class="safety-page">
      <header class="safety-head">
        <div><p>SAFETY & ENVIRONMENT</p><h1>안전·환경 통합 상황 지도</h1><span>확인된 공간 데이터와 관측값을 레이어별로 살펴봅니다. 지역 평가는 제공하지 않습니다.</span></div>
        <div class="safety-head-actions"><button type="button" data-shell-action="share">공유</button><a href="#/datasets?topic=safety">데이터 근거</a></div>
      </header>

      <section class="safety-layer-rail" aria-labelledby="safety-layer-title">
        <div><span>MAP LAYERS</span><h2 id="safety-layer-title">표시할 정보를 선택하세요</h2></div>
        <div class="safety-layer-buttons">
          ${LAYERS.map((item) => `<button type="button" data-safety-layer="${item.key}" class="${item.key === layer.key ? "is-active" : ""}" ${item.available ? "" : "disabled"}><i style="--layer-color:${item.color}"></i><strong>${item.label}</strong><span>${item.available ? "표시 가능" : item.reason}</span></button>`).join("")}
        </div>
      </section>

      <section class="safety-workspace">
        <div class="safety-map-panel">
          <div class="safety-panel-head"><div><span>GEUMCHEON · ${layer.label}</span><h2>${layer.label} 공간 현황</h2></div><div class="safety-map-switch"><button type="button" class="${hasMapRows ? "is-active" : ""}" data-safety-view="map" ${hasMapRows ? "" : "disabled"}>지도</button><button type="button" class="${hasMapRows ? "" : "is-active"}" data-safety-view="list">목록</button></div></div>
          <div id="safety-map" class="safety-map" aria-label="금천구 ${layer.label} 지도" ${hasMapRows ? "" : "hidden"}></div>
          <div id="safety-map-fallback" class="safety-map-fallback" ${hasMapRows ? "hidden" : ""}>${renderList(layer)}</div>
          <div class="safety-map-foot"><span>공개 범위 <strong>GEUMCHEON</strong></span><span>좌표 <strong>WGS84</strong></span><span>지도 실패 시 목록으로 동일 과업을 완료할 수 있습니다.</span></div>
        </div>
        <aside class="safety-analysis">
          <div class="safety-panel-head"><div><span>OBSERVATION</span><h2>${layer.key === "air" ? "최근 대기 관측" : "확인된 시설 목록"}</h2></div></div>
          ${layer.key === "air" ? renderAir(air) : renderFacilitySummary(layer)}
          <div class="safety-policy"><strong>표시 원칙</strong><p>최근 수집이 실패해도 마지막 정상 스냅샷을 유지하고 실패 사실을 함께 알립니다.</p><a href="#/datasets">수집 상태 자세히 보기</a></div>
        </aside>
      </section>

      <section class="safety-unavailable"><div><span>DATA AVAILABILITY</span><h2>현재 분석에 사용하지 않는 항목</h2></div><p>무더위 쉼터와 스쿨존은 신뢰 가능한 공개 데이터 계약이 확정되기 전까지 지도·통계에 포함하지 않습니다.</p></section>
    </div>
  `;
  bind();
}

function facilitiesFor(layer) {
  if (!layer.category) return [];
  return (state.data?.facilities || []).filter((item) => String(item.category || "").toUpperCase().includes(layer.category.toUpperCase()));
}

function renderList(layer) {
  const rows = facilitiesFor(layer);
  if (!rows.length) return `<div class="safety-empty"><strong>표시 가능한 ${escapeHtml(layer.label)} 데이터가 없습니다.</strong><span>데이터 카탈로그에서 수집 상태와 공개 여부를 확인해 주세요.</span></div>`;
  return rows.slice(0, 30).map((item) => `<div class="safety-list-row"><i style="--layer-color:${layer.color}"></i><div><strong>${escapeHtml(item.name || layer.label)}</strong><span>${escapeHtml(item.address || "주소 정보 없음")}</span></div></div>`).join("");
}

function renderAir(metric) {
  return `<div class="safety-air-value"><span>금천구 관측값</span><strong>${escapeHtml(metric?.value || "—")}</strong><p>${escapeHtml(metric?.note || "관측 데이터의 기준시각을 확인해 주세요.")}</p></div><dl class="safety-meta"><div><dt>단위</dt><dd>${escapeHtml(metric?.unit || "원천 기준")}</dd></div><div><dt>기준시각</dt><dd>${escapeHtml(state.data?.meta?.overview?.asOf || "항목별 표시")}</dd></div><div><dt>출처</dt><dd>${escapeHtml(state.data?.meta?.overview?.source || "데이터 카탈로그 확인")}</dd></div></dl>`;
}

function renderFacilitySummary(layer) {
  const facilities = facilitiesFor(layer);
  return `<div class="safety-facility-count"><span>표시된 데이터 행</span><strong>${facilities.length.toLocaleString("ko-KR")}<small>행</small></strong><p>고유 시설 수가 아닌 공개 API 응답 행 수입니다.</p></div><div class="safety-mini-list">${facilities.slice(0, 5).map((item) => `<a href="#/nearby?category=${encodeURIComponent(layer.category)}"><strong>${escapeHtml(item.name || layer.label)}</strong><span>${escapeHtml(item.address || "주소 정보 없음")}</span>${icon("chevron-right", { size: 14 })}</a>`).join("") || `<span class="safety-empty-inline">표시 가능한 데이터 없음</span>`}</div>`;
}

function bind() {
  root.querySelectorAll("[data-safety-layer]:not([disabled])").forEach((button) => button.addEventListener("click", () => {
    history.replaceState(null, "", `${location.pathname}${location.search}#/safety?layer=${button.dataset.safetyLayer}`);
    map?.remove(); map = null; layerGroup = null;
    render(); initMap();
  }));
  root.querySelectorAll("[data-safety-view]").forEach((button) => button.addEventListener("click", () => {
    const listMode = button.dataset.safetyView === "list";
    root.querySelectorAll("[data-safety-view]").forEach((item) => item.classList.toggle("is-active", item === button));
    root.querySelector("#safety-map").hidden = listMode;
    root.querySelector("#safety-map-fallback").hidden = !listMode;
    if (!listMode) requestAnimationFrame(() => map?.invalidateSize());
  }));
}

async function initMap() {
  const element = root?.querySelector("#safety-map");
  const layer = currentLayer();
  if (!element || !facilitiesFor(layer).length) return;
  try {
    await loadLeaflet();
    if (!mounted || !root?.contains(element)) return;
    const L = window.L;
    map = L.map(element, { scrollWheelZoom: false, maxBounds: [[37.405, 126.82], [37.515, 126.96]] }).setView([37.4565, 126.8954], 13);
    bindTileFailureFallback(createBaseTileLayer(L), showSafetyListFallback).addTo(map);
    addGeumcheonBoundaryLayer(L, map, { color: layer.color, fillColor: layer.color });
    layerGroup = L.featureGroup().addTo(map);
    facilitiesFor(layer).forEach((facility) => {
      const lat = Number(facility.latitude); const lng = Number(facility.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.circleMarker([lat, lng], { radius: 5, color: "#fff", weight: 2, fillColor: layer.color, fillOpacity: .92 });
      marker.bindPopup(`<strong>${escapeHtml(facility.name || layer.label)}</strong><br><small>${escapeHtml(facility.address || "주소 정보 없음")}</small>`).addTo(layerGroup);
    });
    requestAnimationFrame(() => map?.invalidateSize());
  } catch {
    if (!root) return;
    root.querySelector("#safety-map").hidden = true;
    root.querySelector("#safety-map-fallback").hidden = false;
  }
}

function showSafetyListFallback() {
  if (!root) return;
  root.querySelectorAll("[data-safety-view]").forEach((item) =>
    item.classList.toggle("is-active", item.dataset.safetyView === "list")
  );
  const mapElement = root.querySelector("#safety-map");
  const fallback = root.querySelector("#safety-map-fallback");
  if (mapElement) mapElement.hidden = true;
  if (fallback) {
    fallback.hidden = false;
    fallback.classList.add("is-provider-error");
    fallback.setAttribute("aria-label", "VWorld 지도를 불러오지 못해 표시한 데이터 목록");
  }
}
