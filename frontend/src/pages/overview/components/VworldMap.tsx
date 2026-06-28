import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { BACKEND_API_BASE } from "../../../data/env";
import type { FacilitySummary } from "../overviewTypes";
import { normalizeDongName } from "../../../data/dongName";
import { choroplethColor, legendRanges, quantileBreaks } from "./choropleth";

/** choropleth(단계구분도) 모드 — 행정동별 값과 라벨 */
export interface ChoroplethProps {
  valuesByDong: Map<string, number>;
  metricLabel: string;
}

interface Props {
  facilities: FacilitySummary[];
  onUnavailable?: () => void;
  onSelectFacility?: (facility: FacilitySummary) => void;
  selectedFacilityId?: string;
  /** choropleth 모드 활성화 시 전달. 미전달이면 경계선만 표시. */
  choropleth?: ChoroplethProps;
}

const GEUMCHEON_CENTER: L.LatLngExpression = [37.4565, 126.8954];
const GEUMCHEON_BOUNDS: L.LatLngBoundsExpression = [
  [37.405, 126.82],
  [37.515, 126.96],
];
const DONG_GEOJSON_URL = "./assets/data/geumcheon-dong.geojson";

export function VworldMap({ facilities, onUnavailable, onSelectFacility, selectedFacilityId, choropleth }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const [status, setStatus] = useState<"ready" | "checking" | "not-configured" | "no-backend" | "tile-error">(
    BACKEND_API_BASE ? "ready" : "no-backend",
  );
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!mapRef.current || !BACKEND_API_BASE) {
      setStatus("no-backend");
      setStatusMessage("React 환경에서 BACKEND_API_BASE가 설정되지 않았습니다.");
      onUnavailable?.();
      return undefined;
    }

    let disposed = false;
    setStatus("checking");
    fetch(`${BACKEND_API_BASE}/api/public/map/status`)
      .then((response) => response.json())
      .then((payload: { configured?: boolean }) => {
        if (disposed) return;
        if (!payload.configured) {
          setStatus("not-configured");
          setStatusMessage("백엔드에 VWORLD_API_KEY가 설정되지 않았습니다.");
          onUnavailable?.();
        } else {
          setStatus("ready");
        }
      })
      .catch(() => {
        if (disposed) return;
        setStatus("tile-error");
        setStatusMessage("지도 상태 API에 접근하지 못했습니다. 백엔드 재시작 또는 CORS 설정을 확인해 주세요.");
        onUnavailable?.();
      });

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      maxBounds: GEUMCHEON_BOUNDS,
      maxBoundsViscosity: 0.72,
    }).setView(GEUMCHEON_CENTER, 14);
    instanceRef.current = map;

    let tileFailures = 0;
    const tileLayer = L.tileLayer(`${BACKEND_API_BASE}/api/public/map/tiles/base/{z}/{y}/{x}`, {
      attribution: '&copy; <a href="https://www.vworld.kr" target="_blank" rel="noopener">VWorld</a> · 국토교통부',
      minZoom: 6,
      maxZoom: 18,
      errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
    });
    tileLayer.on("tileerror", () => {
      tileFailures += 1;
      if (tileFailures >= 3) {
        setStatus("tile-error");
        setStatusMessage("VWorld 타일을 불러오지 못했습니다. 백엔드 CORS 또는 VWorld 응답을 확인해 주세요.");
        onUnavailable?.();
      }
    });
    tileLayer.addTo(map);

    const markerLayer = L.markerClusterGroup({ chunkedLoading: true }).addTo(map);
    markerLayerRef.current = markerLayer;
    addBoundaryLayer(map, choropleth).then((layer) => {
      if (!disposed) boundaryLayerRef.current = layer;
    });
    const sizingTimer = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      disposed = true;
      window.clearTimeout(sizingTimer);
      map.remove();
      instanceRef.current = null;
      markerLayerRef.current = null;
      boundaryLayerRef.current = null;
    };
    // choropleth prop은 별도 effect에서 갱신 — 지도 재초기화 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnavailable]);

  // choropleth prop 변경 시 경계 레이어 스타일·범례만 갱신
  useEffect(() => {
    const map = instanceRef.current;
    const layer = boundaryLayerRef.current;
    if (!map || !layer) return;
    // 기존 레이어 제거 후 재렌더
    layer.remove();
    boundaryLayerRef.current = null;
    addBoundaryLayer(map, choropleth).then((newLayer) => {
      boundaryLayerRef.current = newLayer;
    });
  }, [choropleth]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
    markerLayer.clearLayers();
    markerRefs.current.clear();
    facilities
      .filter((facility) => facility.lat && facility.lng)
      .forEach((facility) => {
        const selected = selectedFacilityId === facility.id;
        const marker = L.marker([facility.lat!, facility.lng!], {
          icon: facilityDivIcon(facility.category, selected),
        });
        const ariaLabel = `${facility.name} (${facility.category})`;
        marker
          .bindPopup(
            `<strong>${escapeHtml(facility.name)}</strong><br><small>${escapeHtml(facility.address)}</small><br><em>${facility.coordinateSource === "estimated" ? "원천 좌표 없음 · 지도 표시용 위치" : "원천 좌표"}</em>`,
          )
          .on("click", () => onSelectFacility?.(facility))
          // Leaflet이 leaflet-interactive 마커에 role="button"을 자동 부여 → aria-label 필수
          .on("add", () => { marker.getElement()?.setAttribute("aria-label", ariaLabel); })
          .addTo(markerLayer);
        markerRefs.current.set(facility.id, marker);
      });
  }, [facilities, onSelectFacility, selectedFacilityId]);

  useEffect(() => {
    if (!selectedFacilityId) return;
    const map = instanceRef.current;
    const marker = markerRefs.current.get(selectedFacilityId);
    if (!map || !marker) return;
    const latlng = marker.getLatLng();
    map.flyTo(latlng, Math.max(map.getZoom(), 15), { animate: true, duration: 0.45 });
    marker.openPopup();
  }, [selectedFacilityId]);

  return (
    <div className="gdp-vworld-shell">
      <div ref={mapRef} className="gdp-vworld-map" role="region" aria-label="VWorld 금천구 지도" />
      <div className="gdp-map-legend" aria-label="지도 범례">
        <span><i className="is-life" aria-hidden="true" />생활·교통</span>
        <span><i className="is-welfare" aria-hidden="true" />복지·건강</span>
        <span><i className="is-safety" aria-hidden="true" />안전·환경</span>
        <span><i className="is-other" aria-hidden="true" />기타</span>
      </div>
      {choropleth && <ChoroplethLegend choropleth={choropleth} />}
      {status !== "ready" ? (
        <div className="gdp-map-alert" role="status">
          {status === "checking"
            ? "지도 상태를 확인하고 있습니다."
            : statusMessage || (status === "no-backend" ? "백엔드 지도 프록시가 설정되지 않았습니다." : "지도 타일을 불러오지 못했습니다.")}
        </div>
      ) : null}
    </div>
  );
}

