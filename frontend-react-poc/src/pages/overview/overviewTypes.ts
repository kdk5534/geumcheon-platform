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

export interface OverviewModel {
  asOf: string;
  sourceMode: string;
  districts: string[];
  metrics: MetricCard[];
  facilities: FacilitySummary[];
  provenance: Array<{ label: string; value: string }>;
  populationSeries: Array<{ name: string; value: number }>;
  storeCategorySeries: Array<{ name: string; value: number }>;
}
