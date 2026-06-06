// 전역 상태 객체와 앱 전역 상수

export const BACKEND_API_BASE = "http://localhost:8080";
export const API_TIMEOUT_MS = 1500;
export const ADMIN_API_TIMEOUT_MS = 5000;
export const UPLOAD_LOG_KEY = "geumcheon-upload-logs";
export const API_LOG_KEY = "geumcheon-api-logs";
export const DATASET_CONFIG_KEY = "geumcheon-admin-datasets";
export const ADMIN_AUTH_STORAGE_KEY = "geumcheon-admin-auth";
export const CSV_EXTENSIONS = new Set(["csv"]);
export const EXCEL_EXTENSIONS = new Set(["xlsx", "xls"]);
export const ALLOWED_UPLOAD_MODES = new Set(["CSV", "API", "API/CSV"]);
export const GEO_METRICS = ["생활", "교통", "안전"];

export const DEFAULT_SECTION_META = {
  overview: { source: "금천구 Mock 데이터", asOf: "2026.06.02 16:00" },
  life: { source: "생활시설 Mock 데이터", asOf: "2026.06.02 16:00" },
  commercial: { source: "상가업소정보 Mock 집계", asOf: "2026.06.02 15:40" },
  geo: { source: "행정동/집계구 Mock GeoJSON", asOf: "2026.06.02 16:00" },
  api: { source: "API 설정/로그 Mock", asOf: "2026.06.02 16:00" }
};

// 업로드 컬럼 스키마 (admin 모듈로 이전 예정)
export const datasetFieldSchemas = {
  facilities: {
    required: ["id", "category", "name", "address", "latitude", "longitude"],
    fields: [
      { key: "id", label: "고유 ID" },
      { key: "category", label: "시설 분류" },
      { key: "name", label: "시설명" },
      { key: "address", label: "주소" },
      { key: "phone", label: "전화번호" },
      { key: "latitude", label: "위도" },
      { key: "longitude", label: "경도" },
      { key: "source", label: "출처" }
    ]
  },
  stores: {
    required: ["name", "address"],
    fields: [
      { key: "id", label: "상가 ID" },
      { key: "name", label: "상호명" },
      { key: "category", label: "업종" },
      { key: "address", label: "주소" },
      { key: "phone", label: "전화번호" },
      { key: "latitude", label: "위도" },
      { key: "longitude", label: "경도" },
      { key: "source", label: "출처" }
    ]
  },
  "air-quality": {
    required: ["stationName", "measuredAt"],
    fields: [
      { key: "stationName", label: "측정소" },
      { key: "measuredAt", label: "측정 일시" },
      { key: "pm10", label: "미세먼지" },
      { key: "pm25", label: "초미세먼지" },
      { key: "status", label: "상태" },
      { key: "source", label: "출처" }
    ]
  },
  population: {
    required: ["areaName", "baseDate", "populationTotal"],
    fields: [
      { key: "areaName", label: "행정동" },
      { key: "baseDate", label: "기준일" },
      { key: "populationTotal", label: "총인구" },
      { key: "male", label: "남성" },
      { key: "female", label: "여성" },
      { key: "source", label: "출처" }
    ]
  }
};

// 컬럼 별칭 매핑 (admin 모듈로 이전 예정)
export const fieldAliases = {
  id: ["id", "code", "originalid", "sourceoriginalid", "관리번호", "고유id", "식별자"],
  category: ["category", "type", "kind", "분류", "유형", "카테고리", "업종"],
  name: ["name", "facilityname", "businessname", "storename", "상호명", "시설명", "명칭", "이름"],
  address: ["address", "roadaddress", "addressroad", "addr", "주소", "도로명주소", "소재지"],
  phone: ["phone", "tel", "telephone", "연락처", "전화", "전화번호"],
  latitude: ["latitude", "lat", "y", "위도"],
  longitude: ["longitude", "lng", "lon", "x", "경도"],
  source: ["source", "origin", "출처", "데이터출처"],
  stationName: ["stationname", "station", "측정소", "측정소명"],
  measuredAt: ["measuredate", "measuredat", "datetime", "date", "측정일시", "일시"],
  pm10: ["pm10", "미세먼지"],
  pm25: ["pm25", "초미세먼지"],
  status: ["status", "상태"],
  areaName: ["areaname", "dong", "admindong", "행정동", "동명"],
  baseDate: ["basedate", "date", "기준일", "기준연월"],
  populationTotal: ["populationtotal", "population", "total", "총인구", "인구"],
  male: ["male", "남성", "남자인구"],
  female: ["female", "여성", "여자인구"]
};

// 지도 마커 관련 (map 모듈로 이전 예정)
export const categoryInitial = {
  "병원": "H",
  "약국": "P",
  "주차장": "P",
  "안전": "S"
};

export const categoryColor = {
  "병원": "#ba3f33",
  "약국": "#6658a6",
  "주차장": "#1f7f86",
  "안전": "#b46d16"
};

// 전역 상태 — 모든 페이지 모듈이 이 객체를 import해서 읽고 쓴다
export const state = {
  data: null,
  category: "전체",
  industry: "카페",
  uploadLogs: [],
  uploadPreview: null,
  uploadMapping: {},
  adminDatasets: [],
  adminDatasetBase: [],
  adminAuth: readStoredAdminAuth(),
  selectedDatasetKey: "facilities",
  selectedUploadDatasetKey: "facilities",
  mapBoundary: "행정동",
  geoMetric: "생활",
  geoDistrict: "가산동",
  populationDistrict: "가산동",
  apiSources: [],
  apiSourceFilter: "전체",
  apiLogs: [],
  apiLogFilter: "전체",
  apiLogSearch: ""
};

// sessionStorage에서 관리자 인증 정보를 읽는다. state 초기화 시 한 번 호출된다.
function readStoredAdminAuth() {
  try {
    const raw = sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.loginId || !parsed?.authHeader) {
      return null;
    }

    return {
      loginId: String(parsed.loginId),
      authHeader: String(parsed.authHeader),
      savedAt: parsed.savedAt || new Date().toISOString()
    };
  } catch {
    return null;
  }
}
