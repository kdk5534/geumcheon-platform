export type OverviewTopic = "population" | "commercial" | "welfare" | "safety";
export type MapMode = "map" | "list";

export interface MetricCard {
  key: string;
  label: string;
  value: string;
  status: string;
  source: string;
  accent: "cobalt" | "mint" | "coral" | "amber";
}

export interface FacilitySummary {
  id: string;
  name: string;
  category: string;
  address: string;
  lat?: number;
  lng?: number;
  coordinateSource?: "source" | "estimated";
}

// 대기질 오염물질 항목 1개
export interface PollutantDatum {
  key: "pm10" | "pm25" | "no2" | "o3" | "co" | "so2";
  label: string;
  value: number | null;
  unit: string;
}

// 어댑터가 정규화한 대기질 상세 구조
export interface AirQualityDetail {
  grade: string;
  maxIndex: number | null;
  pollutants: PollutantDatum[];
  measuredAt: string;
  hasData: boolean;
}

// 연령대별 인구 데이터 1개 행
export interface AgeBandDatum {
  ageBand: string;
  male: number;
  female: number;
}

// 어댑터가 정규화한 인구 구조
export interface PopulationStructure {
  total: number;
  male: number;
  female: number;
  byAge: AgeBandDatum[];
  hasGender: boolean;
  hasAgeBands: boolean;
}

export interface OverviewModel {
  asOf: string;
  sourceMode: string;
  districts: string[];
  metrics: MetricCard[];
  facilities: FacilitySummary[];
  provenance: Array<{ label: string; value: string }>;
  populationSeries: Array<{ name: string; value: number }>;
  storeCategorySeries: Array<{ name: string; value: number }>;
  // 어댑터가 복원한 풍부한 데이터 필드
  airQuality: AirQualityDetail;
  population: PopulationStructure;
}
