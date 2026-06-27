import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BACKEND_API_BASE } from "../../../data/env";
import type { FacilitySummary } from "../overviewTypes";

interface Props {
  facilities: FacilitySummary[];
  onUnavailable: () => void;
  onSelectFacility?: (facility: FacilitySummary) => void;
  selectedFacilityId?: string;
}

const GEUMCHEON_CENTER: L.LatLngExpression = [37.4565, 126.8954];
const GEUMCHEON_BOUNDS: L.LatLngBoundsExpression = [
  [37.405, 126.82],
  [37.515, 126.96],
];
const MAX_VISIBLE_MARKERS = 500;

export function VworldMap({ facilities, onUnavailable, onSelectFacility, selectedFacilityId }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markerRefs = useRef<Map<string, L.CircleMarker>>(new Map());
  const [status, setStatus] = useState<"ready" | "checking" | "not-configured" | "no-backend" | "tile-error">(
    BACKEND_API_BASE ? "ready" : "no-backend",
  );
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!mapRef.current || !BACKEND_API_BASE) {
      setStatus("no-backend");
      setStatusMessage("React 환경에서 BACKEND_API_BASE가 설정되지 않았습니다.");
      onUnavailable();
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
          onUnavailable();
        } else {
          setStatus("ready");
        }
      })
      .catch(() => {
        if (disposed) return;
        setStatus("tile-error");
        setStatusMessage("지도 상태 API에 접근하지 못했습니다. 백엔드 재시작 또는 CORS 설정을 확인해 주세요.");
        onUnavailable();
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
        onUnavailable();
      }
    });
    tileLayer.addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    markerLayerRef.current = markerLayer;
    void addBoundaryLayer(map);
    window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      disposed = true;
      map.remove();
      instanceRef.current = null;
      markerLayerRef.current = null;
    };
  }, [onUnavailable]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
    markerLayer.clearLayers();
    markerRefs.current.clear();
    facilities
      .filter((facility) => facility.lat && facility.lng)
      .slice(0, MAX_VISIBLE_MARKERS)
      .forEach((facility) => {
        const tone = markerTone(facility.category);
        const selected = selectedFacilityId === facility.id;
        const marker = L.circleMarker([facility.lat!, facility.lng!], {
          radius: selected ? 9 : 6,
          color: "#ffffff",
          weight: selected ? 3 : 2,
          fillColor: tone,
          fillOpacity: 0.92,
        });
        marker
          .bindPopup(
            `<strong>${escapeHtml(facility.name)}</strong><br><small>${escapeHtml(facility.address)}</small><br><em>${facility.coordinateSource === "estimated" ? "원천 좌표 없음 · 지도 표시용 위치" : "원천 좌표"}</em>`,
          )
          .on("click", () => onSelectFacility?.(facility))
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
        <span><i className="is-life" />생활·교통</span>
        <span><i className="is-welfare" />복지·건강</span>
        <span><i className="is-safety" />안전·환경</span>
        <span><i className="is-other" />기타</span>
      </div>
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

async function addBoundaryLayer(map: L.Map) {
  if (!BACKEND_API_BASE) return;
  try {
    const response = await fetch(`${BACKEND_API_BASE}/api/public/boundaries?type=DONG`);
    if (!response.ok) return;
    const payload = (await response.json()) as {
      success?: boolean;
      data?: GeoJSON.FeatureCollection;
    };
    if (!payload.success || payload.data?.type !== "FeatureCollection") return;
    L.geoJSON(payload.data, {
      style: {
        color: "#3159d8",
        weight: 1.2,
        opacity: 0.72,
        fillColor: "#3159d8",
        fillOpacity: 0.035,
        dashArray: "4 4",
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as Record<string, unknown> | null;
        const name = String(props?.name || props?.ADM_NM || props?.adm_nm || "").trim();
        if (name) layer.bindTooltip(name, { sticky: true, direction: "top" });
      },
    }).addTo(map);
  } catch {
    // Boundary layer is helpful but not required for task completion.
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
