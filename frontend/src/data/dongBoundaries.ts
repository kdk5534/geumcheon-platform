// 금천구 행정동 GeoJSON 경계 데이터를 비동기 로드하고 캐싱하는 훅
import { useEffect, useState } from "react";

const DONG_GEOJSON_URL = "./assets/data/geumcheon-dong.geojson";

// 모듈 레벨 캐시 — 페이지 간 재요청 방지
let cachedPromise: Promise<GeoJSON.FeatureCollection | null> | null = null;

async function fetchDongBoundaries(): Promise<GeoJSON.FeatureCollection | null> {
  if (!cachedPromise) {
    cachedPromise = fetch(DONG_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<GeoJSON.FeatureCollection>;
      })
      .then((data) => {
        if (data?.type !== "FeatureCollection") return null;
        return data;
      })
      .catch(() => null);
  }
  return cachedPromise;
}

/**
 * 금천구 행정동 GeoJSON FeatureCollection을 반환하는 훅.
 * 모듈 캐시로 단일 요청 보장. 실패 시 null 반환.
 */
export function useDongBoundaries(): GeoJSON.FeatureCollection | null {
  const [fc, setFc] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDongBoundaries().then((data) => {
      if (!cancelled) setFc(data);
    });
    return () => { cancelled = true; };
  }, []);

  return fc;
}

/** 동기 캐시 조회 — 이미 로드된 경우 즉시 반환(VworldMap 공유용) */
export { fetchDongBoundaries };
