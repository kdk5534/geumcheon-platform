// 행정동 단계구분도(choropleth) 렌더링 유틸 — map.js·home.js 공용

import { state } from "./state.js";
import { escapeHtml } from "./dom.js";

const PALETTE = ["#c5e8f7", "#63bde3", "#0d93cf", "#0c7fb8", "#0a4570"];

/**
 * 값 배열에서 분위수 기반 색상 경계를 계산한다.
 * @param {number[]} values
 * @param {number} steps - 단계 수
 * @returns {number[]} 오름차순 임계값 배열 (length = steps - 1)
 */
function quantileBreaks(values, steps) {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const breaks = [];
  for (let i = 1; i < steps; i++) {
    const idx = Math.floor((i / steps) * sorted.length);
    breaks.push(sorted[Math.min(idx, sorted.length - 1)]);
  }
  return breaks;
}

// 지표별 분위수 캐시 (동일 데이터 반복 계산 방지)
const _breakCache = new Map();

/**
 * 지표 전체 값을 기반으로 분위수 임계값을 반환한다.
 * @param {string} metric
 * @returns {number[]}
 */
function getBreaks(metric) {
  if (_breakCache.has(metric)) return _breakCache.get(metric);
  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  const pop       = Array.isArray(state.data?.population) ? state.data.population : [];
  let values;
  if (metric === "인구") {
    values = pop.map((p) => Number(p.total) || 0);
  } else {
    values = districts.map((d) => Number(d.scores?.[metric]) || 0);
  }
  const breaks = quantileBreaks(values, PALETTE.length);
  _breakCache.set(metric, breaks);
  return breaks;
}

/** 메트릭이 바뀔 때 캐시를 초기화한다. */
export function clearChoroplethCache() {
  _breakCache.clear();
}

/**
 * 지표값을 단계구분도 색상으로 매핑한다 (분위수 기반).
 * @param {number} value
 * @param {string} metric
 * @returns {string}
 */
export function choroplethColor(value, metric) {
  if (value <= 0) return PALETTE[0];
  const breaks = getBreaks(metric);
  if (breaks.length === 0) {
    // 폴백: 이전 고정 임계값
    if (metric === "인구") {
      if (value >= 55000) return PALETTE[4];
      if (value >= 45000) return PALETTE[3];
      if (value >= 35000) return PALETTE[2];
      return PALETTE[1];
    }
    if (value >= 85) return PALETTE[4];
    if (value >= 75) return PALETTE[3];
    if (value >= 65) return PALETTE[2];
    if (value >= 55) return PALETTE[1];
    return PALETTE[0];
  }
  for (let i = breaks.length - 1; i >= 0; i--) {
    if (value >= breaks[i]) return PALETTE[i + 1];
  }
  return PALETTE[0];
}

/**
 * state.data에서 행정동 이름으로 지표값을 조회한다.
 * @param {string} name   - 행정동 이름
 * @param {string} metric - 지표명
 * @returns {number}
 */
