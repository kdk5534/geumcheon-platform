// 업로드 워크플로 순수 로직 — DOM·React 의존 없음. static admin-model.js / state.js 포팅.

import type { UploadLogSummary } from "./adminApi";

// ── 필드 스키마 ───────────────────────────────────────────────

export interface FieldDef {
  key: string;
  label: string;
}

export interface FieldSchema {
  required: string[];
  fields: FieldDef[];
}

/** 데이터셋별 컬럼 스키마 — static state.js datasetFieldSchemas 포팅 */
export const datasetFieldSchemas: Record<string, FieldSchema> = {
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
      { key: "source", label: "출처" },
    ],
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
      { key: "source", label: "출처" },
    ],
  },
  "air-quality": {
    required: ["stationName", "measuredAt"],
    fields: [
      { key: "stationName", label: "측정소" },
      { key: "measuredAt", label: "측정 일시" },
      { key: "pm10", label: "미세먼지" },
      { key: "pm25", label: "초미세먼지" },
      { key: "status", label: "상태" },
      { key: "source", label: "출처" },
    ],
  },
  "cctv-stations": {
    required: ["id", "latitude", "longitude"],
    fields: [
      { key: "id", label: "관리번호" },
      { key: "purpose", label: "설치목적구분" },
      { key: "roadAddress", label: "소재지도로명주소" },
      { key: "lotAddress", label: "소재지지번주소" },
      { key: "phone", label: "관리기관전화번호" },
      { key: "latitude", label: "위도" },
      { key: "longitude", label: "경도" },
      { key: "source", label: "출처" },
    ],
  },
  population: {
    required: ["areaName", "baseDate", "populationTotal"],
    fields: [
      { key: "areaName", label: "행정동" },
      { key: "baseDate", label: "기준일" },
      { key: "populationTotal", label: "총인구" },
      { key: "male", label: "남성" },
      { key: "female", label: "여성" },
      { key: "source", label: "출처" },
    ],
  },
};

/** 필드 키 → 헤더 별칭 목록 — static state.js fieldAliases 포팅 */
export const fieldAliases: Record<string, string[]> = {
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
  female: ["female", "여성", "여자인구"],
  purpose: ["purpose", "설치목적구분", "설치목적"],
  roadAddress: ["roadaddress", "소재지도로명주소", "도로명주소"],
  lotAddress: ["lotaddress", "소재지지번주소", "지번주소"],
};

// ── 스키마 조회 ───────────────────────────────────────────────

/** 데이터셋 키로 스키마를 가져온다. 없으면 null. */
export function fieldSchemaFor(datasetKey: string): FieldSchema | null {
  return datasetFieldSchemas[datasetKey] ?? null;
}

/** 스키마 내 특정 필드 키의 한국어 레이블을 반환한다. */
export function fieldLabel(schema: FieldSchema, key: string): string {
  return schema.fields.find((f) => f.key === key)?.label ?? key;
}

// ── 헤더 자동 매핑 ────────────────────────────────────────────

/** 비교용 헤더 정규화 — 공백·특수문자 제거 후 소문자 */
export function normalizeFieldName(v: string): string {
  return v.toLowerCase().replace(/[\s_\-()[\].]/g, "");
}

/**
 * CSV 헤더 문자열을 받아 가장 가까운 필드 키를 추정한다.
 * 매핑 가능한 키가 없으면 빈 문자열 반환.
 */
export function guessFieldKey(header: string, datasetKey: string): string {
  const norm = normalizeFieldName(header);
  const schema = fieldSchemaFor(datasetKey);
  if (!schema) return "";

  // cctv-stations 전용 매핑
  if (datasetKey === "cctv-stations") {
    const cctvMap: Record<string, string> = {
      관리번호: "id",
      설치목적구분: "purpose",
      소재지도로명주소: "roadAddress",
      소재지지번주소: "lotAddress",
      관리기관전화번호: "phone",
      wgs84위도: "latitude",
      wgs84경도: "longitude",
    };
    if (cctvMap[norm]) return cctvMap[norm];
  }

  const match = schema.fields.find((f) =>
    (fieldAliases[f.key] ?? []).some((alias) => normalizeFieldName(alias) === norm),
  );
  return match?.key ?? "";
}

/** 헤더 배열을 받아 초기 매핑 Record를 생성한다. */
export function buildInitialMapping(
  headers: string[],
  datasetKey: string,
): Record<string, string> {
  return Object.fromEntries(headers.map((h) => [h, guessFieldKey(h, datasetKey)]));
}

// ── 매핑 검증 ─────────────────────────────────────────────────

export interface MappingValidation {
  missingRequired: string[];
  duplicates: string[];
}

