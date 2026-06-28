import { useEffect, useMemo, useState } from "react";
import type { MapMode, OverviewModel, OverviewTopic } from "../overviewTypes";
import type { FacilitySummary } from "../overviewTypes";
import { VworldMap } from "./VworldMap";
import type { ChoroplethProps } from "./VworldMap";
import { FacilityDetailDrawer } from "./FacilityDetailDrawer";
import { normalizeDongName } from "../../../data/dongName";
import { useDongBoundaries } from "../../../data/dongBoundaries";
import { aggregateByDong } from "../../../data/aggregateByDong";

interface Props {
  model: OverviewModel;
  topic: OverviewTopic;
  district: string;
  mapMode: MapMode;
  selectedBreakdown: string;
  onMapModeChange: (mode: MapMode) => void;
}

const topicTitle: Record<OverviewTopic, string> = {
  population: "인구 공간 현황",
  commercial: "상가업소 공간 현황",
  welfare: "복지시설 공간 현황",
  safety: "안전·환경 공간 현황",
};

const topicLabel: Record<OverviewTopic, string> = {
  population: "인구",
  commercial: "상권",
  welfare: "복지",
  safety: "안전",
};

const topicFacilityAliases: Record<OverviewTopic, string[]> = {
  population: ["공공", "문화", "의료", "행정", "복지", "교통", "전기차", "주차", "wi-fi", "wifi", "자전거"],
  commercial: ["상가", "업소", "시장", "주차", "wi-fi", "wifi", "전기차"],
  welfare: ["복지", "돌봄", "의료", "보건", "병원", "약국", "어르신", "장애", "어린이집"],
  safety: ["cctv", "안전", "방범", "재난", "보호", "스쿨존", "쉼터", "대피", "민방위"],
};

