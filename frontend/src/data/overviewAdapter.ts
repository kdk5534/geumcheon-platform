import type { AirQualityDetail, AgeBandDatum, OverviewModel, PopulationStructure } from "../pages/overview/overviewTypes";
import type { PublicDataBundle, RawAirQuality, RawFacility, RawPopulation, RawStore } from "./publicApi";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "") {
  const result = String(value || "").trim();
  return result || fallback;
}

function formatNumber(value: number, suffix = "") {
  return value ? `${value.toLocaleString("ko-KR")}${suffix}` : "—";
}

function populationName(item: RawPopulation) {
  return text(item.areaName || item.dongName || item.name, "행정동");
}

function populationTotal(item: RawPopulation) {
  return numberValue(item.total || item.population);
}

function adaptAirQuality(items: RawAirQuality[]): AirQualityDetail {
  const first = items[0];
  if (!first) {
    return { grade: "—", maxIndex: null, pollutants: [], measuredAt: "—", hasData: false };
  }
  const pm10Val = numberValue(first.pm10);
  const pm25Val = numberValue(first.pm25);
  const no2Val = numberValue(first.nitrogen);
  const o3Val = numberValue(first.ozone);
  const coVal = numberValue(first.carbon);
  const so2Val = numberValue(first.sulfurous);
  const pollutants = [
    { key: "pm10" as const, label: "미세먼지(PM10)", value: pm10Val || null, unit: "㎍/㎥" },
    { key: "pm25" as const, label: "초미세먼지(PM2.5)", value: pm25Val || null, unit: "㎍/㎥" },
    { key: "no2" as const, label: "이산화질소(NO₂)", value: no2Val || null, unit: "ppm" },
    { key: "o3" as const, label: "오존(O₃)", value: o3Val || null, unit: "ppm" },
    { key: "co" as const, label: "일산화탄소(CO)", value: coVal || null, unit: "ppm" },
    { key: "so2" as const, label: "아황산가스(SO₂)", value: so2Val || null, unit: "ppm" },
  ];
  const hasData = pollutants.some((p) => p.value !== null) || !!(first.grade && first.grade !== "—");
  return {
    grade: text(first.grade || first.status, "—"),
    maxIndex: numberValue(first.maxIndex) || null,
    pollutants,
    measuredAt: text(first.measuredAt || first.observedAt, "—"),
    hasData,
  };
}

function adaptPopulationStructure(items: RawPopulation[]): PopulationStructure {
  let total = 0;
  let male = 0;
  let female = 0;
  const bandAccumulator = new Map<string, { male: number; female: number }>();

  for (const item of items) {
    const itemTotal = numberValue(item.total || item.population);
    total += itemTotal;
    male += numberValue(item.male);
    female += numberValue(item.female);

    if (Array.isArray(item.byAge)) {
      for (const band of item.byAge) {
        const key = text(band.ageBand, "미상");
        const existing = bandAccumulator.get(key) ?? { male: 0, female: 0 };
        existing.male += numberValue(band.male);
        existing.female += numberValue(band.female);
        bandAccumulator.set(key, existing);
      }
    }
  }

  // 연령대 라벨 숫자 추출로 정렬 (예: "0~9세" → 0, "10~19세" → 10)
  const byAge: AgeBandDatum[] = [...bandAccumulator.entries()]
    .map(([ageBand, counts]) => ({ ageBand, ...counts }))
    .sort((a, b) => {
      const numA = parseInt(a.ageBand.match(/\d+/)?.[0] ?? "999", 10);
      const numB = parseInt(b.ageBand.match(/\d+/)?.[0] ?? "999", 10);
      return numA - numB;
    });

  return {
    total,
    male,
    female,
    byAge,
    hasGender: male + female > 0,
    hasAgeBands: byAge.length > 0,
  };
}

function facilityId(item: RawFacility, index: number) {
  return text(item.id || item.facilityId, `facility-${index}`);
}

function facilityName(item: RawFacility) {
  return text(item.name || item.facilityName, "시설명 확인 필요");
}

function facilityAddress(item: RawFacility) {
  return text(item.address || item.roadAddress, "주소 정보 없음");
}

function facilityLat(item: RawFacility) {
  const value = numberValue(item.latitude || item.lat);
  return value || undefined;
}

function facilityLng(item: RawFacility) {
  const value = numberValue(item.longitude || item.lng);
  return value || undefined;
}

function facilityCategory(item: RawFacility) {
  const raw = text(item.category, "시설");
  return (
    {
      EV_CHARGER: "전기차충전소",
      CCTV: "CCTV",
      PARKING: "주차장",
      PARKING_SPACE_REFERENCE: "주차장 참고자료",
      WIFI: "공공 Wi-Fi",
      BIKE: "자전거",
      WELFARE: "복지",
      MEDICAL: "의료",
      HOSPITAL: "병원",
      PHARMACY: "약국",
      CHILDCARE: "어린이집",
      SHELTER: "무더위쉼터",
      SCHOOL_ZONE: "스쿨존",
      CIVIL_DEFENSE_SHELTER: "민방위대피소",
      // Phase 1 신규 — 안전·환경
      PLAYGROUND: "어린이놀이시설",
      AED: "자동제세동기(AED)",
      STREET_LIGHT: "보안등",
      FIRE_HYDRANT: "소방용수시설",
      // Phase 1 신규 — 생활편의·문화
      MUSEUM: "박물관·미술관",
      LIBRARY: "도서관",
      PARK: "도시공원",
      // Phase 1 신규 — G밸리 산업·상권
      TRADITIONAL_MARKET: "전통시장",
      KNOWLEDGE_INDUSTRY_CENTER: "지식산업센터",
      // Phase 1 신규 — 주거·부동산
      APT_COMPLEX: "공동주택 단지",
    } as Record<string, string>
  )[raw] || raw;
}

