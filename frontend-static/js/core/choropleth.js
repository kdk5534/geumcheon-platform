// 행정동 단계구분도(choropleth) 렌더링 유틸 — map.js·home.js 공용

import { state } from "./state.js";
import { escapeHtml } from "./dom.js";

/**
 * 지표값을 단계구분도 색상으로 매핑한다.
 * @param {number} value
 * @param {string} metric - "인구" 또는 점수 지표명
 * @returns {string}
 */
export function choroplethColor(value, metric) {
  if (metric === "인구") {
    if (value >= 55000) return "#0a4570";
    if (value >= 45000) return "#0c7fb8";
    if (value >= 35000) return "#0d93cf";
    return "#63bde3";
  }
  if (value >= 85) return "#0a4570";
  if (value >= 75) return "#0c7fb8";
  if (value >= 65) return "#0d93cf";
  if (value >= 55) return "#63bde3";
  return "#c5e8f7";
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

  markerLayers.forEach((l) => l.bringToFront());
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

  const steps = metric === "인구"
    ? [
        { color: "#0a4570", label: compact ? "55,000명↑" : "55,000명 이상" },
        { color: "#0c7fb8", label: compact ? "45,000명↑" : "45,000명 이상" },
        { color: "#0d93cf", label: compact ? "35,000명↑" : "35,000명 이상" },
        { color: "#63bde3", label: compact ? "35,000명↓" : "35,000명 미만" },
      ]
    : [
        { color: "#0a4570", label: compact ? "85점↑" : "85점 이상" },
        { color: "#0c7fb8", label: compact ? "75점↑" : "75점 이상" },
        { color: "#0d93cf", label: compact ? "65점↑" : "65점 이상" },
        { color: "#63bde3", label: compact ? "55점↑" : "55점 이상" },
        { color: "#c5e8f7", label: compact ? "55점↓" : "55점 미만" },
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