export function OverviewMapPanel({ model, topic, district, mapMode, selectedBreakdown, onMapModeChange }: Props) {
  const [selectedFacility, setSelectedFacility] = useState<FacilitySummary | null>(null);
  // choropleth 지표 선택: off / population / facility
  const [choroplethMetric, setChoroplethMetric] = useState<"off" | "population" | "facility">("off");

  const dongFC = useDongBoundaries();

  // 인구 행정동별 값 맵 — populationSeries에서 정규화 키로 구성
  const populationMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of model.populationSeries) {
      map.set(normalizeDongName(item.name), item.value);
    }
    return map;
  }, [model.populationSeries]);

  // 시설 동별 집계 맵 — 현재 주제 필터 적용 후 행정동 경계 PIP로 집계
  // 지역·세분화 필터는 제외: 동 분포 choropleth은 주제 전체 시설을 보여주는 것이 직관적
  const facilityMap = useMemo(() => {
    if (!dongFC) return new Map<string, number>();
    const topicFiltered = model.facilities.filter((f) => {
      const haystack = `${f.name} ${f.category} ${f.address}`.toLocaleLowerCase("ko-KR");
      return topicFacilityAliases[topic].some((alias) => haystack.includes(alias.toLocaleLowerCase("ko-KR")));
    });
    const facs = topicFiltered.length ? topicFiltered : model.facilities;
    return aggregateByDong(facs, dongFC);
  }, [dongFC, model.facilities, topic]);

  const choroplethProp: ChoroplethProps | undefined = (() => {
    if (choroplethMetric === "population" && populationMap.size > 0) {
      return { valuesByDong: populationMap, metricLabel: "행정동별 인구(명)" };
    }
    if (choroplethMetric === "facility" && facilityMap.size > 0) {
      return { valuesByDong: facilityMap, metricLabel: "행정동별 시설 수(개)" };
    }
    return undefined;
  })();
  const topicFilteredFacilities = model.facilities.filter((facility) => {
    const haystack = `${facility.name} ${facility.category} ${facility.address}`.toLocaleLowerCase("ko-KR");
    return topicFacilityAliases[topic].some((alias) => haystack.includes(alias.toLocaleLowerCase("ko-KR")));
  });
  const topicFacilities = topicFilteredFacilities.length ? topicFilteredFacilities : model.facilities;
  const areaFilter = district || (topic !== "commercial" ? selectedBreakdown : "");
  const districtFilteredFacilities = areaFilter
    ? topicFacilities.filter((facility) =>
        `${facility.name} ${facility.category} ${facility.address}`.toLocaleLowerCase("ko-KR").includes(areaFilter.toLocaleLowerCase("ko-KR")),
      )
    : topicFacilities;
  const filteredFacilities =
    topic === "commercial" && selectedBreakdown
      ? districtFilteredFacilities.filter((facility) => facility.category.includes(selectedBreakdown))
      : districtFilteredFacilities;
  const displayedFacilities = filteredFacilities.length ? filteredFacilities : topicFacilities;
  const geocodedCount = displayedFacilities.filter((facility) => facility.lat && facility.lng).length;
  const estimatedCount = displayedFacilities.filter((facility) => facility.coordinateSource === "estimated").length;

  useEffect(() => {
    if (selectedFacility && !displayedFacilities.some((facility) => facility.id === selectedFacility.id)) {
      setSelectedFacility(null);
    }
  }, [displayedFacilities, selectedFacility]);

  return (
    <article className="gdp-map-panel">
      <header className="gdp-panel-head">
        <div>
          <span>SPATIAL CANVAS</span>
          <h2>{topicTitle[topic]}</h2>
          <p>VWorld 지도와 동일 조건의 대체 목록을 함께 제공합니다.</p>
        </div>
        <div className="gdp-map-panel-controls">
          {mapMode === "map" && (populationMap.size > 0 || facilityMap.size > 0) && (
            <div
              className="gdp-segmented gdp-choropleth-segment"
              role="group"
              aria-label="동별 색칠 지표"
            >
              <button
                className={choroplethMetric === "off" ? "is-active" : ""}
                type="button"
                onClick={() => setChoroplethMetric("off")}
              >끄기</button>
              {populationMap.size > 0 && (
                <button
                  className={choroplethMetric === "population" ? "is-active" : ""}
                  type="button"
                  onClick={() => setChoroplethMetric("population")}
                >인구</button>
              )}
              {facilityMap.size > 0 && (
                <button
                  className={choroplethMetric === "facility" ? "is-active" : ""}
                  type="button"
                  onClick={() => setChoroplethMetric("facility")}
                >시설 수</button>
              )}
            </div>
          )}
          <div className="gdp-segmented" role="group" aria-label="지도 보기 방식">
            <button
              className={mapMode === "map" ? "is-active" : ""}
              type="button"
              onClick={() => onMapModeChange("map")}
            >
              지도
            </button>
            <button
              className={mapMode === "list" ? "is-active" : ""}
              type="button"
              onClick={() => onMapModeChange("list")}
            >
              목록
            </button>
          </div>
        </div>
      </header>

      {mapMode === "map" ? (
        <VworldMap
          facilities={displayedFacilities}
          onSelectFacility={setSelectedFacility}
          selectedFacilityId={selectedFacility?.id}
          choropleth={choroplethProp}
        />
      ) : (
        <div className="gdp-map-list" aria-label="지도 대체 시설 목록">
          {displayedFacilities.map((facility) => (
            <button
              key={facility.id}
              className={selectedFacility?.id === facility.id ? "is-selected" : ""}
              type="button"
              aria-pressed={selectedFacility?.id === facility.id}
              onClick={() => setSelectedFacility(facility)}
            >
              <i />
              <div>
                <strong>{facility.name}</strong>
                <span>{facility.address}</span>
              </div>
              <small>{facility.category}</small>
            </button>
          ))}
        </div>
      )}

      {selectedFacility ? (
        <FacilityDetailDrawer facility={selectedFacility} onClose={() => setSelectedFacility(null)} />
      ) : null}

      <footer className="gdp-map-foot">
        <span>
          공개 범위 GEUMCHEON · 현재 주제 {topicLabel[topic]}
          {selectedBreakdown ? ` · 선택 ${selectedBreakdown}` : ""}
          {estimatedCount ? ` · 표시용 위치 ${estimatedCount.toLocaleString("ko-KR")}행` : ""}
        </span>
        <strong>
          표시 {displayedFacilities.length.toLocaleString("ko-KR")}행 · 좌표 {geocodedCount.toLocaleString("ko-KR")}행
        </strong>
      </footer>
    </article>
  );
}
