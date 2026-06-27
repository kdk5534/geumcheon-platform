import { fetchWithTimeout, isDevelopmentSampleEnabled } from "./api.js";
import { BACKEND_API_BASE } from "./state.js";

export async function loadGeumcheonBoundary(type = "DONG", { signal } = {}) {
  const normalized = type === "DISTRICT" ? "DISTRICT" : "DONG";
  try {
    const response = await fetchWithTimeout(
      `${BACKEND_API_BASE}/api/public/boundaries?type=${normalized}`,
      undefined,
      { signal },
    );
    const payload = await response.json();
    if (payload?.success && payload.data?.type === "FeatureCollection" && payload.data.features?.length) {
      return payload.data;
    }
  } catch {}

  if (normalized === "DONG" && isDevelopmentSampleEnabled()) {
    try {
      const response = await fetch("./assets/data/geumcheon-dong.geojson", { signal });
      if (response.ok) return response.json();
    } catch {}
  }
  return null;
}

export async function addGeumcheonBoundaryLayer(L, map, options = {}) {
  const geojson = await loadGeumcheonBoundary(options.type || "DONG", { signal: options.signal });
  if (!geojson || !map) return null;
  return L.geoJSON(geojson, {
    pane: options.pane || "overlayPane",
    style: () => ({
      color: options.color || "#3159d8",
      weight: options.weight || 1.2,
      opacity: .72,
      fillColor: options.fillColor || "#3159d8",
      fillOpacity: options.fillOpacity ?? .035,
      dashArray: options.dashArray || "4 4",
    }),
    onEachFeature: (feature, layer) => {
      const name = feature?.properties?.name || feature?.properties?.ADM_NM || feature?.properties?.adm_nm;
      if (name) layer.bindTooltip(name, { sticky: true, direction: "top" });
      if (name && options.onSelect) layer.on("click", () => options.onSelect(name, feature));
    },
  }).addTo(map);
}
