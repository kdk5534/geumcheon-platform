// 시설 좌표를 행정동 폴리곤에 point-in-polygon으로 집계하는 순수 함수
import type { FacilitySummary } from "../pages/overview/overviewTypes";
import { normalizeDongName } from "./dongName";

/** Ray-casting PIP — Polygon 링 배열(외곽 + 홀)에 대해 판정 */
function pointInRing(lng: number, lat: number, ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Polygon geometry(외곽 + 홀)에 대해 포함 여부 판정 */
function pointInPolygon(lng: number, lat: number, rings: GeoJSON.Position[][]): boolean {
  // 첫 번째 링(외곽)에 포함 AND 나머지 링(홀)에 포함되지 않아야 함
  if (rings.length === 0) return false;
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false; // 홀 안에 있으면 제외
  }
  return true;
}

/** GeoJSON Geometry(Polygon 또는 MultiPolygon)에 대해 PIP 판정 */
function pointInGeometry(lng: number, lat: number, geometry: GeoJSON.Geometry): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygon(lng, lat, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(lng, lat, polygon));
  }
  return false;
}

/**
 * 시설 배열을 행정동별로 집계해 Map<동이름, 수>를 반환한다.
 * - 좌표 있는 시설만 PIP 집계(추정 좌표 포함).
 * - 어느 동에도 속하지 않는 시설(경계 밖 등)은 제외.
 */
export function aggregateByDong(
  facilities: FacilitySummary[],
  fc: GeoJSON.FeatureCollection,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const facility of facilities) {
    if (!facility.lat || !facility.lng) continue;

    for (const feature of fc.features) {
      if (!feature.geometry || !feature.properties) continue;
      if (!pointInGeometry(facility.lng, facility.lat, feature.geometry as GeoJSON.Geometry)) continue;

      const rawName = String(
        feature.properties.name ||
        feature.properties.ADM_NM ||
        feature.properties.adm_nm ||
        "",
      ).trim();
      const dongName = normalizeDongName(rawName);
      if (!dongName) continue;

      result.set(dongName, (result.get(dongName) ?? 0) + 1);
      break; // 첫 번째 매칭 동에만 귀속
    }
  }

  return result;
}