/**
 * 소프트 매핑 검증 — 누락·중복 경고만 반환하고 차단하지 않는다.
 * 실제 거부는 백엔드가 수행한다.
 */
export function validateMappingSoft(
  schema: FieldSchema,
  mapping: Record<string, string>,
): MappingValidation {
  const mapped = Object.values(mapping).filter(Boolean);
  const missingRequired = schema.required.filter((k) => !mapped.includes(k));
  const dup = mapped.filter((k, i) => mapped.indexOf(k) !== i);
  return { missingRequired, duplicates: [...new Set(dup)] };
}

// ── 업로드 가능 판정 ──────────────────────────────────────────

export interface DatasetSummaryMeta {
  datasetKey: string;
  uploadMode: string;
  publicVisible: boolean;
  supportsUploadCommit: boolean;
}

/** 파일 업로드(preview) 가능 여부 */
export function isUploadable(ds: DatasetSummaryMeta): boolean {
  return Boolean(ds.publicVisible) && String(ds.uploadMode).includes("CSV");
}

/** 확정 저장(commit) 가능 여부 */
export function canCommit(ds: DatasetSummaryMeta): boolean {
  return isUploadable(ds) && Boolean(ds.supportsUploadCommit);
}

// ── 역할 판정 ─────────────────────────────────────────────────

/** ADMIN 또는 REVIEWER 역할 보유 여부 (commit 권한) */
export function hasCommitRole(roles: string[]): boolean {
  return roles.some((r) => ["ADMIN", "REVIEWER", "ROLE_ADMIN", "ROLE_REVIEWER"].includes(r));
}

/** ADMIN 또는 OPERATOR 역할 보유 여부 (stage 권한) */
export function hasStageRole(roles: string[]): boolean {
  return roles.some((r) => ["ADMIN", "OPERATOR", "ROLE_ADMIN", "ROLE_OPERATOR"].includes(r));
}

// ── 파일 유효성 ───────────────────────────────────────────────

const CSV_EXTENSIONS = new Set(["csv"]);
const EXCEL_EXTENSIONS = new Set(["xlsx", "xls"]);

function fileExt(file: File): string {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : "";
}

/** 파일 종류 판별 — "csv" | "excel" | "unsupported" */
export function fileKind(file: File): "csv" | "excel" | "unsupported" {
  const ext = fileExt(file);
  if (CSV_EXTENSIONS.has(ext) || file.type === "text/csv") return "csv";
  if (
    EXCEL_EXTENSIONS.has(ext) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  )
    return "excel";
  return "unsupported";
}

// ── 포맷 헬퍼 ────────────────────────────────────────────────

/** 바이트 수를 KB/MB 문자열로 포맷 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "성공",
  FAILED: "실패",
  LOCAL: "로컬",
  SKIPPED: "건너뜀",
  PENDING: "대기",
};

/** 업로드 상태 코드를 한국어 라벨로 변환 */
export function uploadStatusLabel(status: string | null | undefined): string {
  const key = String(status ?? "").trim().toUpperCase();
  return STATUS_LABELS[key] ?? (status ?? "");
}

/** 업로드 상태 CSS 클래스 접미사 — "is-success", "is-failed" 등 */
export function uploadStatusClass(status: string | null | undefined): string {
  const key = String(status ?? "").trim().toLowerCase();
  return key ? `is-${key}` : "";
}

/** 수집 로그 일시 포맷 */
export function formatLogTime(createdAt: string | null | undefined): string {
  if (!createdAt) return "—";
  try {
    return new Date(createdAt).toLocaleString("ko-KR");
  } catch {
    return String(createdAt);
  }
}

/** 업로드 에러를 사용자 친화적 메시지로 변환 */
export function friendlyUploadError(err: unknown): string {
  const e = err as { status?: number; message?: string; isHttpFailure?: boolean; isApiFailure?: boolean };
  if (e.status === 401 || e.status === 403) return "세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (e.status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (e.status === 400) return e.message ?? "파일 형식 또는 데이터셋 정보가 올바르지 않습니다.";
  if (e.status === 404) return "등록되지 않은 데이터셋입니다.";
  if (e.isApiFailure) return e.message ?? "업로드 처리에 실패했습니다.";
  if (e.isHttpFailure) return e.message ?? "백엔드 요청이 실패했습니다.";
  return "서버에 연결할 수 없습니다. 백엔드 서버 상태를 확인해 주세요.";
}

/** 수집 로그 배열에서 요약 통계를 계산 */
export function logSummaryStats(logs: UploadLogSummary[]) {
  const total = logs.length;
  const success = logs.filter((l) => l.status?.toUpperCase() === "SUCCESS").length;
  const failed = logs.filter((l) => l.status?.toUpperCase() === "FAILED").length;
  return { total, success, failed };
}