export function getDistrictValue(name, metric) {
  const districts = Array.isArray(state.data?.districts) ? state.data.districts : [];
  if (metric === "인구") {
    const pop = Array.isArray(state.data?.population) ? state.data.population : [];
    const found = pop.find((p) => p.areaName === name);
    return found ? Number(found.total) : 0;
  }
  const d = districts.find((d) => d.name === name);
  return d ? Number(d.scores?.[metric] || 0) : 0;
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────

function makeTooltipLabel(name, value, metric) {
  return metric === "인구"
    ? `${name}<br><strong>${Number(value).toLocaleString()}명</strong>`
    : `${name}<br><strong>${value}점</strong> (${metric})`;
}

function makeStyle(value, metric, fillOpacity, opacity) {
  return {
    fillColor:   choroplethColor(value, metric),
    fillOpacity,
    color:       "#ffffff",
    weight:      2,
    opacity,
  };
}

// ─── 공개 API ───────────────────────────────────────────────────

/**
 * Leaflet GeoJSON 단계구분도 레이어를 생성해 지도에 추가한다.
 *
 * @param {object}   L              - window.L
 * @param {object}   mapInst        - Leaflet 지도 인스턴스
 * @param {object}   geojson        - GeoJSON 객체
 * @param {object}   opts
 * @param {string}   opts.metric              - 현재 지표명
 * @param {object[]} [opts.markerLayers=[]]   - 위로 올릴 레이어 배열
 * @param {number}   [opts.fillOpacity=0.45]
 * @param {number}   [opts.opacity=0.8]
 * @param {number}   [opts.hoverFillOpacity=0.7]
 * @param {number[]} [opts.fitPadding=[40,40]]
 * @returns {object} Leaflet GeoJSON 레이어
 */
export function createChoroplethLayer(L, mapInst, geojson, opts = {}) {
  const {
    metric,
    markerLayers   = [],
    fillOpacity    = 0.45,
    opacity        = 0.8,
    hoverFillOpacity = 0.7,
    fitPadding     = [40, 40],
  } = opts;

  const layer = L.geoJSON(geojson, {
    style: (feature) => {
      const name  = feature.properties?.name || "";
      const value = getDistrictValue(name, metric);
      return makeStyle(value, metric, fillOpacity, opacity);
    },
    onEachFeature: (feature, featureLayer) => {
      const name  = feature.properties?.name || "";
      const value = getDistrictValue(name, metric);
      featureLayer.bindTooltip(makeTooltipLabel(name, value, metric), {
        sticky: true,
        className: "map-tooltip",
      });
      featureLayer.on({
        mouseover: (e) => {
          e.target.setStyle({ fillOpacity: hoverFillOpacity, weight: 3 });
          e.target.bringToFront();
        },
        mouseout: (e) => { layer.resetStyle(e.target); },
        click:    (e) => { mapInst.fitBounds(e.target.getBounds(), { padding: fitPadding }); },
      });
    },
  }).addTo(mapInst);

  // LayerGroup은 bringToFront가 없으므로 FeatureGroup/GeoJSON 계열에만 호출한다.
  markerLayers.forEach((l) => { if (typeof l.bringToFront === "function") l.bringToFront(); });
  return layer;
}

/**
 * 단계구분도 레이어의 색상·툴팁을 새 지표로 갱신한다.
 *
 * @param {object} layer  - createChoroplethLayer 반환값
 * @param {string} metric - 새 지표명
 * @param {object} [opts]
 * @param {number} [opts.fillOpacity=0.45]
 * @param {number} [opts.opacity=0.8]
 */
export function updateChoroplethLayer(layer, metric, opts = {}) {
  if (!layer) return;
  const { fillOpacity = 0.45, opacity = 0.8 } = opts;

  layer.setStyle((feature) => {
    const name  = feature.properties?.name || "";
    const value = getDistrictValue(name, metric);
    return makeStyle(value, metric, fillOpacity, opacity);
  });

  layer.eachLayer((featureLayer) => {
    const name  = featureLayer.feature?.properties?.name || "";
    const value = getDistrictValue(name, metric);
    featureLayer.setTooltipContent(makeTooltipLabel(name, value, metric));
  });
}

/**
 * 단계구분도 범례를 지정된 엘리먼트에 렌더링한다.
 *
 * @param {string}  elId                   - 범례 컨테이너 엘리먼트 ID
 * @param {string}  metric                 - 현재 지표명
 * @param {object}  [opts]
 * @param {string}  [opts.cssPrefix="map-legend"] - CSS 클래스 접두어
 * @param {boolean} [opts.compact=false]          - true이면 "↑/↓" 약식 표기
 */
export function renderChoroplethLegend(elId, metric, opts = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  const { cssPrefix = "map-legend", compact = false } = opts;

  const breaks = getBreaks(metric);
  const unit = metric === "인구" ? "명" : "점";
  const fmt = (v) => metric === "인구" ? Number(v).toLocaleString() : String(Math.round(v));
  const steps = breaks.length > 0
    ? [
        { color: PALETTE[0], label: compact ? `${fmt(breaks[0])}${unit}↓` : `${fmt(breaks[0])}${unit} 미만` },
        ...breaks.slice(1).map((b, i) => ({
          color: PALETTE[i + 1],
          label: compact ? `${fmt(b)}${unit}↑` : `${fmt(b)}${unit} 이상`,
        })),
        { color: PALETTE[PALETTE.length - 1], label: compact ? `${fmt(breaks[breaks.length - 1])}${unit}↑` : `${fmt(breaks[breaks.length - 1])}${unit} 이상` },
      ].slice(0, PALETTE.length)
    : metric === "인구"
      ? [
          { color: PALETTE[4], label: "55,000명 이상" },
          { color: PALETTE[3], label: "45,000명 이상" },
          { color: PALETTE[2], label: "35,000명 이상" },
          { color: PALETTE[1], label: "35,000명 미만" },
        ]
      : [
          { color: PALETTE[4], label: "85점 이상" },
          { color: PALETTE[3], label: "75점 이상" },
          { color: PALETTE[2], label: "65점 이상" },
          { color: PALETTE[1], label: "55점 이상" },
          { color: PALETTE[0], label: "55점 미만" },
        ];

  el.innerHTML = `
    <div class="${cssPrefix}-title">${escapeHtml(metric)} 지수</div>
    ${steps.map((s) => `
      <div class="${cssPrefix}-item">
        <span class="${cssPrefix}-swatch" style="background:${s.color}"></span>
        <span>${escapeHtml(s.label)}</span>
      </div>
    `).join("")}
  `;
}
