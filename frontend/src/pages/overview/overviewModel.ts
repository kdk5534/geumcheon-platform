import type { OverviewModel } from "./overviewTypes";

export const overviewModel: OverviewModel = {
  asOf: "항목별 기준일",
  sourceMode: "공개 데이터 연결 대기",
  districts: ["가산동", "독산1동", "독산2동", "독산3동", "독산4동", "시흥1동", "시흥2동"],
  metrics: [
    {
      key: "population",
      label: "주민등록 인구",
      value: "150,340명",
      status: "마지막 정상값",
      source: "행정동별 원값",
      accent: "cobalt",
    },
    {
      key: "commercial",
      label: "상가업소",
      value: "10,892개",
      status: "운영 데이터",
      source: "GEUMCHEON 범위",
      accent: "coral",
    },
    {
      key: "facility",
      label: "등록 생활시설",
      value: "214행",
      status: "공개 가능",
      source: "시설 API 응답 행",
      accent: "mint",
    },
    {
      key: "air",
      label: "대기질",
      value: "보통",
      status: "항목별 기준",
      source: "환경 관측값",
      accent: "amber",
    },
  ],
  facilities: [
    { id: "f-1", name: "금천구청", category: "공공", address: "서울특별시 금천구 시흥대로73길 70" },
    { id: "f-2", name: "가산도서관", category: "문화", address: "서울특별시 금천구 가산로5길 43" },
    { id: "f-3", name: "독산보건분소", category: "의료", address: "서울특별시 금천구 독산로" },
    { id: "f-4", name: "시흥행정복지센터", category: "행정", address: "서울특별시 금천구 시흥대로" },
  ],
  provenance: [
    { label: "공개 범위", value: "금천구 GEUMCHEON" },
    { label: "좌표 기준", value: "WGS84 / EPSG:4326" },
    { label: "지도 공급", value: "VWorld backend proxy" },
    { label: "표시 정책", value: "마지막 정상값 우선" },
  ],
  populationSeries: [
    { name: "가산동", value: 24800 },
    { name: "독산1동", value: 31100 },
    { name: "독산2동", value: 18700 },
    { name: "시흥1동", value: 29200 },
  ],
  storeCategorySeries: [
    { name: "음식", value: 3200 },
    { name: "소매", value: 2700 },
    { name: "서비스", value: 2100 },
    { name: "의료", value: 860 },
  ],
};