const dongCenters: Array<{ keyword: string; lat: number; lng: number }> = [
  { keyword: "가산", lat: 37.4766, lng: 126.8914 },
  { keyword: "독산1", lat: 37.4693, lng: 126.8975 },
  { keyword: "독산2", lat: 37.4643, lng: 126.9032 },
  { keyword: "독산3", lat: 37.4742, lng: 126.9047 },
  { keyword: "독산4", lat: 37.4674, lng: 126.9127 },
  { keyword: "독산", lat: 37.4688, lng: 126.9048 },
  { keyword: "시흥1", lat: 37.4562, lng: 126.9016 },
  { keyword: "시흥2", lat: 37.4496, lng: 126.9134 },
  { keyword: "시흥3", lat: 37.4418, lng: 126.9069 },
  { keyword: "시흥4", lat: 37.4593, lng: 126.9088 },
  { keyword: "시흥5", lat: 37.4521, lng: 126.8938 },
  { keyword: "시흥", lat: 37.4528, lng: 126.9042 },
];

function hashOffset(seed: string, axis: "lat" | "lng") {
  let hash = axis === "lat" ? 17 : 31;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) % 9973;
  }
  return ((hash % 1000) / 1000 - 0.5) * 0.006;
}

function estimatedCoordinate(item: RawFacility) {
  const haystack = `${facilityName(item)} ${facilityAddress(item)}`;
  const matched = dongCenters.find((center) => haystack.includes(center.keyword)) || { lat: 37.4565, lng: 126.8954 };
  return {
    lat: Number((matched.lat + hashOffset(haystack, "lat")).toFixed(6)),
    lng: Number((matched.lng + hashOffset(haystack, "lng")).toFixed(6)),
  };
}

export function adaptOverviewModel(bundle: PublicDataBundle): OverviewModel {
  const populationTotalValue = bundle.population.reduce((sum, item) => sum + populationTotal(item), 0);
  const districts = [...new Set(bundle.population.map(populationName).filter(Boolean))];
  const storeCount = bundle.stores.length;
  const sourceMode = bundle.source === "backend" ? "운영 데이터" : bundle.source === "local" ? "개발 검증 데이터" : "데이터 연결 대기";
  const asOf = text(
    (bundle.meta.population as { asOf?: string } | undefined)?.asOf ||
      (bundle.meta.airQuality as { observedAt?: string; collectedAt?: string } | undefined)?.observedAt ||
      (bundle.meta.airQuality as { collectedAt?: string } | undefined)?.collectedAt,
    "항목별 기준일",
  );

  const categoryCounts = new Map<string, number>();
  for (const store of bundle.stores) {
    const category = text(store.category || store.businessCategory, "기타");
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  const airQualityDetail = adaptAirQuality(bundle.airQuality);
  const populationStructure = adaptPopulationStructure(bundle.population);

  return {
    asOf,
    sourceMode,
    districts,
    airQuality: airQualityDetail,
    population: populationStructure,
    metrics: [
      {
        key: "population",
        label: "주민등록 인구",
        value: formatNumber(populationTotalValue, "명"),
        status: sourceMode,
        source: "행정동별 원값",
        accent: "cobalt",
      },
      {
        key: "commercial",
        label: "상가업소",
        value: formatNumber(storeCount, "개"),
        status: storeCount ? sourceMode : "확인 대기",
        source: "GEUMCHEON 범위",
        accent: "coral",
      },
      {
        key: "facility",
        label: "등록 생활시설",
        value: formatNumber(bundle.facilities.length, "행"),
        status: bundle.facilities.length ? sourceMode : "목록 없음",
        source: "시설 API 응답 행",
        accent: "mint",
      },
      {
        key: "air",
        label: "대기질",
        value: airQualityDetail.grade,
        status: bundle.airQuality.length ? "항목별 기준" : "확인 대기",
        source: "환경 관측값",
        accent: "amber",
      },
    ],
    facilities: bundle.facilities.map((item, index) => {
      const lat = facilityLat(item);
      const lng = facilityLng(item);
      const estimated = lat && lng ? null : estimatedCoordinate(item);
      return {
        id: facilityId(item, index),
        name: facilityName(item),
        category: facilityCategory(item),
        address: facilityAddress(item),
        lat: lat || estimated?.lat,
        lng: lng || estimated?.lng,
        coordinateSource: lat && lng ? "source" : "estimated",
      };
    }),
    provenance: [
      { label: "공개 범위", value: "금천구 GEUMCHEON" },
      { label: "데이터 모드", value: sourceMode },
      { label: "지도 공급", value: "VWorld backend proxy" },
      { label: "기준일", value: asOf },
    ],
    populationSeries: bundle.population
      .map((item) => ({ name: populationName(item), value: populationTotal(item) }))
      .filter((item) => item.value > 0),
    storeCategorySeries: [...categoryCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };
}