/** choropleth 범례 컴포넌트 */
function ChoroplethLegend({ choropleth }: { choropleth: ChoroplethProps }) {
  const values = [...choropleth.valuesByDong.values()];
  if (values.length === 0) return null;
  const breaks = quantileBreaks(values);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const ranges = legendRanges(breaks, minVal, maxVal);
  return (
    <div className="gdp-choropleth-legend" aria-label={`${choropleth.metricLabel} 단계구분도 범례`}>
      <div className="gdp-choropleth-legend-title">{choropleth.metricLabel}</div>
      <div className="gdp-choropleth-legend-items">
        {ranges.map((r) => (
          <div key={r.label} className="gdp-choropleth-legend-item">
            <span className="gdp-choropleth-legend-swatch" style={{ background: r.color }} />
            <span className="gdp-choropleth-legend-label">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 행정동 경계 레이어를 지도에 추가하고 GeoJSON 레이어 인스턴스를 반환한다.
 * choropleth prop이 있으면 값 기반 채색, 없으면 경계선만 표시.
 * 경계 데이터는 정적 파일(public/assets/data/geumcheon-dong.geojson)을 우선 사용한다.
 */
async function addBoundaryLayer(map: L.Map, choropleth?: ChoroplethProps): Promise<L.GeoJSON | null> {
  try {
    const response = await fetch(DONG_GEOJSON_URL);
    if (!response.ok) return null;
    const data = (await response.json()) as GeoJSON.FeatureCollection;
    if (data?.type !== "FeatureCollection") return null;

    // choropleth 값 구간 계산
    const values = choropleth ? [...choropleth.valuesByDong.values()] : [];
    const breaks = choropleth ? quantileBreaks(values) : [];

    const layer = L.geoJSON(data, {
      style: (feature) => {
        if (!choropleth || !feature?.properties) {
          return {
            color: "#3159d8",
            weight: 1.2,
            opacity: 0.72,
            fillColor: "#3159d8",
            fillOpacity: 0.035,
            dashArray: "4 4",
          };
        }
        const dongName = normalizeDongName(
          String(feature.properties.name || feature.properties.ADM_NM || feature.properties.adm_nm || ""),
        );
        const value = choropleth.valuesByDong.get(dongName);
        const fillColor = choroplethColor(value, breaks);
        return {
          color: "#1a3a6b",
          weight: 1.5,
          opacity: 0.85,
          fillColor,
          fillOpacity: fillColor === "transparent" ? 0.05 : 0.62,
          dashArray: undefined,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties as Record<string, unknown> | null;
        const rawName = String(props?.name || props?.ADM_NM || props?.adm_nm || "").trim();
        const dongName = normalizeDongName(rawName);

        if (choropleth) {
          const value = choropleth.valuesByDong.get(dongName);
          const valueText = value !== undefined ? value.toLocaleString("ko-KR") : "데이터 없음";
          featureLayer.bindTooltip(
            `<strong>${escapeHtml(dongName)}</strong><br>${escapeHtml(choropleth.metricLabel)}: ${valueText}`,
            { sticky: true, direction: "top" },
          );
          featureLayer.on({
            mouseover(e) {
              (e.target as L.Path).setStyle({ weight: 2.5, opacity: 1 });
            },
            mouseout(e) {
              layer.resetStyle(e.target as L.Path);
            },
          });
        } else if (dongName) {
          featureLayer.bindTooltip(dongName, { sticky: true, direction: "top" });
        }

        // 폴리곤을 마커 아래로 내려 시설 마커가 가려지지 않게 한다
        featureLayer.on("add", () => {
          (featureLayer as L.Path).bringToBack();
        });
      },
    });

    layer.addTo(map);
    layer.bringToBack();
    return layer;
  } catch {
    // 경계 레이어는 선택적 — 실패해도 지도 동작에 영향 없음
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markerTone(category: string) {
  const normalized = category.toLocaleLowerCase("ko-KR");
  if (normalized.includes("cctv") || normalized.includes("안전") || normalized.includes("쉼터") || normalized.includes("대피")) {
    return "#d49324";
  }
  if (normalized.includes("복지") || normalized.includes("의료") || normalized.includes("병원") || normalized.includes("약국")) {
    return "#00a88f";
  }
  if (normalized.includes("주차") || normalized.includes("전기차") || normalized.includes("자전거") || normalized.includes("wi-fi")) {
    return "#3159d8";
  }
  return "#ef6b5b";
}

/** 카테고리별 마커 도형 — 색맹 이중 인코딩용 */
type MarkerShape = "triangle" | "circle" | "square" | "diamond";

function markerShape(category: string): MarkerShape {
  const normalized = category.toLocaleLowerCase("ko-KR");
  if (normalized.includes("cctv") || normalized.includes("안전") || normalized.includes("쉼터") || normalized.includes("대피")) {
    return "triangle";
  }
  if (normalized.includes("복지") || normalized.includes("의료") || normalized.includes("병원") || normalized.includes("약국")) {
    return "circle";
  }
  if (normalized.includes("주차") || normalized.includes("전기차") || normalized.includes("자전거") || normalized.includes("wi-fi")) {
    return "square";
  }
  return "diamond";
}

/** 색+도형 SVG 문자열 생성 — aria-hidden으로 스크린리더 노출 방지 */
function buildMarkerSvg(color: string, shape: MarkerShape, size: number, selected: boolean): string {
  const sw = selected ? 3 : 2;
  const half = size / 2;
  const r = half - sw - 1;
  const base = `width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"`;
  switch (shape) {
    case "triangle":
      return `<svg ${base}><polygon points="${half},${sw} ${size - sw},${size - sw} ${sw},${size - sw}" fill="${color}" stroke="#fff" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
    case "circle":
      return `<svg ${base}><circle cx="${half}" cy="${half}" r="${r}" fill="${color}" stroke="#fff" stroke-width="${sw}"/></svg>`;
    case "square":
      return `<svg ${base}><rect x="${sw}" y="${sw}" width="${size - sw * 2}" height="${size - sw * 2}" rx="3" fill="${color}" stroke="#fff" stroke-width="${sw}"/></svg>`;
    case "diamond":
    default:
      return `<svg ${base}><polygon points="${half},${sw} ${size - sw},${half} ${half},${size - sw} ${sw},${half}" fill="${color}" stroke="#fff" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
  }
}

/** L.divIcon 생성 — 선택 여부에 따라 크기 조정 */
function facilityDivIcon(category: string, selected: boolean): L.DivIcon {
  const color = markerTone(category);
  const shape = markerShape(category);
  const size = selected ? 28 : 22;
  return L.divIcon({
    html: buildMarkerSvg(color, shape, size, selected),
    className: "gdp-facility-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 2)],
  });
}
