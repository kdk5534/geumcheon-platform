import { API_TIMEOUT_MS, BACKEND_API_BASE, isBackendApiEnabled } from "./env";

export interface ApiPayload<T> {
  success?: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  timestamp?: string;
}

export async function fetchWithTimeout<T>(url: string, timeoutMs = API_TIMEOUT_MS, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function fetchApi<T>(path: string, signal?: AbortSignal) {
  return fetchWithTimeout<ApiPayload<T>>(`${BACKEND_API_BASE}${path}`, API_TIMEOUT_MS, signal);
}

async function fetchLocal<T>(path: string, signal?: AbortSignal) {
  return fetchWithTimeout<T>(path, API_TIMEOUT_MS, signal);
}

export interface RawPopulation {
  areaName?: string;
  dongName?: string;
  name?: string;
  total?: number | string;
  population?: number | string;
}

export interface RawFacility {
  id?: string | number;
  facilityId?: string | number;
  name?: string;
  facilityName?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  source?: string;
}

export interface RawStore {
  id?: string | number;
  name?: string;
  storeName?: string;
  category?: string;
  businessCategory?: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
}

export interface RawAirQuality {
  status?: string;
  grade?: string;
  value?: string;
  pm10?: number | string;
  measuredAt?: string;
  observedAt?: string;
  stationName?: string;
  districtName?: string;
}

export interface PublicDataBundle {
  source: "backend" | "local" | "empty";
  population: RawPopulation[];
  facilities: RawFacility[];
  stores: RawStore[];
  airQuality: RawAirQuality[];
  apiSources: unknown[];
  meta: Record<string, unknown>;
}

async function loadAllFacilities(signal?: AbortSignal) {
  const categories = [
    "CCTV",
    "WELFARE",
    "HOSPITAL",
    "PHARMACY",
    "CHILDCARE",
    "PARKING",
    "WIFI",
    "BIKE",
    "EV_CHARGER",
    "SHELTER",
    "SCHOOL_ZONE",
    "CIVIL_DEFENSE_SHELTER",
    // Phase 1 신규 — 안전·환경
    "PLAYGROUND",
    "AED",
    "STREET_LIGHT",
    "FIRE_HYDRANT",
    // Phase 1 신규 — 생활편의·문화
    "MUSEUM",
    "LIBRARY",
    "PARK",
    // Phase 1 신규 — G밸리 산업·상권
    "TRADITIONAL_MARKET",
    "KNOWLEDGE_INDUSTRY_CENTER",
  ];
  const results = await Promise.allSettled(
    categories.map(async (category) => {
      const payload = await fetchApi<RawFacility[]>(
        `/api/public/facilities?scope=GEUMCHEON&category=${encodeURIComponent(category)}&page=0&size=1000`,
        signal,
      );
      return payload.success && Array.isArray(payload.data) ? payload.data : [];
    }),
  );
  const rows = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  if (rows.length) return rows;

  const payload = await fetchApi<RawFacility[]>("/api/public/facilities?scope=GEUMCHEON&page=0&size=1000", signal);
  return payload.success && Array.isArray(payload.data) ? payload.data : [];
}

export async function loadPublicData(signal?: AbortSignal): Promise<PublicDataBundle> {
  if (isBackendApiEnabled()) {
    try {
      const [population, facilities, stores, airQuality, apiSources] = await Promise.allSettled([
        fetchApi<RawPopulation[]>("/api/public/population", signal),
        loadAllFacilities(signal),
        fetchApi<RawStore[]>("/api/public/stores?scope=GEUMCHEON&size=1000", signal),
        fetchApi<RawAirQuality[]>("/api/public/air-quality", signal),
        fetchApi<unknown[]>("/api/public/api-sources", signal),
      ]);

      const fromPayload = <T>(result: PromiseSettledResult<ApiPayload<T>>) =>
        result.status === "fulfilled" && result.value.success && Array.isArray(result.value.data)
          ? result.value.data
          : [];

      const facilityData = facilities.status === "fulfilled" ? facilities.value : [];
      const bundle: PublicDataBundle = {
        source: "backend",
        population: fromPayload(population),
        facilities: facilityData,
        stores: fromPayload(stores),
        airQuality: fromPayload(airQuality),
        apiSources: fromPayload(apiSources),
        meta: {
          population: population.status === "fulfilled" ? population.value.meta : undefined,
          facilities: { rows: facilityData.length },
          stores: stores.status === "fulfilled" ? stores.value.meta : undefined,
          airQuality: airQuality.status === "fulfilled" ? airQuality.value.meta : undefined,
        },
      };

      if (
        bundle.population.length ||
        bundle.facilities.length ||
        bundle.stores.length ||
        bundle.airQuality.length
      ) {
        return bundle;
      }
    } catch {
      // fall through to local fixture
    }
  }

  try {
    const local = await fetchLocal<{
      population?: RawPopulation[];
      facilities?: RawFacility[];
      stores?: RawStore[];
      airQuality?: RawAirQuality[];
      apiSources?: unknown[];
      meta?: Record<string, unknown>;
    }>(`${import.meta.env.BASE_URL}assets/data/mock-data.json`, signal);
    return {
      source: "local",
      population: local.population || [],
      facilities: local.facilities || [],
      stores: local.stores || [],
      airQuality: local.airQuality || [],
      apiSources: local.apiSources || [],
      meta: local.meta || {},
    };
  } catch {
    return {
      source: "empty",
      population: [],
      facilities: [],
      stores: [],
      airQuality: [],
      apiSources: [],
      meta: {},
    };
  }
}
